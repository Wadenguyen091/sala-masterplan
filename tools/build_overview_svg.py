"""Build the vector overview map (assets/map/overview.svg + js/overview-svg.js) from OpenStreetMap data.

Data: tools/thu-thiem-osm.json — OpenFreeMap vector tiles (OpenStreetMap contributors, ODbL),
already projected into overview map space (2030 x 1471, same space as data.js `overview`).
Projection (Web Mercator, fitted to the previous raster overview so the framing matches):
    x = S*lon + TX ;  y = -S*mercY(lat) + TY
Raster positions from the old map-tong.jpg map to the same space with  (px*K, py*K + 183).
"""
import json, math, re, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = json.load(open(ROOT / 'tools/thu-thiem-osm.json', encoding='utf-8'))
LAY, NAMES = D['layers'], D['names']

S, TX, TY = 13295.872139137728, -1418253.3042665443, 144908.31295872218
K = 1647 / 1796
W, H = 2030, 1471


def P(lon, lat):
    return (S * lon + TX, -S * math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))) + TY)


def R(px, py):  # old raster pixel -> map space
    return (px * K, py * K + 183)


def f1(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def dpoly(pts, close=False):
    return 'M' + 'L'.join(f1(x) + ' ' + f1(y) for x, y in pts) + ('Z' if close else '')


def lines_of(names, exact=False):
    out = []
    for n, polys in NAMES.items():
        if any((n == k) if exact else (k.lower() in n.lower()) for k in names):
            out += [[tuple(p) for p in poly] for poly in polys]
    return out


# ---------------------------------------------------------------- palette (sampled from the old raster)
C = dict(bg='#ffffff', water='#d8dfe9', green='#aabda1', d1='#e9e2d8', gold='#cca874', brown='#6c3f22',
         major='#dccaa8', road='#e3d4bb', minor='#ece3d3', text='#2f2620', small='#7b6a58', icon='#c4a06a',
         bridge='#8f7c57', metro1='#4b3a2c', metro2='#2f6b3c', rail='#c9782c')


def _lines(key):
    out = []
    for sub in re.findall(r'M[^M]+', LAY.get(key, '')):
        pts = [tuple(map(float, q.split())) for q in sub[1:].split('L') if q.strip()]
        if len(pts) > 1:
            out.append(pts)
    return out


def _chaikin(ring, it=2):
    for _ in range(it):
        n = []
        for i in range(len(ring) - 1):
            p, q = ring[i], ring[i + 1]
            n += [(.75 * p[0] + .25 * q[0], .75 * p[1] + .25 * q[1]), (.25 * p[0] + .75 * q[0], .25 * p[1] + .75 * q[1])]
        ring = n + [n[0]]
    return ring


def _smooth_poly_d(geom, min_area=0, it=2, simp=0.6):
    out = []
    for g in getattr(geom, 'geoms', [geom]):
        if g.geom_type != 'Polygon' or g.is_empty or g.area < min_area:
            continue
        g = g.simplify(simp)
        rings = [g.exterior] + [i for i in g.interiors if Polygon(i).area > min_area * .3]
        for r in rings:
            pts = _chaikin(list(r.coords), it)
            out.append('M' + 'L'.join('%.1f %.1f' % xy for xy in pts[:-1]) + 'Z')
    return ''.join(out)


def _ribbons(keys, width, tol=0.4):
    """road centre lines -> one merged ribbon (dual carriageways and junctions melt into one clean shape)"""
    from shapely.geometry import LineString as _LS
    from shapely.ops import unary_union as _uu
    geoms = [_LS(l).simplify(tol) for k in keys for l in _lines(k)]
    u = _uu([g.buffer(width / 2, cap_style=1, join_style=1, resolution=4) for g in geoms])
    u = u.buffer(width * .35, resolution=4).buffer(-width * .35, resolution=4)   # weld parallel lanes
    return _smooth_poly_d(u, min_area=width * width * 2, it=1, simp=0.25)


_BASE = None


def base_layers():
    """cartographic base: few, calm layers in the designer's palette"""
    global _BASE
    if _BASE is not None:
        return list(_BASE)
    from shapely.ops import unary_union as _uu
    g = [f'<rect width="{W}" height="{H}" fill="{C["bg"]}"/>']
    # green: only meaningful parks, welded + smoothed into soft shapes
    greens = []
    for sub in re.findall(r'M[^M]+', LAY['green']):
        r = [tuple(map(float, q.split())) for q in sub[1:].rstrip('Z').split('L')]
        if len(r) >= 3:
            greens.append(Polygon(r).buffer(0))
    gu = _uu(greens).buffer(6, resolution=4).buffer(-6, resolution=4)
    g.append(f'<path d="{_smooth_poly_d(gu, min_area=900, it=2, simp=1.2)}" fill="{C["green"]}"/>')
    # water: river + canals welded, small ponds dropped, edges smoothed
    from shapely.geometry import LineString as _LS
    canals = [_LS(l).buffer(1.4, resolution=3) for l in _lines('waterway_small') + _lines('waterway_river')]
    wu = _uu([water_geom()] + canals).buffer(1.5, resolution=4).buffer(-1.5, resolution=4)
    g.append(f'<path d="{_smooth_poly_d(wu, min_area=140, it=2, simp=0.8)}" fill="{C["water"]}" fill-rule="evenodd"/>')
    # roads: two calm classes only
    g.append(f'<path d="{_ribbons(["road_secondary"], 1.3)}" fill="{C["minor"]}"/>')
    g.append(f'<path d="{_ribbons(["road_primary", "road_trunk", "road_motorway", "road_primary_con", "road_trunk_con", "road_motorway_con"], 2.6)}" fill="{C["major"]}"/>')
    _BASE = g
    return list(g)


# ---------------------------------------------------------------- one clean centre line per arterial (mask routing)
import numpy as np
from PIL import Image, ImageDraw
from skimage.graph import route_through_array
from scipy.ndimage import distance_transform_edt

SC = 2  # routing raster scale


def route(name_keys, waypoints, exact=False, extra_lines=()):
    """Single smooth centre line through the named road polylines, passing the given waypoints (map space)."""
    lines = B_lines = lines_of(name_keys, exact) + [list(l) for l in extra_lines]
    pts = [p for l in lines for p in l]
    x0 = min(p[0] for p in pts + list(waypoints)) - 20; y0 = min(p[1] for p in pts + list(waypoints)) - 20
    x1 = max(p[0] for p in pts + list(waypoints)) + 20; y1 = max(p[1] for p in pts + list(waypoints)) + 20
    w, h = int((x1 - x0) * SC) + 1, int((y1 - y0) * SC) + 1
    im = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(im)
    for l in lines:
        dr.line([((x - x0) * SC, (y - y0) * SC) for x, y in l], fill=255, width=7)
    m = np.array(im) > 0
    dt = distance_transform_edt(m)
    cost = np.where(m, 1.0 / (1 + dt), 60.0)
    path = []
    wp = [(int(round((y - y0) * SC)), int(round((x - x0) * SC))) for x, y in waypoints]
    for a, b in zip(wp[:-1], wp[1:]):
        seg, _ = route_through_array(cost, a, b, fully_connected=True, geometric=True)
        path += seg if not path else seg[1:]
    arr = np.array([(c / SC + x0, r / SC + y0) for r, c in path], float)
    k = 8
    pad = np.vstack([np.repeat(arr[:1], k, 0), arr, np.repeat(arr[-1:], k, 0)])
    sm = np.array([pad[i:i + 2 * k + 1].mean(0) for i in range(len(arr))])
    seg = np.hypot(*np.diff(sm, axis=0).T); L = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(L[-1] / 12) + 1); t = np.linspace(0, L[-1], n)
    rs = np.stack([np.interp(t, L, sm[:, 0]), np.interp(t, L, sm[:, 1])], 1)
    return [tuple(p) for p in rs]


def smooth_d(pts):
    """Catmull-Rom -> cubic Bézier path."""
    d = 'M %.1f %.1f' % pts[0]
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(len(pts) - 1, i + 2)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += ' C %.1f %.1f %.1f %.1f %.1f %.1f' % (c1 + c2 + tuple(p2))
    return d


def nearest_on(lines, pt):
    best, bd = None, 1e18
    for l in lines:
        for p in l:
            d = (p[0] - pt[0]) ** 2 + (p[1] - pt[1]) ** 2
            if d < bd: bd, best = d, p
    return best


def offset(pts, dist):
    out = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
        out.append((p[0] - dy / L * dist, p[1] + dx / L * dist))
    return out


def clip_box(pts, x0=-30, y0=-30, x1=W + 30, y1=H + 30):
    keep = [p for p in pts if x0 <= p[0] <= x1 and y0 <= p[1] <= y1]
    return keep


# ---------------------------------------------------------------- arterials (brown) + highlight centre lines
CT_NAMES = ['Đường cao tốc Thành phố Hồ Chí Minh – Long Thành – Dầu Giây',
            'Đường dẫn cao tốc Thành phố Hồ Chí Minh - Long Thành - Dầu Giây',
            'Đường dẫn cao tocc']


def arterials():
    vvk = lines_of(['Đường Võ Văn Kiệt'], True); mct = lines_of(['Mai Chí Thọ', 'Đường Mai Chí Thọ'], True)
    ct = lines_of(CT_NAMES, True)
    # An Phú interchange: where the expressway feeder meets Mai Chí Thọ
    best = None
    for a in ct:
        for p in a:
            q = nearest_on(mct, p); d = math.hypot(p[0] - q[0], p[1] - q[1])
            if best is None or d < best[0]: best = (d, p, q)
    anphu = best[2]
    R_ = {}
    R_['vvk-mct'] = route(['Đường Võ Văn Kiệt', 'Hầm Sông Sài Gòn', 'Mai Chí Thọ', 'Đường Mai Chí Thọ'],
                          [nearest_on(vvk, (-25, 1160)), (501.2, 853.7), (588.2, 855.8), anphu, (1153.3, 364.2)], exact=True)
    R_['nhc'] = route(['Tôn Đức Thắng', 'Nguyễn Hữu Cảnh', 'Cầu Sài Gòn', 'Cầu Sài Gòn 2'],
                      [(501.2, 853.7), (497.9, 693.5), (734.3, 466.6), (837.9, 457.2)], exact=True)
    vng = lines_of(['Đường Võ Nguyên Giáp'], True)
    R_['xlhn'] = route(['Đường Võ Nguyên Giáp'], [(837.9, 457.2), nearest_on(vng, (1330, -25))], exact=True)
    R_['cao-toc'] = route(CT_NAMES, [anphu, nearest_on(ct, (2065, 600))], exact=True)
    dxh = lines_of(['Đỗ Xuân Hợp', 'Cầu Đỗ Xuân Hợp'], True)
    ctp = [p for l in ct for p in l]
    dxh_end = min((p for l in dxh for p in l), key=lambda p: min((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 for q in ctp))
    R_['dxh'] = route(['Đỗ Xuân Hợp', 'Cầu Đỗ Xuân Hợp'], [nearest_on(dxh, (1290, -25)), dxh_end], exact=True)
    return R_, anphu


# ---------------------------------------------------------------- areas
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.ops import unary_union, polygonize
import json as _json

AFF = _json.load(open(ROOT / 'tools/raster_affine.json'))


def A(px, py):
    """old raster pixel (map-tong.jpg) -> OSM map space (fitted affine; used for designer-placed labels)"""
    return (AFF[0][0] * px + AFF[1][0] * py + AFF[2][0], AFF[0][1] * px + AFF[1][1] * py + AFF[2][1])


_water = None


def water_geom():
    """water as even-odd: each ring toggles (keeps islands as land)"""
    global _water
    if _water is None:
        g = Polygon()
        for sub in re.findall(r'M[^M]+', LAY['water']):
            r = [tuple(map(float, q.split())) for q in sub[1:].rstrip('Z').split('L')]
            if len(r) >= 3:
                g = g.symmetric_difference(Polygon(r).buffer(0))
        _water = g.buffer(0)
    return _water


def poly_d(geom, simplify=0.3):
    out = []
    for g in getattr(geom, 'geoms', [geom]):
        if g.geom_type != 'Polygon' or g.is_empty:
            continue
        g = g.simplify(simplify)
        ring = lambda c: 'M' + 'L'.join('%.1f %.1f' % xy for xy in list(c.coords)[:-1]) + 'Z'
        out.append(ring(g.exterior) + ''.join(ring(i) for i in g.interiors))
    return ''.join(out)


def d1_area():
    """central-city tint (designer's beige block): Điện Biên Phủ - Thị Nghè - river - Hàm Nghi/Võ Văn Kiệt - CMT8"""
    region = Polygon([(236, 700), (300, 640), (360, 600), (420, 566), (470, 578), (520, 600), (552, 622), (540, 700),
                      (512, 780), (507, 858), (420, 866), (330, 862), (290, 846), (250, 790), (236, 740)])
    big_w = unary_union([p for p in getattr(water_geom(), 'geoms', [water_geom()]) if p.area > 400])
    return region.difference(big_w.buffer(2)).buffer(-1).buffer(1)


def gold_area(mct):
    river = max(getattr(water_geom(), 'geoms', [water_geom()]), key=lambda p: p.area)   # Sông Sài Gòn
    blk = _gold_raw(mct).convex_hull.difference(river.buffer(3))
    blk = max(getattr(blk, 'geoms', [blk]), key=lambda p: p.area)
    return Polygon(blk.exterior).buffer(-1).buffer(1)   # inner lagoons stay covered: one clean block


def _gold_raw(mct):
    """Trung tâm hành chính - tài chính mới: NW lobe of Thủ Thiêm, north of Mai Chí Thọ"""
    region = Polygon([(520, 640), (600, 632), (668, 632), (700, 680), (735, 760), (700, 800), (600, 840), (520, 840)])
    south = Polygon(list(mct) + [(mct[-1][0], 2000), (mct[0][0], 2000)]).buffer(0)
    land = region.difference(water_geom().buffer(2.5)).difference(south.buffer(4))
    parts = sorted(getattr(land, 'geoms', [land]), key=lambda p: -p.area)[:1]   # the Thủ Thiêm lobe only
    return unary_union(parts).buffer(-1).buffer(1)


# ---------------------------------------------------------------- symbols (vector redraws of the designer's gold icons)
# Gold landmark icons, redrawn as clean vectors after the designer's raster icons (units = old raster px, centred).
_D = 'stroke="#fffdf6" stroke-opacity=".8" stroke-width=".7" fill="none" stroke-linecap="round"'
ICON = {
    'church': ('<path d="M-15 28.5V4h2v-12l2-3v-8l1.5-9.5 1.5 9.5v8l2 3v2l6-7 6 7v-2l2-3v-8l1.5-9.5 1.5 9.5v8l2 3v12h2v24.5z"/>'
               f'<g {_D}><circle cx="0" cy="1" r="2.4"/><path d="M-13 4h26M-9.5-4v4M9.5-4v4M-9.5 9v5M9.5 9v5M-9.5 19v5M9.5 19v5M-3.5 12v4M3.5 12v4"/></g>'
               '<path d="M-2.6 28.5v-5.2a2.6 2.6 0 0 1 5.2 0v5.2z" fill="#fffdf6" fill-opacity=".85"/>', (30, 57)),
    'hall': ('<path d="M-21 23V3l2-6h9l1 2h5v-9h-1l2-3h1v-3h4v3h1l2 3h-1v9h5l1-2h9l2 6v20z"/>'
             '<path d="M0-13v-10" stroke="currentColor" stroke-width=".9"/><path d="M0-23h4.5l-1 1.3 1 1.3H0z"/>'
             f'<g {_D}><path d="M-19 9h38M-19 16h38"/><path d="M-17 5v2.5M-13 5v2.5M13 5v2.5M17 5v2.5M-17 11.5v2.5M-13 11.5v2.5M-6 11.5v2.5M6 11.5v2.5M13 11.5v2.5M17 11.5v2.5M-17 18.5v2.5M-13 18.5v2.5M13 18.5v2.5M17 18.5v2.5M-6 4.5v2.5M6 4.5v2.5"/><circle cx="0" cy="-4.5" r="1.4"/></g>'
             '<path d="M-2.5 23v-4.5a2.5 2.5 0 0 1 5 0V23z" fill="#fffdf6" fill-opacity=".85"/>', (42, 46)),
    'theatre': ('<path d="M-21 12V-5h3v-3h13v-2h10v2h13v3h3v17z"/>'
                f'<g {_D}><path d="M-19-1h38"/><path d="M-16 2v4M-12 2v4M12 2v4M16 2v4M-16-5v2M16-5v2"/><path d="M-4.5 2V0a4.5 4.5 0 0 1 9 0v2M-2.2 2v-3M2.2 2v-3"/></g>'
                '<path d="M-7 12V8a1.6 1.6 0 0 1 3.2 0v4zM-1.6 12V8a1.6 1.6 0 0 1 3.2 0v4zM3.8 12V8a1.6 1.6 0 0 1 3.2 0v4z" fill="#fffdf6" fill-opacity=".85"/>', (42, 24)),
    'palace': ('<path d="M-29.5 12V-1h6v-5h12v-3h7v-2h9v2h7v3h12v5h6v13z"/>'
               f'<g {_D}><path d="M-27.5 2.5h55M-27.5 7.5h55"/><path d="M-25 -0.5v1.5M-21 -0.5v1.5M-17-3v4M-13-3v4M-9-3v4M9-3v4M13-3v4M17-3v4M21-0.5v1.5M25-0.5v1.5M-25 4.5v1.5M-21 4.5v1.5M-17 4.5v1.5M-13 4.5v1.5M-9 4.5v1.5M9 4.5v1.5M13 4.5v1.5M17 4.5v1.5M21 4.5v1.5M25 4.5v1.5"/><path d="M-4-6h8"/></g>'
               '<path d="M-4 12V8.5h8V12z" fill="#fffdf6" fill-opacity=".85"/>', (59, 24)),
    'market': ('<path d="M-21 16V5h3V2h3v3h9V-9l2-1V-13h2.5v-2h1v2H2v3l2 1V5h9V2h3v3h3v11z"/>'
               f'<g {_D}><circle cx="0" cy="-4.5" r="2.2"/><path d="M-19 9h12M7 9h12M-6 2h12"/></g>'
               '<path d="M-3.6 16V9.5a3.6 3.6 0 0 1 7.2 0V16z" fill="#fffdf6" fill-opacity=".85"/>', (42, 32)),
    'tower': ('<path d="M-5.3 26.5L-1.8-23.5 0.6-26.5l1.2 3 3.5 50z"/>'
              f'<g {_D}><path d="M-3.4-7.5 3.2-9.6"/><path d="M-0.4-20v42" stroke-opacity=".45"/></g>', (11, 53)),
    'paw': ('<circle r="10.5"/><g fill="#fffdf6"><ellipse cx="0" cy="3" rx="4" ry="3.4"/><ellipse cx="-4.9" cy="-2.2" rx="1.6" ry="2.1"/>'
            '<ellipse cx="-1.7" cy="-5.2" rx="1.6" ry="2.1"/><ellipse cx="1.7" cy="-5.2" rx="1.6" ry="2.1"/><ellipse cx="4.9" cy="-2.2" rx="1.6" ry="2.1"/></g>', (21, 21)),
    'landmark': ('<path d="M-8.5 42V6H-7V-8h1.5v-12H-4v-9h1.5v-6h1.7v-7h1.6v7h1.7v6H4v9h1.5v12H7V6h1.5v36z"/>'
                 f'<g {_D} stroke-opacity=".45"><path d="M0-33V40M-5 -6v46M5-6v46"/></g>', (17, 84)),
    'plane': ('<path d="M-37.5 3.5l3-8h3.5l6 5.5 30-3.6 8.8-.9 12-1.2c5-.5 8.6.6 8.9 2.4.3 1.9-3 3.4-7.8 4.3L-1 6l9 10.5H3L-11 8.2l-12.2 1.4c-6.3.7-12.6-1.4-14.3-6.1z"/>'
              '<path d="M2-1.6-8.8-12.9h4.9L13.4-2.8z"/>', (75, 26)),
    'arrow': ('<path d="M-6.5-11.5 6.5 0-6.5 11.5z"/>', (13, 23)),
    'train': ('<circle r="9.6"/><g fill="#fffdf6"><path d="M-4.6-6.2a2 2 0 0 1 2-2h5.2a2 2 0 0 1 2 2v8.4a1.5 1.5 0 0 1-1.5 1.5h-6.2a1.5 1.5 0 0 1-1.5-1.5z"/></g>'
              '<rect x="-3.2" y="-5.6" width="6.4" height="3.6" rx=".6"/><circle cx="-2.4" cy="1.2" r=".8"/><circle cx="2.4" cy="1.2" r=".8"/>'
              '<path d="M-3.4 4.6-5 7.4M3.4 4.6 5 7.4M-4.2 6.4h8.4" stroke="#fffdf6" stroke-width="1" fill="none" stroke-linecap="round"/>', (20, 20)),
}


def sym(kind, x, y, s=1.0, color=None, extra=''):
    col = color or C['icon']
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({s})" fill="{col}" color="{col}"{extra}>{ICON[kind][0]}</g>'


def text(x, y, lines, size, fill, anchor='middle', weight=None, rot=0, ls=None, cls='', lh=1.15):
    if isinstance(lines, str):
        lines = [lines]
    tr = f' transform="rotate({rot:.1f} {x:.1f} {y:.1f})"' if rot else ''
    w = f' font-weight="{weight}"' if weight else ''
    lsp = f' letter-spacing="{ls}"' if ls else ''
    y0 = y - (len(lines) - 1) * size * lh / 2
    tsp = ''.join(f'<tspan x="{x:.1f}" y="{y0 + i * size * lh + size * .35:.1f}">{t}</tspan>' for i, t in enumerate(lines))
    return f'<text class="{cls}" font-size="{size}" fill="{fill}" text-anchor="{anchor}"{w}{lsp}{tr}>{tsp}</text>'


def along(names, near, exact=True):
    """point + angle on the named road closest to `near` (for road labels)"""
    best = None
    for l in lines_of(names, exact):
        for i in range(len(l) - 1):
            a, b = l[i], l[i + 1]
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            d = (m[0] - near[0]) ** 2 + (m[1] - near[1]) ** 2
            if best is None or d < best[0]:
                ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
                if ang > 90: ang -= 180
                if ang < -90: ang += 180
                best = (d, m, ang)
    return best[1], best[2]


def bracket(cx, cy, ang, L=16, G=6, dashed=False, col=None):
    col = col or C['bridge']
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
    out = []
    for sgn in (-1, 1):
        ox, oy = cx + nx * G * sgn, cy + ny * G * sgn
        p1 = (ox - ux * L / 2 + nx * 3 * sgn, oy - uy * L / 2 + ny * 3 * sgn); p2 = (ox - ux * L / 2, oy - uy * L / 2)
        p3 = (ox + ux * L / 2, oy + uy * L / 2); p4 = (ox + ux * L / 2 + nx * 3 * sgn, oy + uy * L / 2 + ny * 3 * sgn)
        out.append('M%.1f %.1fL%.1f %.1fL%.1f %.1fL%.1f %.1f' % (*p1, *p2, *p3, *p4))
    da = ' stroke-dasharray="2.4 1.8"' if dashed else ''
    return f'<path d="{"".join(out)}" fill="none" stroke="{col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"{da}/>'


def road_dir(names, near):
    (x, y), ang = along(names, near)
    return x, y, ang


def transit_lines():
    out = []
    for k in ('transit', 'transit_tunnel'):
        for sub in re.findall(r'M[^M]+', LAY.get(k, '')):
            out.append([tuple(map(float, q.split())) for q in sub[1:].split('L')])
    return out


def snap(lines, pt):
    return nearest_on(lines, pt)


SPEC = []   # live label specs (js/overview-labels.js) — the app places them in screen space


def spec(**kw):
    SPEC.append(kw)


def build():
    SPEC.clear()
    R_, anphu = arterials()
    mct_seg = [p for p in R_['vvk-mct'] if 480 <= p[0] <= 900]
    g = ['<g class="ov-base">'] + base_layers()[:1]
    g.append(f'<path d="{_smooth_poly_d(d1_area(), it=2, simp=1.5)}" fill="{C["d1"]}"/>')
    g += base_layers()[1:]
    g.append(f'<path d="{_smooth_poly_d(gold_area(mct_seg), it=2, simp=2.5)}" fill="{C["gold"]}"/>')
    g.append('</g>')

    # --- rail: Metro 1 (OSM), Metro 2 (planned, schematic along Mai Chí Thọ), North–South elevated rail (planned)
    tl = transit_lines()
    g.append('<g class="ov-rail" fill="none" stroke-linecap="round">')
    g.append(f'<path d="{"".join(dpoly(l) for l in tl)}" stroke="{C["metro1"]}" stroke-width="1.1" stroke-dasharray="3.2 2.6"/>')
    bt = P(106.69815, 10.77135)
    ga = A(1159, 489)   # Nhà ga Thủ Thiêm (designer's spot, just south-west of Nút giao An Phú)
    m2 = offset([p for p in R_['vvk-mct'] if 520 <= p[0] <= ga[0] - 24 and p[1] >= ga[1] + 10], -8)
    metro2 = [bt, (470, 842), (505, 838)] + m2 + [ga]
    g.append(f'<path d="{smooth_d(metro2)}" stroke="{C["metro1"]}" stroke-width="1.1" stroke-dasharray="3.2 2.6"/>')
    ct_off = offset(R_['cao-toc'], 7)
    rail = [ga, (anphu[0] + 6, anphu[1] + 8)] + [p for p in ct_off if p[0] > anphu[0] + 14 and p[0] < 1560]
    g.append(f'<path d="{smooth_d(rail)}" stroke="{C["rail"]}" stroke-width="2" stroke-dasharray="0.1 4"/>')
    g.append('</g>')

    # --- brown arterials (drawn; the app adds the light/hover layer on top)
    g.append(f'<g class="ov-arterials" fill="none" stroke="{C["brown"]}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">')
    for k, pts in R_.items():
        g.append(f'<path d="{smooth_d(pts)}"/>')
    g.append('</g>')
    g.append(f'<circle cx="{anphu[0]:.1f}" cy="{anphu[1]:.1f}" r="7.5" fill="none" stroke="{C["brown"]}" stroke-width="2.4"/>')
    g.append(f'<circle cx="{anphu[0]:.1f}" cy="{anphu[1]:.1f}" r="3.2" fill="{C["brown"]}"/>')

    # --- bridges & tunnel (brackets)
    def mid(n):
        pts = [p for l in lines_of([n], True) for p in l]
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    def span(a, b):
        ln = LineString([a, b]); x = ln.intersection(water_geom())
        c = x.centroid if not x.is_empty else ln.interpolate(0.5, normalized=True)
        return (c.x, c.y), math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    br = [  # (spans read from the OSM bridge ways; label offset)
        (span((717, 481), (838, 458)), ['CẦU', 'SÀI GÒN'], (6, 22)),
        (span((639, 606), (686, 695)), ['CẦU', 'THỦ THIÊM'], (-30, 2)),
        (span((483, 680), (583, 750)), ['CẦU', 'BA SON'], (-24, 14)),
        (span(P(106.706718, 10.772398), P(106.709733, 10.774126)), ['CẦU', 'ĐI BỘ'], (22, -10)),
        (span((443, 892), (588, 856)), ['HẦM', 'THỦ THIÊM'], (-4, 22)),
    ]
    g.append('<g class="ov-bridges">')
    labels = []
    for ((x, y), ang), lab, off in br:
        g.append(bracket(x, y, ang, L=20, G=5.5))
        labels.append(text(x + off[0], y + off[1], lab, 6.2, '#5e5a4c', ls='.04em'))
        spec(k='bridge', t=lab, x=x, y=y, w=20, h=17, p=68, z=0)
    for (rx, ry), lab, ang in [((690, 868), ['CẦU', 'THỦ THIÊM 3'], 62), ((850, 912), ['CẦU', 'THỦ THIÊM 4'], 90)]:
        x, y = A(rx, ry)
        g.append(bracket(x, y, ang, L=18, G=6, dashed=True))
        labels.append(text(x + (34 if ang < 80 else -30), y + 4, lab, 6.2, '#5e5a4c', ls='.04em'))
        spec(k='bridge', t=lab, x=x, y=y, w=18, h=18, p=60, z=1.2, sub='Dự kiến')
    g.append('</g>')

    # --- stations
    st = ['<g class="ov-stations">']
    for rx, ry in [(683, 402), (1056, 312)]:
        x, y = snap(tl, A(rx, ry)); st.append(sym('train', x, y, .8))
    st.append(sym('train', bt[0], bt[1], .8))
    for rx, ry in [(600, 578), (818, 340), (468, 455)]:
        x, y = snap(tl, A(rx, ry)); st.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.4" fill="{C["icon"]}"/>')
    for i in (0.2, 0.42, 0.62, 0.82):
        x, y = metro2[int(len(metro2) * i)]; st.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.4" fill="{C["metro2"]}"/>')
    st.append(sym('train', ga[0], ga[1], 1.75, C['metro2']))
    st.append('</g>')
    g += st

    # --- landmarks (true OSM positions) with gold captions
    K_ = 0.95   # raster px -> map units
    # kind, lon, lat, caption, caption side, icon scale, small cartographic nudge (dx, dy) so neighbours don't touch
    LP = {'church': 72, 'hall': 64, 'theatre': 65, 'palace': 70, 'market': 71, 'tower': 69, 'paw': 63, 'landmark': 76}
    lm = [('church', 106.69904, 10.77977, ['NHÀ THỜ', 'ĐỨC BÀ'], 'below', .72, (0, 0)),
          ('hall', 106.70092, 10.77659, ['UBND', 'TPHCM'], 'below', .62, (-10, 2)),
          ('theatre', 106.70325, 10.77675, ['NHÀ HÁT', 'THÀNH PHỐ'], 'right', .62, (6, 0)),
          ('palace', 106.69549, 10.77703, ['DINH ĐỘC LẬP'], 'below', .62, (-6, 0)),
          ('market', 106.69804, 10.77253, ['CHỢ BẾN THÀNH'], 'left', .66, (-8, -2)),
          ('tower', 106.70486, 10.77068, ['TÒA NHÀ', 'BITEXCO'], 'left', .72, (0, -2)),
          ('paw', 106.70634, 10.78784, ['SỞ THÚ'], 'below', .75, (0, 0)),
          ('landmark', 106.72259, 10.79583, ['LANDMARK 81'], 'left', .85, (0, 0))]
    g.append('<g class="ov-landmarks">')
    for kind, lon, lat, cap, where, sc, (ndx, ndy) in lm:
        x, y = P(lon, lat); x += ndx; y += ndy; w, h = ICON[kind][1]; w *= sc; h *= sc
        y -= h / 2   # icon stands on its ground point
        g.append(sym(kind, x, y, sc))
        spec(k='poi', t=cap, x=x, y=y, w=w, h=h, p=LP[kind], z=0, pref=where)
        if where == 'below':
            labels.append(text(x, y + h / 2 + 5 + 3.6 * len(cap), cap, 6.2, '#a88d68', ls='.04em', cls='ov-cap'))
        else:
            sgn = 1 if where == 'right' else -1
            labels.append(text(x + sgn * (w / 2 + 4), y + h / 2 - 3.6 * len(cap), cap, 6.2, '#a88d68', anchor='start' if sgn > 0 else 'end', ls='.04em', cls='ov-cap'))
    x, y = A(293, 311); g.append(sym('plane', x, y, K_))
    g.append(f'<path d="M{x - 18:.1f} {y + 16:.1f}h36" stroke="{C["icon"]}" stroke-width=".9"/>')
    labels.append(text(x, y + 30, ['SÂN BAY QUỐC TẾ', 'TÂN SƠN NHẤT'], 6.6, '#2d2824', ls='.03em'))
    spec(k='air', t=['SÂN BAY QUỐC TẾ', 'TÂN SƠN NHẤT'], x=x, y=y + 2, w=75 * K_, h=34, p=80, z=0, pref='below')
    x, y = A(1437, 410); g.append(sym('plane', x, y, .72)); g.append(sym('arrow', *A(1490, 425), K_))
    g.append(f'<path d="M{x - 18:.1f} {y + 12:.1f}h36" stroke="{C["icon"]}" stroke-width=".9"/>')
    labels.append(text(x, y + 26, ['SÂN BAY QUỐC TẾ', 'LONG THÀNH'], 6.6, '#2d2824', ls='.03em'))
    spec(k='air', t=['SÂN BAY QUỐC TẾ', 'LONG THÀNH'], x=x, y=y + 2, w=75 * .72, h=28, p=79, z=0, pref='below')
    g.append('</g>')

    # --- green captions (Lâm viên), centre caption
    labels.append(text(*A(705, 610), ['TRUNG TÂM HÀNH CHÍNH', '- TÀI CHÍNH MỚI', 'TP.HCM'], 6.4, '#4b3b26', ls='.02em'))
    labels.append(text(*A(797, 852), ['LÂM VIÊN', 'SINH THÁI'], 6.6, '#3f4a39', ls='.03em'))
    labels.append(text(*A(1003, 815), ['LÂM VIÊN', 'SINH THÁI'], 6.6, '#3f4a39', ls='.03em'))
    labels.append(text(ga[0] - 22, ga[1] + 2, ['NHÀ GA', 'THỦ THIÊM'], 11, '#2d2824', weight=600, anchor='end', cls='ov-ward'))
    labels.append(text(anphu[0] - 12, anphu[1] - 14, ['NÚT GIAO', 'AN PHÚ'], 6.2, '#2d2824', anchor='end', ls='.03em'))
    spec(k='hub', t=['NHÀ GA', 'THỦ THIÊM'], x=ga[0], y=ga[1], w=34, h=34, p=100, z=0, pref='left')
    spec(k='junc', t=['NÚT GIAO', 'AN PHÚ'], x=anphu[0], y=anphu[1], w=16, h=16, p=62, z=0, pref='left')
    # area labels: shown only while the words fit inside their area
    def ring(geom, tol):
        g_ = max(getattr(geom, 'geoms', [geom]), key=lambda q: q.area).simplify(tol)
        return [[round(a, 1), round(b, 1)] for a, b in list(g_.exterior.coords)[:-1]]
    gp = gold_area(mct_seg)
    spec(k='area', t=['TRUNG TÂM HÀNH CHÍNH', 'TÀI CHÍNH MỚI'], x=gp.representative_point().x, y=gp.representative_point().y,
         poly=ring(gp, 1.5), p=95, z=0, tone='gold')
    greens = [Polygon(r).buffer(0) for r in ([tuple(map(float, q.split())) for q in sub[1:].rstrip('Z').split('L')]
                                             for sub in re.findall(r'M[^M]+', LAY['green'])) if len(r) >= 3]
    gu = unary_union(greens).buffer(6).buffer(-6)
    for rp in [(797, 852), (1003, 815)]:
        pt = Point(*A(*rp))
        part = min(getattr(gu, 'geoms', [gu]), key=lambda q: q.distance(pt))
        from shapely.ops import polylabel
        c = polylabel(part.simplify(1.5), 1.0)
        spec(k='area', t=['LÂM VIÊN', 'SINH THÁI'], x=c.x, y=c.y, poly=ring(part, 1.5), p=46, z=0, tone='green')
    return g, labels, R_, anphu, metro2, rail


WARDS = [  # raster position of the designer's ward labels (old map-tong.jpg) -> placed through the fitted affine
    ('BÌNH THẠNH', 572, 140), ('GIA ĐỊNH', 478, 320), ('THẠNH MỸ TÂY', 738, 282), ('TÂN ĐỊNH', 355, 438),
    ('PHÚ NHUẬN', 135, 428), ('NHIÊU LỘC', 145, 575), ('XUÂN HÒA', 330, 560), ('HÒA HƯNG', 135, 670),
    ('BẾN THÀNH', 300, 700), ('CẦU ÔNG LÃNH', 340, 890), ('AN ĐÔNG', 145, 955), ('KHÁNH HỘI', 575, 940),
    ('CHÁNH HƯNG', 195, 1180), ('TÂN HƯNG', 548, 1220), ('TÂN THUẬN', 960, 970), ('CÁT LÁI', 1585, 860),
    ('BÌNH TRƯNG', 1328, 340), ('PHƯỚC LONG', 1470, 145), ('BÌNH QUỚI', 965, 275), ('AN KHÁNH', 962, 500),
]

ROADS = [  # (label, OSM names, raster label position)
    ('ĐIỆN BIÊN PHỦ', ['Đường Điện Biên Phủ'], (495, 385)), ('ĐINH TIÊN HOÀNG', ['Đường Đinh Tiên Hoàng'], (470, 475)),
    ('NGUYỄN THỊ MINH KHAI', ['Đường Nguyễn Thị Minh Khai'], (550, 440)), ('HAI BÀ TRƯNG', ['Đường Hai Bà Trưng'], (485, 600)),
    ('NGUYỄN HỮU CẢNH', ['Nguyễn Hữu Cảnh'], (590, 520)), ('CÁCH MẠNG THÁNG 8', ['Đường Cách Mạng Tháng Tám'], (270, 690)),
    ('TRẦN HƯNG ĐẠO', ['Đường Trần Hưng Đạo'], (365, 830)), ('VÕ VĂN KIỆT', ['Đường Võ Văn Kiệt'], (322, 925)),
    ('NGUYỄN TẤT THÀNH', ['Đường Nguyễn Tất Thành'], (635, 915)), ('MAI CHÍ THỌ', ['Mai Chí Thọ', 'Đường Mai Chí Thọ'], (657, 762)),
    ('MAI CHÍ THỌ', ['Mai Chí Thọ', 'Đường Mai Chí Thọ'], (1005, 612)), ('NGUYỄN CƠ THẠCH', ['Nguyễn Cơ Thạch'], (790, 660)),
    ('TRẦN NÃO', ['Trần Não'], (905, 430)), ('LƯƠNG ĐỊNH CỦA', ['Lương Định Của'], (1015, 470)),
    ('XA LỘ HÀ NỘI', ['Đường Võ Nguyên Giáp'], (975, 335)), ('NGUYỄN DUY TRINH', ['Nguyễn Duy Trinh'], (1310, 480)),
    ('NGUYỄN THỊ ĐỊNH', ['Nguyễn Thị Định'], (1360, 600)), ('ĐỒNG VĂN CỐNG', ['Đồng Văn Cống'], (1300, 625)),
    ('ĐỖ XUÂN HỢP', ['Đỗ Xuân Hợp'], (1568, 175)), ('VÕ CHÍ CÔNG', ['Võ Chí Công'], (1425, 860)),
    ('CAO TỐC LONG THÀNH - DẦU GIÂY', CT_NAMES, (1370, 390)),
]


def labels_text(R_, metro2, rail):
    out = []
    for nm, rx, ry in WARDS:
        x, y = A(rx, ry)
        out.append(text(x, y, ['PHƯỜNG', nm], 11, '#2d2824', weight=600, ls='.02em', cls='ov-ward'))
    for lab, names, rp in ROADS:
        (x, y), ang = along(names, A(*rp))
        nx, ny = -math.sin(math.radians(ang)), math.cos(math.radians(ang))
        side = 7 if lab in ('MAI CHÍ THỌ', 'VÕ VĂN KIỆT') else -6
        out.append(text(x + nx * side, y + ny * side, lab, 5.4, '#616356', rot=ang, ls='.06em', cls='ov-road'))
    # rail captions
    def on(path, f, d=-7):
        i = int(len(path) * f); a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        if ang > 90: ang -= 180
        if ang < -90: ang += 180
        nx, ny = -math.sin(math.radians(ang)), math.cos(math.radians(ang))
        return path[i][0] + nx * d, path[i][1] + ny * d, ang
    for f in (0.2, 0.74):
        x, y, a = on(metro2, f, -6); out.append(text(x, y, 'METRO 2', 7.6, '#2d2824', weight=500, rot=a, ls='.04em'))
    x, y, a = on(rail, 0.5, 9); out.append(text(x, y, 'TUYẾN ĐƯỜNG SẮT TRÊN CAO BẮC NAM', 5.2, '#616356', rot=a, ls='.05em', cls='ov-road'))
    tl = transit_lines(); m1 = max(tl, key=len)
    x, y, a = on(m1, 0.55, -7); out.append(text(x, y, 'METRO 1', 7.6, '#2d2824', weight=500, rot=a, ls='.04em'))
    # river
    for rp, ang in [((830, 495), -48), ((1120, 720), -52)]:
        x, y = A(*rp); out.append(text(x, y, 'SÔNG SÀI GÒN', 6.4, '#8b93a1', rot=ang, ls='.12em'))
    return out


# ---------------------------------------------------------------- live labels (js/overview-labels.js)
ART = [  # arterial names: (label, route key, keep-point filter)
    ('VÕ VĂN KIỆT', 'vvk-mct', lambda p: p[0] < 496), ('MAI CHÍ THỌ', 'vvk-mct', lambda p: p[0] > 596),
    ('NGUYỄN HỮU CẢNH', 'nhc', lambda p: p[1] < 686), ('VÕ NGUYÊN GIÁP', 'xlhn', lambda p: True),
    ('CAO TỐC LONG THÀNH – DẦU GIÂY', 'cao-toc', lambda p: True), ('ĐỖ XUÂN HỢP', 'dxh', lambda p: True)]
ART_OSM = {'Đường Võ Văn Kiệt', 'Mai Chí Thọ', 'Đường Mai Chí Thọ', 'Nguyễn Hữu Cảnh', 'Đường Võ Nguyên Giáp', 'Đỗ Xuân Hợp',
           'Tôn Đức Thắng', 'Đường Tôn Đức Thắng', 'Đường Nguyễn Hữu Cảnh', 'Đường Đỗ Xuân Hợp', *CT_NAMES}
SKIP = re.compile(r'^(Cầu|Hầm|Dẫn|Hướng|Ga |Đường Vào|Nút|Vòng|Cao tốc|Đường dẫn|Đường cao tốc)|Tunnel|Ramp', re.I)
CLASS_W = {'motorway': 5, 'trunk': 4, 'primary': 3, 'secondary': 2, 'tertiary': 1}


def _pts(l, nd=1):
    return [[round(x, nd), round(y, nd)] for x, y in l]


def _road_classes():
    """road name -> OSM class (majority vote of its segments against the classed road layers)"""
    from shapely.strtree import STRtree
    geoms, cls = [], []
    for c in CLASS_W:
        for k in (f'road_{c}', f'road_{c}_con'):
            for l in _lines(k):
                geoms.append(LineString(l)); cls.append(c)
    tree = STRtree(geoms)
    out = {}
    for n, polys in NAMES.items():
        votes = {}
        for poly in polys:
            if len(poly) < 2: continue
            m = LineString(poly).interpolate(.5, normalized=True)
            i = tree.query_nearest(m, max_distance=1.5)
            if len(i): votes[cls[i[0]]] = votes.get(cls[i[0]], 0) + LineString(poly).length
        if votes: out[n] = max(votes, key=votes.get)
    return out


def _merged(names, min_len=40):
    from shapely.ops import linemerge
    segs = [LineString([(round(x * 2) / 2, round(y * 2) / 2) for x, y in l]) for l in lines_of(names, True) if len(l) > 1]
    if not segs: return []
    u = unary_union(segs)
    m = linemerge(u) if u.geom_type == 'MultiLineString' else u
    vis = Polygon([(0, 183), (1647, 183), (1647, 1471), (0, 1471)]).buffer(40)
    out = []
    for g in getattr(m, 'geoms', [m]):
        g = g.intersection(vis)
        for q in getattr(g, 'geoms', [g]):
            if q.geom_type == 'LineString' and q.length >= min_len:
                out.append(_pts(q.simplify(.6).coords))
    return out


def _ward_spot(x, y, name, obst):
    """nudge the designer's ward point to the nearest spot whose label box stays clear of rivers, arterials, icons"""
    from shapely.geometry import box
    w, h = max(len(name) * 7.4 + 10, 54), 28
    best = None
    for r in range(0, 49, 4):
        for k in range(max(1, r // 2)):
            a = 2 * math.pi * k / max(1, r // 2)
            cx, cy = x + r * math.cos(a), y + r * math.sin(a)
            b = box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
            cost = obst.intersection(b).area / (w * h) * 400 + r
            if best is None or cost < best[0]: best = (cost, cx, cy)
        if best[0] < r + 4: break
    return best[1], best[2]


def label_specs(R_, anphu, metro2, rail):
    from shapely.ops import polylabel
    items = [dict(d) for d in SPEC]
    for it in items:   # area anchors: pole of inaccessibility, so a label sits in the roomiest spot
        if it['k'] == 'area':
            c = polylabel(Polygon(it['poly']), 1.0); it['x'], it['y'] = c.x, c.y
    # obstacles for ward labels: big water, arterials, icons, Sala zone
    big_w = unary_union([p for p in getattr(water_geom(), 'geoms', [water_geom()]) if p.area > 400])
    obst = [big_w] + [LineString(v).buffer(5) for v in R_.values()]
    obst += [Polygon([(i['x'] - i['w'] / 2, i['y'] - i['h'] / 2), (i['x'] + i['w'] / 2, i['y'] - i['h'] / 2),
                      (i['x'] + i['w'] / 2, i['y'] + i['h'] / 2), (i['x'] - i['w'] / 2, i['y'] + i['h'] / 2)])
             for i in items if 'w' in i]
    obst += [Polygon(i['poly']) for i in items if i['k'] == 'area' and i.get('tone') == 'gold']
    obst = unary_union(obst)
    for nm, rx, ry in WARDS:
        x, y = _ward_spot(*A(rx, ry), nm, obst)
        items.append(dict(k='ward', t=nm, x=x, y=y, p=50, z=0))
    # arterials (the routed centre lines the map draws), one item per name
    for lab, key, keep in ART:
        pts = [p for p in R_[key] if keep(p) and -40 <= p[0] <= 1690 and 140 <= p[1] <= 1510]
        items.append(dict(k='art', t=lab, lines=[_pts(LineString(pts).simplify(.5).coords)], p=90, z=0))
    # other named roads: designer's list first, then the OSM primary/secondary network as you zoom in
    cls = _road_classes()
    seen = set()
    for lab, names, _ in ROADS:
        if set(names) & ART_OSM or lab in seen: continue
        seen.add(lab)
        ln = _merged(names)
        if ln: items.append(dict(k='road', t=lab, lines=ln, p=40, z=0.9))
    shown = {n for _, names, _ in ROADS for n in names}
    for n, c in cls.items():
        if n in shown or n in ART_OSM or SKIP.search(n) or c not in ('primary', 'secondary', 'trunk', 'tertiary'): continue
        lab = re.sub(r'^Đường\s+', '', n.replace('Ð', 'Đ')).upper()
        if lab in seen or lab in {a[0] for a in ART} | {'TÔN ĐỨC THẮNG'} or len(lab.replace(' ', '')) < 5 or not re.search(r'[A-ZĐ]{2}', lab): continue
        ln = _merged([n], 50)
        tot = sum(LineString(l).length for l in ln)
        if tot < 90: continue
        seen.add(lab)
        major = c in ('primary', 'trunk')
        items.append(dict(k='road', t=lab, lines=ln, p=(32 if major else 24 if c == 'secondary' else 16) + min(6, tot / 150),
                          z=1.35 if major else 1.8 if c == 'secondary' else 2.5))
    # transit
    m1 = max(transit_lines(), key=len)
    items.append(dict(k='line', t='METRO 1', lines=[_pts(LineString(m1).simplify(.5).coords)], p=78, z=0, tone='m1'))
    items.append(dict(k='line', t='METRO 2', lines=[_pts(metro2)], p=77, z=0, tone='m2'))
    items.append(dict(k='line', t='ĐƯỜNG SẮT TRÊN CAO BẮC – NAM', lines=[_pts(rail)], p=36, z=1.15, tone='rail'))
    # Sông Sài Gòn: wide reaches of the OSM centre line; the app keeps repeats far apart
    from shapely.ops import linemerge
    river = max(getattr(water_geom(), 'geoms', [water_geom()]), key=lambda p: p.area); bd = river.boundary
    keep = []
    for l in _lines('waterway_river'):
        q = LineString([(round(x * 2) / 2, round(y * 2) / 2) for x, y in l])
        if q.length > 0 and river.buffer(3).contains(q) and min(bd.distance(q.interpolate(f, normalized=True)) for f in (.25, .5, .75)) > 13:
            keep.append(q)
    u = unary_union(keep); m = linemerge(u) if u.geom_type == 'MultiLineString' else u
    for g in sorted(getattr(m, 'geoms', [m]), key=lambda g: -g.length):
        if g.length < 200: break
        c = _chaikin(list(g.simplify(1.5).coords) + [g.coords[-1]], 2)[:-1]
        items.append(dict(k='water', t='SÔNG SÀI GÒN', lines=[_pts(c)], p=85, z=0, grp='river'))
    for it in items:
        for f in ('x', 'y', 'w', 'h', 'p'):
            if f in it: it[f] = round(it[f], 1)
    return items


def write_labels(R_, anphu, metro2, rail):
    items = label_specs(R_, anphu, metro2, rail)
    js = ('/* generated by tools/build_overview_svg.py — overview labels placed live by app.js (map units; OSM data © OpenStreetMap contributors) */\n'
          'window.SALA_OV_LABELS = ' + json.dumps({'items': items}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(ROOT / 'js/overview-labels.js', 'w', encoding='utf-8').write(js)
    print('labels', len(items), len(js))


def svg_doc(view=(0, 183, 1647, 1288), with_labels=False):
    """the app's map carries no text: labels are placed live (js/overview-labels.js); with_labels=True for a static print"""
    g, labels, R_, anphu, metro2, rail = build()
    labels = labels + labels_text(R_, metro2, rail)
    labels.append(text(8, 1463, '© OpenStreetMap contributors', 7, '#8a7f70', anchor='start', cls='ov-attrib'))
    svg_doc.parts = (R_, anphu, metro2, rail)
    if not with_labels: labels = []
    body = ''.join(g) + '<g class="ov-labels" font-family="\'Optima VU\',\'Alegreya Sans\',Optima,sans-serif">' + ''.join(labels) + '</g>'
    vb = ' '.join(str(v) for v in view)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" class="mm-ov-svg" viewBox="{vb}" preserveAspectRatio="xMidYMid slice" '
            f'aria-label="Bản đồ vị trí Hệ sinh thái SALA — dữ liệu © OpenStreetMap contributors">' + body + '</svg>'), R_, anphu


def write_app():
    """assets/map/overview.svg + js/overview-svg.js (inline, so labels use the page fonts) + data.js geometry"""
    doc, R_, anphu = svg_doc()
    (ROOT / 'assets/map').mkdir(parents=True, exist_ok=True)
    open(ROOT / 'assets/map/overview.svg', 'w', encoding='utf-8').write(doc)
    open(ROOT / 'assets/map/overview-print.svg', 'w', encoding='utf-8').write(svg_doc(with_labels=True)[0])
    write_labels(*svg_doc.parts)
    # then bake it for the app: node tools/bake_overview.cjs  -> assets/img/map-overview.webp
    # highlight paths for the 4 interactive axes (same ids/names as before)
    paths = {'vvk-mct': R_['vvk-mct'], 'nhc-xlhn': R_['nhc'], 'cao-toc': R_['cao-toc'], 'do-xuan-hop': R_['dxh']}
    dp = re.compile(r"(\{ id: '(%s)', name: '[^']*', dur: \d+,\n      d: ')[^']*(' \})" % '|'.join(paths))
    data = open(ROOT / 'js/data.js', encoding='utf-8').read()
    data, n = dp.subn(lambda m: m.group(1) + smooth_d([p for p in paths[m.group(2)]]) + m.group(3), data)
    # Sala zone + pin: designer placement carried over through the fitted raster->OSM affine
    def to_raster(x, y): return (x / K, (y - 183) / K)
    zm = re.search(r"zone: \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}", data)
    pm = re.search(r"pin: \{ x: ([\d.]+), y: ([\d.]+) \}", data)
    if '/* osm */' not in data:
        zx, zy, zw, zh = map(float, zm.groups()); px, py = map(float, pm.groups())
        nx, ny = A(*to_raster(zx, zy)); nw, nh = zw * AFF[0][0], zh * AFF[1][1]
        npx, npy = A(*to_raster(px, py))
        data = data.replace(zm.group(0), "zone: { x: %.1f, y: %.1f, w: %.1f, h: %.1f } /* osm */" % (nx, ny, nw, nh))
        data = data.replace(pm.group(0), "pin: { x: %.1f, y: %.1f }" % (npx, npy))
    open(ROOT / 'js/data.js', 'w', encoding='utf-8').write(data)
    print('svg', len(doc), 'paths replaced', n)


if __name__ == '__main__' and sys.argv[1:2] == ['app']:
    write_app()
elif __name__ == '__main__':
    doc, R_, anphu = svg_doc()
    out = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / 'assets/map/overview.svg')
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    open(out, 'w', encoding='utf-8').write(doc)
    print(out, len(doc))
