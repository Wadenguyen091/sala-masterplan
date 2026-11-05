/* SALA — Interactive master plan map engine (v2, GSAP)
   Built from Figma section 31:3900 "UI MASTER PLAN SECTION".
   Layouts:  data-mm="section" (website section)  ·  data-mm="page" (full-screen Masterplan page)
   Motion:   GSAP 3 (core) — camera tweens with inertia, cloud fly-through timeline,
             staggered marker reveals, drawn highlight strokes, road light runs.          */
(function () {
  'use strict';

  var D = window.SALA_DATA;
  var I = window.SALA_ICONS;
  var G = window.gsap;
  var IMG = 'assets/img/';
  var NS = 'http://www.w3.org/2000/svg';

  var PROJ_POLE = 84;   /* project flag pole height (px, desktop); phones use 0.72× — v8.7 smaller flags */

  /* project sales status → panel header label (colours in style.css, Figma text/success, text/info, text/alert) */
  var SALE_STATUS = { open: { label: 'Đang mở bán' }, soon: { label: 'Sắp mở bán' }, closed: { label: 'Chưa mở bán' } };

  var CONFIG = {
    /* v9.6: urban 3D map background = the client's graded render; set to null to go back to map-3d.webp + CSS grade */
    master3dBaked: 'map-3d-v95.webp',
    /* views: 'overview' (location map) → click the SALA pin → 'tod' (green TOD plan, still in
       "Bản đồ tổng quan" mode) · 'urban' (3D master map) · 'amenity' (top-view amenities) */
    mapOf: { overview: 'overview', tod: 'plan2d', urban: 'master3d', amenity: 'amenity' }
  };

  var MAPS = {
    overview: { w: 2030, h: 1471, bounds: [175.9, 386.8, 1413.7, 1148.7] },   /* = the v8.4 artwork (3402 x 2094) registered on the old HD map */
    plan2d: { w: 2030, h: 1471, bounds: [0, 0, 2030, 1471] },
    master3d: { w: 1648, h: 920, bounds: [0, 0, 1648, 920] },
    amenity: { w: 1648, h: 920, bounds: [0, 0, 1648, 920] }   /* v9.7: Tiện ích uses the urban 3D render too */
  };

  var LAYOUTS = {
    'section-desktop': { dw: 1360, dh: 680, cams: { overview: [793, 809, 1], plan2d: [1243, 527, 1], master3d: [855, 438, 1], amenity: [855, 438, 1] } },
    'section-mobile': { dw: 390, dh: 680, cams: { overview: [798, 913, 0.609], plan2d: [1363, 396, 1], master3d: [676, 382, 1.1956], amenity: [676, 382, 1.1956] } },
    'page-desktop': { dw: 1440, dh: 810, cams: { overview: [792, 808.5, 1.405], plan2d: [1230, 503, 1], master3d: [886.4, 418.4, 1.289], amenity: [886.4, 418.4, 1.289] } },
    'page-landscape': { dw: 932, dh: 430, cams: { overview: [776, 839, 0.7026], plan2d: [1279, 532, 0.6207], master3d: [789.5, 320.4, 0.9667], amenity: [789.5, 320.4, 0.9667] } }
  };

  /* ---------- helpers ---------- */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function svgEl(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  /* ---------- path lights: every road light fades to 0% at its head and its tail ----------
     A light is the road stroked in the light colour (soft glow + bright core), revealed only through a
     mask made of soft radial dots sitting at fixed points along the path. Each dot's opacity comes from a
     profile function of its arc position, so brightness is shaped *along the path*: it never starts or
     ends on a solid edge — not at the comet's head or tail, and not at the road's own start/end
     (every profile is multiplied by an end taper that is 0 at both ends of the road). */
  var LIGHT_N = 0;
  function cometGradDefs(id) {
    return '<radialGradient id="' + id + '"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff" stop-opacity=".6"/>' +
      '<stop offset=".7" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>';
  }
  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function taper(s, L, E) { return smooth(s / E) * smooth((L - s) / E); }
  var PROFILES = {
    /* comet: soft head (gaussian ahead of the front) + long tail fading to 0 behind it */
    comet: function (s, L, st, o) {
      var x = st.front - s, v;
      if (x < 0) v = Math.exp(-(x * x) / (o.head * o.head));
      else if (x < o.tail) v = Math.pow(1 - x / o.tail, 1.7);
      else return 0;
      return v * taper(s, L, o.endFade);
    },
    /* band: the whole road lit, tapered at both ends; st.p wipes it on with a soft leading edge */
    band: function (s, L, st, o) {
      var W = L * 0.3, f = st.p * (L + W);
      return taper(s, L, L * o.bandFade) * smooth((f - s) / W);
    }
  };
  /* ---------- light engine: all road / outline lights of a map are drawn on ONE screen-space canvas ----------
     (the previous per-light SVG masks + blur filters had to be re-rasterised every frame and made pan/zoom lag).
     Each light keeps its path only for geometry (sampled once); every frame the engine strokes short segments whose
     alpha follows the light's profile, in screen space with the map camera, so it stays crisp at any zoom. */
  function lightEngine(svg) {
    if (svg.__eng) return svg.__eng;
    var host = svg.__host;   /* { app, map } set by the map builder */
    var cv = el('canvas', 'mm-lightcv'), ctx = cv.getContext('2d');
    var L = host.app.layers[host.map];
    L.el.insertBefore(cv, L.markersEl);
    var eng = svg.__eng = { cv: cv, ctx: ctx, lights: [], w: 0, h: 0 };
    eng.tick = function () {
      var app = host.app;
      if (L.el.style.visibility === 'hidden' || !app.fw) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(app.fw * dpr), H = Math.round(app.fh * dpr);
      if (W !== eng.w || H !== eng.h) { cv.width = eng.w = W; cv.height = eng.h = H; cv.style.width = app.fw + 'px'; cv.style.height = app.fh + 'px'; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      var cam = L.cam, k = cam.s * dpr;
      ctx.setTransform(k, 0, 0, k, cam.tx * dpr, cam.ty * dpr);
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      for (var i = 0; i < eng.lights.length; i++) eng.lights[i].paint(ctx);
    };
    G.ticker.add(eng.tick);
    return eng;
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
  }
  /* o: { color, core, width, glowWidth, spacing, profile, head, tail, endFade, bandFade } (sizes in the path's own units) */
  function makeLight(svg, parent, d, o) {
    var geo = svgEl('path', { 'class': 'mm-light-geo', d: d, fill: 'none', stroke: 'none' });
    parent.appendChild(geo);
    var eng = lightEngine(svg), prof = PROFILES[o.profile || 'comet'];
    var g = { opacity: 1 };   /* GSAP tweens this like an element's opacity */
    var lt = { g: g, path: geo, pts: null, len: 0, st: { front: -1e9, p: 0, u: null } };
    function build() {
      var L = geo.getTotalLength(); if (!L) return false;
      var M = geo.getCTM(); if (!M) return false;
      /* map units per path unit (3D roads are drawn at 1.289x and scaled down) */
      var sc = Math.sqrt(M.a * M.a + M.b * M.b), step = Math.max(1.5, (o.spacing || 6) / 3);
      var n = Math.max(2, Math.ceil(L / step)), pts = new Float32Array((n + 1) * 3);
      for (var i = 0; i <= n; i++) {
        var s = L * i / n, q = geo.getPointAtLength(s);
        pts[i * 3] = M.a * q.x + M.c * q.y + M.e; pts[i * 3 + 1] = M.b * q.x + M.d * q.y + M.f; pts[i * 3 + 2] = s;
      }
      lt.pts = pts; lt.n = n; lt.len = L; lt.sc = sc; lt.gap = step * sc * 4; return true;
    }
    lt.paint = function (ctx) {
      if (g.opacity < 0.01) return;
      if (!lt.pts && !build()) return;
      var L = lt.len, pts = lt.pts, n = lt.n, st = lt.st;
      if (st.u != null) st.front = -2 * o.head + st.u * (L + o.tail + 3 * o.head);
      var passes = o.glowWidth ? [[o.color, o.glowWidth * 1.5, 0.07], [o.color, o.glowWidth, 0.12], [o.color, o.glowWidth * 0.55, 0.2], [o.color, o.glowWidth * 0.28, 0.3], [o.core || o.color, o.width, 0.95]]
                               : [[o.core || o.color, o.width, 0.95]];
      /* visible range only (comets cover a short stretch) */
      var i0 = 0, i1 = n;
      if (o.profile !== 'band') { var a0 = st.front - o.tail, a1 = st.front + o.head * 2.2; i0 = Math.max(0, Math.floor(a0 / L * n)); i1 = Math.min(n, Math.ceil(a1 / L * n)); }
      if (i1 <= i0) return;
      /* alpha along the stretch, quantised: contiguous runs of equal alpha are stroked as ONE polyline
         (no per-segment seams), so the light reads as a single smooth stroke at any zoom */
      var lv = lt.lv || (lt.lv = new Float32Array(n + 1)), Q = 24;
      for (var i = i0; i < i1; i++) {
        var j = i * 3;
        lv[i] = (Math.abs(pts[j + 3] - pts[j]) + Math.abs(pts[j + 4] - pts[j + 1]) > lt.gap) ? -1
          : Math.round(prof((pts[j + 2] + pts[j + 5]) / 2, L, st, o) * Q) / Q;
      }
      for (var p = 0; p < passes.length; p++) {
        var col = passes[p][0], a = passes[p][2] * g.opacity;
        ctx.lineWidth = passes[p][1] * lt.sc;
        var k = i0;
        while (k < i1) {
          var q = lv[k], e = k;
          while (e + 1 < i1 && lv[e + 1] === q) e++;
          if (q > 0.02) {
            ctx.strokeStyle = hexA(col, a * q);
            ctx.beginPath(); ctx.moveTo(pts[k * 3], pts[k * 3 + 1]);
            for (var m = k + 1; m <= e + 1; m++) ctx.lineTo(pts[m * 3], pts[m * 3 + 1]);
            ctx.stroke();
          }
          k = e + 1;
        }
      }
    };
    lt.draw = function () { };
    eng.lights.push(lt);
    /* comet runner: front travels from before the start until the whole tail has left the end */
    lt.run = function (dur, delay, gap) {
      lt.tween = G.fromTo(lt.st, { u: 0 }, { u: 1, duration: dur, ease: 'none', repeat: -1, repeatDelay: gap == null ? 1 : gap, delay: delay || 0 });
      return lt;
    };
    /* a single linear pass (used by the per-map comet scheduler) */
    lt.pass = function (dur) { return G.fromTo(lt.st, { u: 0 }, { u: 1, duration: dur, ease: 'none' }); };
    /* one pass of the comet (e.g. around a building outline on hover) */
    lt.once = function (dur) {
      G.killTweensOf(lt.st); G.killTweensOf(g); G.set(g, { opacity: 1 });
      return G.fromTo(lt.st, { u: 0 }, { u: 1, duration: dur, ease: 'power1.inOut' });
    };
    /* band: wipe on (p 0 → 1) / off */
    lt.show = function (dur, delay) { G.killTweensOf(lt.st); if (!delay) G.killTweensOf(g); G.to(g, { opacity: 1, duration: 0.2, overwrite: 'auto', delay: delay || 0 }); return G.fromTo(lt.st, { p: 0 }, { p: 1, duration: dur, ease: 'power2.inOut', delay: delay || 0 }); };
    lt.hide = function (dur, delay) { return G.to(g, { opacity: 0, duration: dur || 0.4, delay: delay || 0, overwrite: 'auto' }); };
    lt.full = function () { lt.st.p = 1; };
    return lt;
  }
  /* One road-light look for every map (overview + urban 3D): same colours, sizes and timing.
     S scales the sizes into the path's own units (3D roads are drawn at 1.289× and scaled down). */
  var ROAD_FX = {
    hl: { color: '#f4c46c', core: '#ffe7b0', width: 3.2, glowWidth: 18, radius: 26, spacing: 10, profile: 'band', bandFade: 0.14 },
    comet: { color: '#f0bd63', core: '#fff4d8', width: 3.4, glowWidth: 14, radius: 26, spacing: 10, profile: 'comet', head: 45, tail: 300, endFade: 140 }
  };
  var ROAD_FX_SIZE = ['width', 'glowWidth', 'radius', 'spacing', 'head', 'tail', 'endFade'];
  function roadLights(svg, g, d, S, grad, glowId, softId, dur, gap, tint) {
    function cfg(base, filter) {
      var o = { grad: grad, glowFilter: filter };
      for (var k in base) o[k] = base[k];
      if (tint) { o.color = tint.color; o.core = tint.core; }   /* e.g. a Metro line lights up in its own dash colour */
      ROAD_FX_SIZE.forEach(function (k) { if (o[k] != null) o[k] *= S; });
      return o;
    }
    var hl = makeLight(svg, g, d, cfg(ROAD_FX.hl, glowId));
    G.set(hl.g, { opacity: 0 });
    var comet = makeLight(svg, g, d, cfg(ROAD_FX.comet, softId));
    comet.st.u = 1;   /* parked past the end: invisible until its turn */
    /* idle lights: once in a while, one road at a time (a calm map, feedback 02/11) — not every road on a loop */
    var list = svg.__comets || (svg.__comets = []);
    list.push({ lt: comet, dur: dur });
    if (!svg.__cometLoop) { svg.__cometLoop = true; G.delayedCall(G.utils.random(1.5, 3), function () { cometLoop(list); }); }
    return { hl: hl, comet: comet };
  }
  var COMET_GAP = [6, 10];   /* seconds of quiet between two passes on the same map */
  function cometLoop(list) {
    var last = -1;
    (function next() {
      if (!list.length) return;
      var i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === last) i = (i + 1) % list.length;
      last = i;
      list[i].lt.pass(list[i].dur).eventCallback('onComplete', function () { G.delayedCall(G.utils.random(COMET_GAP[0], COMET_GAP[1]), next); });
    })();
  }
  /* where each display mode lives; the single-file test build overrides this with hash routes */
  var MODE_HREF = window.SALA_MODE_HREF || { section: 'index.html', page: 'masterplan.html' };
  function modeHref(mode, view) {
    var base = MODE_HREF[mode], v = view && view !== 'overview' ? 'view=' + view : '';
    if (!v) return base;
    return base.indexOf('#') >= 0 ? base + (base.length > 1 ? '&' : '') + v : base + '#' + v;
  }
  function icon(svg, cls) { return '<span class="svg-icon' + (cls ? ' ' + cls : '') + '">' + svg + '</span>'; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var HOVER = window.matchMedia && matchMedia('(hover: hover)').matches;
  function done(anim) { return new Promise(function (r) { if (!anim) return r(); anim.eventCallback('onComplete', r); anim.eventCallback('onInterrupt', r); }); }
  function sleep(sec) { return new Promise(function (r) { G.delayedCall(REDUCED ? 0 : sec, r); }); }
  if (REDUCED) G.globalTimeline.timeScale(20);
  G.defaults({ ease: 'power2.out', duration: 0.6 });

  /* reverse an absolute M/L/C path so text reads left → right */
  function reversePath(d) {
    var t = d.match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/g), i = 0, cur = null, segs = [], cmd;
    function pt() { var p = [t[i], t[i + 1]]; i += 2; return p; }
    while (i < t.length) {
      if (/[MLC]/.test(t[i])) cmd = t[i++];
      if (cmd === 'M') { cur = pt(); }
      else if (cmd === 'L') { var p = pt(); segs.push(['L', cur, p]); cur = p; }
      else if (cmd === 'C') { var c1 = pt(), c2 = pt(), e = pt(); segs.push(['C', cur, c1, c2, e]); cur = e; }
    }
    var out = 'M ' + cur.join(' ');
    for (var j = segs.length - 1; j >= 0; j--) {
      var s = segs[j];
      out += s[0] === 'L' ? ' L ' + s[1].join(' ') : ' C ' + s[3].join(' ') + ' ' + s[2].join(' ') + ' ' + s[1].join(' ');
    }
    return out;
  }

  /* =======================================================
     Cloud layer — one WebGL layer above the maps (approach of explore.ownprimland.com):
     domain-warped fbm noise, lit from the top-left, drifting slowly.
     Uniforms driven by GSAP:
       density  0 → 1   coverage (0 = clear sky, 1 = solid cloud bank)
       scale    1 → n   feature size; growing it reads as flying into the clouds
       hole     0 → 2   radius of a clearing that opens from the centre ("mây tan")
       edge     0 → 1   ambient mode: keep clouds near the frame edges only
       alpha             global opacity                                          */
  var CLOUD_FS = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime, uDensity, uScale, uHole, uEdge, uAlpha, uSweep, uSweepL, uSweepT, uDrift; uniform vec2 uPan;',
    'float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }',
    'const mat2 R = mat2(1.6, 1.2, -1.2, 1.6);',
    'float fbm5(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=R*p; a*=0.5; } return v; }',
    'float fbm3(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v+=a*noise(p); p=R*p; a*=0.5; } return v; }',
    /* billowy cloud field: soft low-frequency warp keeps shapes round, not streaky */
    'float cloud(vec2 p, float t){',
    '  vec2 q = vec2(fbm3(p*0.55 + vec2(0.0, t*0.02)), fbm3(p*0.55 + vec2(3.7, 1.9) - t*0.015));',
    '  return fbm5(p + 0.65*q + vec2(t*0.01, 0.0)); }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float m = min(uRes.x, uRes.y);',
    '  vec2 c = (gl_FragCoord.xy - 0.5*uRes) / m;',
    '  float t = uTime;',
    '  float thr = mix(0.86, 0.12, uDensity);',
    /* near layer */
    /* idle edge mist (uEdge 1): small soft puffs — about twice the frequency of the covering bank (uEdge 0) */
    '  float fq = mix(1.0, 2.1, max(uEdge, uSweep));',   /* fine puffs for the edge mist and the sweep */
    '  vec2 p1 = c * 1.7 * fq / uScale + uPan + vec2(uDrift + t*0.012, t*0.004);',
    '  float n1 = cloud(p1, t);',
    '  float l1 = cloud(p1 + vec2(-0.09, 0.09), t);',
    '  float a1 = smoothstep(thr, thr + mix(0.24, 0.34, uEdge), n1);',
    '  float s1 = clamp(0.6 + (n1 - l1) * 4.5 + (n1 - thr) * 0.9, 0.0, 1.0);',
    /* far layer: bigger, slower, paler — gives depth */
    '  vec2 p2 = c * 1.05 * fq / (0.6 + 0.4*uScale) + uPan*0.55 + vec2(19.3 + uDrift*0.7, 7.1) + vec2(t*0.006, t*0.002);',
    '  float n2 = fbm5(p2 + 0.5*fbm3(p2*0.6 + t*0.01));',
    '  float a2 = smoothstep(thr + 0.04, thr + 0.32, n2) * 0.75;',
    '  vec3 light = vec3(1.0, 0.992, 0.972), shadow = mix(vec3(0.66, 0.70, 0.76), vec3(0.84, 0.86, 0.89), uEdge);',
    '  vec3 c1 = mix(shadow, light, s1);',
    '  vec3 c2 = mix(vec3(0.80, 0.83, 0.87), vec3(0.97, 0.97, 0.96), clamp(0.5 + (n2 - thr) * 1.6, 0.0, 1.0));',
    '  float a = a1 + a2 * (1.0 - a1);',
    '  vec3 col = (c1 * a1 + c2 * a2 * (1.0 - a1)) / max(a, 1e-4);',
    '  float r = length((uv - 0.5) * vec2(1.0, 0.86)) * 2.0;',
    '  a *= mix(1.0, smoothstep(0.40, 1.25, r), uEdge);',
    '  float rc = length(c) * 1.4;',
    '  a *= smoothstep(uHole - 0.6, uHole + 0.05, rc + (n1 - 0.5) * 0.7);',
    /* sweep (quick tab change): a cloud band enters from the left (front L) and leaves to the right (back T), wispy edges */
    '  float xn = uv.x + (n1 - 0.5) * 0.45 + (uv.y - 0.5) * 0.08;',
    '  float sw = smoothstep(uSweepT - 0.32, uSweepT + 0.32, xn) * (1.0 - smoothstep(uSweepL - 0.32, uSweepL + 0.28, xn));',
    '  a *= mix(1.0, sw, uSweep);',
    '  a *= uAlpha;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  function CloudLayer(host) {
    var cv = this.canvas = el('canvas', 'mm-cloudgl');
    host.appendChild(cv);
    this.u = { density: 0, scale: 1, hole: 0, edge: 1, alpha: 1, panX: 0, panY: 0, sweep: 0, sweepL: 0, sweepT: 0, drift: 0, time: G.utils.random(0, 200) };
    this.res = 0.4;
    var gl = this.gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    this.ok = !!gl;
    if (!gl) { cv.classList.add('is-fallback'); return; }
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, CLOUD_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.ok = false; cv.classList.add('is-fallback'); return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.loc = {};
    var self = this;
    ['uRes', 'uTime', 'uDensity', 'uScale', 'uHole', 'uEdge', 'uAlpha', 'uPan', 'uSweep', 'uSweepL', 'uSweepT', 'uDrift'].forEach(function (n) { self.loc[n] = gl.getUniformLocation(prog, n); });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.tick = this.render.bind(this);
    this.visible = true;
    G.ticker.add(this.tick);
  }
  CloudLayer.prototype.resize = function (w, h) {
    this.w = w; this.h = h;
    var k = this.res * Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(2, Math.round(w * k)); this.canvas.height = Math.max(2, Math.round(h * k));
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
  };
  CloudLayer.prototype.render = function (t, dt) {
    if (!this.ok || !this.visible) return;
    var u = this.u, gl = this.gl;
    u.time += (dt || 16) / 1000;
    /* idle mist drifts slowly: 30 fps is indistinguishable and halves the GPU cost while panning */
    this._f = (this._f || 0) + 1;
    if (u.edge > 0.99 && u.hole < 0.01 && (this._f & 1)) return;
    if (u.alpha * u.density < 0.004) { if (!this._cleared) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); this._cleared = true; } return; }
    this._cleared = false;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.loc.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.loc.uTime, u.time);
    gl.uniform1f(this.loc.uDensity, u.density);
    gl.uniform1f(this.loc.uScale, u.scale);
    gl.uniform1f(this.loc.uHole, u.hole);
    gl.uniform1f(this.loc.uEdge, u.edge);
    gl.uniform1f(this.loc.uAlpha, u.alpha);
    gl.uniform2f(this.loc.uPan, u.panX, u.panY);
    gl.uniform1f(this.loc.uSweep, u.sweep); gl.uniform1f(this.loc.uSweepL, u.sweepL); gl.uniform1f(this.loc.uSweepT, u.sweepT); gl.uniform1f(this.loc.uDrift, u.drift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* ambient cloud presets per map (edge-only drifting mist) */
  var AMBIENT = {
    /* idle edge mist: light, only drifting along the frame edges (feedback 02/11: don't hide the map) */
    overview: { density: 0.44, edge: 1, alpha: 0.65 },
    plan2d: { density: 0.4, edge: 1, alpha: 0.6 },
    master3d: { density: 0.46, edge: 1, alpha: 0.7 },
    amenity: { density: 0.42, edge: 1, alpha: 0.65 }
  };

  /* ======================================================= */
  function MasterMap(root) {
    this.root = root;
    this.mode = root.getAttribute('data-mm') === 'page' ? 'page' : 'section';
    this.view = 'overview';
    this.active = 'overview';
    this.busy = false;
    this.layers = {};
    this.pending = {};   /* map images not requested yet (see lazy / loadMap) */
    this.markers = { overview: [], plan2d: [], master3d: [], amenity: [] };
    this.selection = null;
    this.hovered = null;
    this.padRight = 0;
    this.build();
    this.bind();
    this.measure();
    var self = this;
    Object.keys(MAPS).forEach(function (k) { self.layers[k].cam = self.defaultCam(k); self.apply(k); });
    G.set(this.layers.overview.el, { autoAlpha: 1 });
    this.layers.overview.el.classList.add('is-active');
    this.updateChrome();
    /* arriving from the other display mode: open straight on the same view */
    var want = (location.hash.match(/view=(tod|urban|amenity)/) || [])[1];
    if (want === 'tod') want = 'urban';
    this.intro(want);
  }
  var P = MasterMap.prototype;

  /* ---------- DOM ---------- */
  P.build = function () {
    var root = this.root, self = this;
    root.classList.add(this.mode === 'page' ? 'mm-page' : 'mm-section');

    if (this.mode === 'section') {
      var head = el('div', 'mm-heading');
      this.titleEl = el('h2', 'mm-title');
      this.setTitle('overview', true);
      head.appendChild(this.titleEl);
      head.appendChild(this.descEl = el('p', 'mm-desc', esc(D.descriptions.overview)));
      root.appendChild(head);
      /* the outer "Bản đồ tổng quan / Bản đồ khu đô thị" switch is gone: the embed uses the same single
         3-tab bar as the full page (feedback 02/11), placed inside the map */
    }

    var frame = this.frame = el('div', 'mm-frame');
    root.appendChild(frame);
    var stage = this.stage = el('div', 'mm-stage');
    stage.setAttribute('aria-label', 'Bản đồ tương tác SALA');
    frame.appendChild(stage);
    /* a soft dark fade at the bottom of the screen (black 30% → 0%, fixed while zooming) so the logo and tab bar read on any map */
    frame.appendChild(el('div', 'mm-bottomfade'));

    Object.keys(MAPS).forEach(function (k) {
      var L = el('div', 'mm-layer');
      L.setAttribute('data-map', k);
      var canvas = el('div', 'mm-canvas');
      canvas.style.width = MAPS[k].w + 'px'; canvas.style.height = MAPS[k].h + 'px';
      var markers = el('div', 'mm-markers');
      L.appendChild(canvas); L.appendChild(markers);
      stage.appendChild(L);
      G.set(L, { autoAlpha: 0 });
      self.layers[k] = { el: L, canvas: canvas, markersEl: markers, cam: { s: 1, tx: 0, ty: 0 } };
    });
    this.buildOverview(); /* buildPlan() kept but not built: 2D TOD step dropped */ this.buildMaster(); this.buildAmenity();

    /* clouds: a single WebGL layer above every map */
    var clouds = this.clouds = el('div', 'mm-clouds');
    frame.appendChild(clouds);
    this.cloud = new CloudLayer(clouds);
    this.veil = el('div', 'mm-clouds__veil');
    clouds.appendChild(this.veil);
    G.set(this.veil, { autoAlpha: 0 });
    Object.assign(this.cloud.u, AMBIENT.overview, { density: 0 });
    this.loader = el('div', 'mm-loader', '<img src="' + IMG + 'pattern-sala.webp" alt="">');
    frame.appendChild(this.loader);
    G.set(this.loader, { autoAlpha: 0, scale: 0.6 });

    var ctr = this.controls = el('div', 'mm-controls');
    var light = ' mm-ctrl--light';   /* same tool column in section and page: gold zoom pair, cream single buttons */
    ctr.innerHTML =
      '<div class="mm-ctrl"><button type="button" data-act="zin" aria-label="Phóng to">' + icon(I.plus) + '</button>' +
      '<button type="button" data-act="zout" aria-label="Thu nhỏ">' + icon(I.minus) + '</button></div>' +
      '<div class="mm-ctrl' + light + '" data-ctrl="reload"><button type="button" data-act="reload" aria-label="Về góc nhìn ban đầu">' + icon(I.reload) + '</button></div>' +
      (this.mode === 'page' ? '<div class="mm-ctrl mm-ctrl--light"><button type="button" data-act="full" aria-label="Toàn màn hình">' + icon(I.expand) + '</button></div>' : '');
    /* display mode: one button in the control column — section: open the full Masterplan page;
       page: back to the section. The current view (TOD / urban / amenity) carries over. */
    /* demo-only switch: a swap icon (not a design control) + a tooltip saying it is just for the demo */
    /* section → "Xem toàn màn hình" (4 arrows out) opens the full Masterplan page;
       page → "Quay lại trang trước" (back arrow): back in history, or to the home page (section) when opened directly */
    var ICON_BACK = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16 10H4.5M9 5l-5 5 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var toPage = this.mode === 'section', tipTxt = toPage ? 'Xem toàn màn hình' : 'Quay lại trang trước';
    var mb = el('div', 'mm-ctrl' + light + ' mm-ctrl--mode',
      '<button type="button" data-act="mode" aria-label="' + tipTxt + '" data-tip="' + tipTxt + '">' + (toPage ? icon(I.expand) : ICON_BACK) + '</button>');
    mb.querySelector('button').addEventListener('click', function () {
      if (toPage) { location.href = modeHref('page', self.view); return; }
      var ref = ''; try { ref = document.referrer && new URL(document.referrer).origin === location.origin ? document.referrer : ''; } catch (e) { }
      if (window.SALA_MODE_HREF || !ref || history.length < 2) location.href = modeHref('section', self.view); else history.back();
    });
    ctr.appendChild(mb);
    /* hover tooltips on the tools (their own label, Sala gold, to the right of the column) */
    ctr.querySelectorAll('button[data-act]:not([data-act="mode"])').forEach(function (b) { b.setAttribute('data-tip', b.getAttribute('aria-label')); });
    frame.appendChild(ctr);


    this.legend = el('div', 'mm-legend', '<img src="' + IMG + 'legend-hd.webp" alt="Chú thích bản đồ">');
    frame.appendChild(this.legend);

    if (this.mode === 'section') {
      /* one 3-tab bar, same as the full page: Tổng quan / Khu đô thị / Tiện ích, always at the bottom centre of the map */
      var bar = this.ptabs = el('div', 'mm-ptabs mm-ptabs--embed');
      bar.setAttribute('role', 'tablist');
      bar.innerHTML = '<span class="mm-ptabs__indicator"></span>' +
        '<button type="button" role="tab" data-go="overview" aria-label="Tổng quan">' + icon(I.location) + '<span>Tổng quan</span></button>' +
        '<button type="button" role="tab" data-go="urban" aria-label="Khu đô thị">' + icon(I.city) + '<span>Khu đô thị</span></button>' +
        '<button type="button" role="tab" data-go="amenity" aria-label="Tiện ích">' + icon(I.pool) + '<span>Tiện ích</span></button>';
      frame.appendChild(bar);
    } else {
      var header = el('div', 'mm-header');
      header.innerHTML =
        '<div class="mm-ptabs" role="tablist"><span class="mm-ptabs__indicator"></span>' +
        '<button type="button" role="tab" data-go="overview" aria-label="Tổng quan">' + icon(I.location) + '<span>Tổng quan</span></button>' +
        '<button type="button" role="tab" data-go="urban" aria-label="Khu đô thị">' + icon(I.city) + '<span>Khu đô thị</span></button>' +
        '<button type="button" role="tab" data-go="amenity" aria-label="Tiện ích">' + icon(I.pool) + '<span>Tiện ích</span></button></div>';   /* no Sala logo in the full map (02/11) */
      frame.appendChild(header);
      this.ptabs = header.querySelector('.mm-ptabs');
      /* portrait phones: no full-screen "rotate" wall any more — a small dismissible hint instead (buildRotateHint) */
    }

    /* hover card */
    this.card = el('div', 'mm-card');
    this.card.setAttribute('aria-hidden', 'true');
    frame.appendChild(this.card);
    G.set(this.card, { autoAlpha: 0 });

    this.backdrop = el('div', 'mm-backdrop');
    var panel = this.panel = el('aside', 'mm-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div class="mm-panel__head"><span class="mm-panel__kind"></span>' +
      '<button type="button" class="mm-panel__close" aria-label="Đóng">' + icon(I.close) + '</button></div>' +
      '<div class="mm-panel__body"></div><div class="mm-panel__foot"></div>';
    if (this.mode === 'section') root.appendChild(this.backdrop);
    frame.appendChild(panel);
    this.hint = el('div', 'mm-hint');
    frame.appendChild(this.hint);
    this.buildRotateHint();
  };

  /* portrait phone: a non-blocking pill suggests turning the phone; the map stays fully usable upright.
     Closes on ×, on its own after 7 s, or as soon as the phone is turned; shown once per session. */
  P.buildRotateHint = function () {
    var self = this, h = this.rotHint = el('div', 'mm-rothint');
    h.setAttribute('role', 'status');
    h.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="2.5" width="10" height="17" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M19.5 14.5a6.5 6.5 0 0 1-5 6.3M18 19.5l1.6 1.4-1.4 1.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Xoay ngang để xem rõ hơn</span><button type="button" aria-label="Đóng gợi ý">×</button>';
    this.frame.appendChild(h);
    G.set(h, { autoAlpha: 0, y: -8 });
    var shown = false;
    function portrait() { return window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches; }
    function hide() { clearTimeout(self.rotHintT); G.to(h, { autoAlpha: 0, y: -8, duration: 0.3, overwrite: true }); }
    this.showRotateHint = function () {
      var seen = false; try { seen = sessionStorage.getItem('sala-rot-hint') === '1'; } catch (e) { }
      if (shown || seen || !portrait()) return;
      shown = true; try { sessionStorage.setItem('sala-rot-hint', '1'); } catch (e) { }
      G.to(h, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.6 });
      self.rotHintT = setTimeout(hide, 7600);
    };
    h.querySelector('button').addEventListener('click', hide);
    window.addEventListener('orientationchange', hide);
    window.addEventListener('resize', function () { if (!portrait()) hide(); });
  };

  P.buildRotate = function () {
    var r = this.rotate = el('div', 'mm-rotate');
    r.innerHTML = '<div class="mm-rotate__top"><h2><span>Hãy xoay ngang</span>điện thoại</h2>' +
      '<div class="mm-rings"><div><div><img src="' + IMG + 'phone-rotate.png" alt=""></div></div></div>' +
      '<p><span>Để trải nghiệm tốt nhất</span>Sala Mastermap</p></div>' +
      '<button type="button" class="mm-btn">Đã hiểu</button>';
    document.body.appendChild(r);
    var ok = false;
    try { ok = sessionStorage.getItem('sala-rotate-ok') === '1'; } catch (e) { }
    if (!ok) r.classList.add('is-on');
    r.querySelector('.mm-btn').addEventListener('click', function () {
      G.to(r, { autoAlpha: 0, duration: 0.4, onComplete: function () { r.classList.remove('is-on'); G.set(r, { clearProps: 'all' }); } });
      try { sessionStorage.setItem('sala-rotate-ok', '1'); } catch (e) { }
    });
  };

  /* every marker sits in a wrapper that only receives the camera position (CSS translate);
     the marker itself stays free for GSAP transforms */
  P.addMarker = function (map, node, x, y, anchor) {
    var wrap = el('div', 'mm-mk');
    wrap.appendChild(node);
    this.layers[map].markersEl.appendChild(wrap);
    var m = { el: node, wrap: wrap, x: x, y: y, anchor: anchor || 'none', w: 0, h: 0 };
    this.markers[map].push(m);
    return m;
  };

  P.buildOverview = function () {
    var c = this.layers.overview.canvas, self = this;
    c.appendChild(el('div', 'mm-ov-bg'));
    /* overview: the OpenStreetMap vector map (assets/map/overview.svg) baked with its sepia grade into a 2x raster
       (tools/bake_overview.cjs) — sharp, and as light to pan/zoom as a plain image */
    /* designer's raster map (map-tong.jpg). The OSM vector map + live labels (map-overview.webp, js/overview-labels.js)
       stay in the repo: set OV_VECTOR = true to switch back */
    c.appendChild(OV_VECTOR
      ? el('div', 'mm-ov-img is-baked', '<img src="' + IMG + 'map-overview.webp" alt="Bản đồ vị trí Hệ sinh thái SALA" draggable="false" decoding="async">')
      : el('div', 'mm-ov-img mm-ov-img--hd', '<img alt="Bản đồ vị trí Hệ sinh thái SALA" draggable="false" decoding="async">'));
    if (!OV_VECTOR) this.lazy(c.querySelector('.mm-ov-img--hd img'), 'overview', IMG + 'map-overview-v84.webp');
    /* Client overview export v8.4 (3402 x 2094). It is a tighter crop at a different scale than the old HD
       export, so it is registered on map-overview-hd.webp by matching 401 shared features (SIFT + RANSAC,
       median error 0.8 px, no rotation): new = 1.1421 x old-HD px + (291.9, 160.4). In map space it sits at
       (175.9, 386.8) 1237.8 x 761.9, so the zone, pin, roads and Metro overlays keep their coordinates. */
    this.buildOverviewRoads(c);
    var z = D.overview.zone;
    var zone = this.salaZone = el('div', 'mm-zone mm-zone--sala', I.salaZone);
    zone.style.cssText = 'left:' + z.x + 'px;top:' + z.y + 'px;width:' + z.w + 'px;height:' + z.h + 'px';
    c.appendChild(zone);
    var pin = this.salaPin = el('button', 'mm-sala-pin');
    pin.type = 'button';
    pin.setAttribute('aria-label', 'Khám phá Khu đô thị Sala');
    pin.innerHTML = '<span class="mm-sala-pin__inner"><span class="mm-sala-pin__ring"></span><span class="mm-sala-pin__disc"><img src="' + IMG + 'pattern-sala.webp" alt=""></span><span class="mm-sala-pin__tail">' + I.pinTail + '</span></span>';
    /* SALA pin: straight into the 3D urban map (the green 2D TOD plan step is dropped, per feedback 02/11) */
    pin.addEventListener('click', function () { if (!self.suppress) self.go('urban'); });
    this.addMarker('overview', pin, D.overview.pin.x, D.overview.pin.y);
    if (OV_VECTOR) this.buildOvLabels();
  };

  /* Overview: highlight layer over the brown arterial roads baked into map-tong.jpg.
     Idle: a soft gold light travels along each axis. Hover: the map dims, the road lights up
     (glow + bright core drawn on), and a name chip follows the pointer along the road. */
  P.buildOverviewRoads = function (c) {
    var self = this, W = MAPS.overview.w, H = MAPS.overview.h,
      R = (D.overviewRoads || []).concat(D.overviewTransit || []);
    if (!R.length) return;
    var svg = this.ovSvg = svgEl('svg', { 'class': 'mm-ovroads', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    svg.__host = { app: this, map: 'overview' };
    svg.innerHTML = '<defs><filter id="mmOvGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '<filter id="mmOvSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>' + cometGradDefs('mmCometGradO') + '</defs>';
    this.ovDimRect = 'M 0 0 H ' + W + ' V ' + H + ' H 0 Z';
    this.ovDim = svgEl('path', { 'class': 'mm-ov-dim', d: this.ovDimRect, 'fill-rule': 'evenodd' });   /* v9.3: a path, so a hovered area can be cut out of the dim */
    svg.appendChild(this.ovDim);
    G.set(this.ovDim, { opacity: 0 });
    this.ovRoads = {};
    R.forEach(function (rd) {
      var metro = rd.kind === 'metro';
      var g = svgEl('g', { 'class': 'mm-ovroad' + (metro ? ' is-metro' : '') });
      var base = null;
      if (metro) {
        var gradId = 'mmMetroFade-' + rd.id;
        var grad = svgEl('linearGradient', { id: gradId, gradientUnits: 'userSpaceOnUse',
          x1: rd.x1, y1: rd.y1, x2: rd.x2, y2: rd.y2 });
        [[0, 0], [0.1, 1], [0.9, 1], [1, 0]].forEach(function (s) {
          grad.appendChild(svgEl('stop', { offset: (s[0] * 100) + '%',
            'stop-color': rd.color || '#6d7b36', 'stop-opacity': s[1] }));
        });
        svg.querySelector('defs').appendChild(grad);
        base = svgEl('path', { 'class': 'mm-ovroad__metro', d: rd.d,
          'stroke': 'url(#' + gradId + ')', 'stroke-dasharray': rd.dash || '8 13' });
        g.appendChild(base);
      }
      /* hover / reveal highlight (whole road, tapered to 0 at both ends) + idle comet — shared ROAD_FX look */
      var fx = roadLights(svg, g, rd.d, 1, 'mmCometGradO', 'mmOvGlow', 'mmOvSoft', rd.dur, 1, rd.light), hl = fx.hl, comet = fx.comet;
      var hit = svgEl('path', { 'class': 'mm-ovroad__hit', d: rd.d });
      g.appendChild(hit);
      svg.appendChild(g);
      var o = self.ovRoads[rd.id] = { rd: rd, g: g, base: base, hl: hl, comet: comet, hit: hit, pts: null };
      hit.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { self.hoverOvRoad(rd.id, true, e); if (self.ovHover === rd.id) self.showRoadTag('overview', o, rd.name, false, e); } });
      hit.addEventListener('pointermove', function (e) { if (self.ovHover === rd.id && e.pointerType !== 'touch') self.showRoadTag('overview', o, rd.name, false, e); });
      hit.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.hoverOvRoad(rd.id, false); });
      /* touch: tap a road to light it up, tap again (or elsewhere) to clear */
      hit.addEventListener('click', function (e) {
        if (self.suppress) return;
        if (self.ovHover === rd.id && e.pointerType === 'touch') return self.hoverOvRoad(rd.id, false);
        self.hoverOvRoad(rd.id, true, e);
        if (self.ovHover === rd.id) self.showRoadTag('overview', o, rd.name, false, e);
      });
    });
    /* named areas (v9.3): fill + 1 px rim + a comet once around the outline, name pinned at the top */
    (D.overviewAreas || []).forEach(function (ar) {
      var g = svgEl('g', { 'class': 'mm-ovarea' });
      var fill = svgEl('path', { 'class': 'mm-ovarea__fill', d: ar.d });
      var rim = svgEl('path', { 'class': 'mm-ovarea__rim', d: ar.d });
      g.appendChild(fill); g.appendChild(rim);
      var trace = makeLight(svg, g, ar.d, { grad: 'mmCometGradO', color: '#ffd98f', core: '#fff8ea', width: 1.8, glowWidth: 6, glowFilter: 'mmOvSoft', radius: 9, spacing: 3.5, profile: 'comet', head: 16, tail: 260, endFade: 6 });
      G.set(trace.g, { opacity: 0 }); G.set([fill, rim], { opacity: 0 });
      var hit = svgEl('path', { 'class': 'mm-ovarea__hit', d: ar.d });
      g.appendChild(hit);
      svg.insertBefore(g, svg.querySelector('.mm-ovroad'));   /* under the roads, so a road crossing it keeps its own hover */
      /* tag anchor: the top-most point of the outline */
      var top = null; ar.d.replace(/(-?[\d.]+) (-?[\d.]+)/g, function (_, x, y) { x = +x; y = +y; if (!top || y < top[1]) top = [x, y]; });
      var o = self.ovAreas = self.ovAreas || {};
      o[ar.id] = { ar: ar, fill: fill, rim: rim, trace: trace, top: top };
      hit.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') self.hoverOvArea(ar.id, true); });
      hit.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.hoverOvArea(ar.id, false); });
      hit.addEventListener('click', function (e) {
        if (self.suppress) return;
        if (e.pointerType === 'touch' && self.ovAreaHover === ar.id) return self.hoverOvArea(ar.id, false);
        self.hoverOvArea(ar.id, true);
      });
    });
    c.appendChild(svg);
    this.makeRoadTag('overview');
  };

  P.hoverOvArea = function (id, on) {
    if (on && (this.active !== 'overview' || this.busy)) return;
    var self = this, a = this.ovAreas && this.ovAreas[id];
    if (!a) return;
    if (on && this.ovHover) this.hoverOvRoad(this.ovHover, false);
    if (on && this.ovAreaHover && this.ovAreaHover !== id) this.hoverOvArea(this.ovAreaHover, false);
    this.ovAreaHover = on ? id : null;
    Object.keys(this.ovRoads || {}).forEach(function (k) {
      var r = self.ovRoads[k];
      G.to(r.comet.g, { opacity: on ? 0.15 : 1, duration: 0.4, overwrite: 'auto' });
      if (r.base) G.to(r.base, { opacity: on ? 0.18 : 1, duration: 0.4, overwrite: 'auto' });
    });
    var dim = this.ovDim, rect = this.ovDimRect;
    if (on) dim.setAttribute('d', rect + ' ' + a.ar.d);   /* the area stays at full brightness, the rest dims */
    G.to(dim, { opacity: on ? 1 : 0, duration: 0.5, ease: 'power2.out', overwrite: true,
      onComplete: on ? null : function () { if (!self.ovAreaHover) dim.setAttribute('d', rect); } });
    if (this.ovlEl) this.ovlEl.classList.toggle('is-dim', on);
    G.to([a.fill, a.rim], { opacity: on ? 1 : 0, duration: on ? 0.35 : 0.3, overwrite: true });
    var t = this.tags && this.tags.overview;
    if (on) {
      a.trace.once(1.6);
      if (t) {
        if (t.name !== a.ar.name) { t.name = a.ar.name; t.pill.textContent = a.ar.name; t.m.w = 0; }
        t.n.classList.add('mm-road--gold'); t.n.classList.remove('is-metro'); t.n.style.removeProperty('--c');
        if (t.down) { t.down = false; t.n.classList.add('mm-road--up'); t.n.classList.remove('mm-road--down'); t.m.anchor = 'road-up'; }
        t.m.x = a.top[0]; t.m.y = a.top[1]; this.apply('overview');
        if (!t.on) { t.on = true; G.fromTo(t.n, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(1.6)', overwrite: true }); }
      }
    } else {
      a.trace.hide(0.3);
      this.hideRoadTag('overview');
    }
  };

  /* nearest point on a road (in map space) to a client-space pointer; the path is sampled once, lazily.
     getCTM() maps the path's own units (e.g. the 1.289× 3D road groups) into map space. */
  P.roadNearest = function (map, o, e) {
    if (!o.pts) {
      var p = o.hit, L = p.getTotalLength(), n = Math.ceil(L / 6), M = p.getCTM(), pts = [];
      for (var i = 0; i <= n; i++) { var q = p.getPointAtLength(L * i / n); pts.push([M.a * q.x + M.c * q.y + M.e, M.b * q.x + M.d * q.y + M.f]); }
      o.pts = pts;
    }
    var cam = this.layers[map].cam, rect = this.layers[map].canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) / cam.s, my = (e.clientY - rect.top) / cam.s, best = o.pts[0], bd = Infinity;
    for (var j = 0; j < o.pts.length; j++) {
      var dx = o.pts[j][0] - mx, dy = o.pts[j][1] - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o.pts[j]; }
    }
    return best;
  };
  /* road name on hover: the Figma road-label (pill + leader + dot) pops up where the pointer is on the road */
  P.makeRoadTag = function (map) {
    var n = el('div', 'mm-road mm-road--up mm-road--tag', '<span class="mm-road__pill"></span><span class="mm-road__line"></span><span class="mm-road__dot"></span>');
    n._len = 28;   /* v8.7: 40 → 28, with the smaller labels */
    var m = this.addMarker(map, n, 0, 0, 'road-up');
    G.set(n, { autoAlpha: 0 });
    (this.tags = this.tags || {})[map] = { n: n, m: m, pill: n.querySelector('.mm-road__pill'), on: false, name: '' };
  };
  P.showRoadTag = function (map, o, name, gold, e) {
    var t = this.tags && this.tags[map];
    if (!t || !e || e.clientX == null) return;
    if (t.name !== name) { t.name = name; t.pill.textContent = name; t.m.w = 0; }
    /* hover label: the gold Figma pill; a Metro line uses its own colour (v8.9: same concept as its dashes) */
    var tagRgb = o && o.rd && o.rd.tagRgb;
    t.n.classList.toggle('mm-road--gold', !tagRgb);
    if (tagRgb) t.n.style.setProperty('--c', tagRgb); else t.n.style.removeProperty('--c');
    t.n.classList.toggle('is-metro', !!tagRgb);
    var pt = this.roadNearest(map, o, e), cam = this.layers[map].cam;
    /* near the top of the frame the label hangs below the road instead of above it */
    var down = pt[1] * cam.s + cam.ty < 110;
    if (down !== !!t.down) { t.down = down; t.n.classList.toggle('mm-road--up', !down); t.n.classList.toggle('mm-road--down', down); t.m.anchor = down ? 'road-down' : 'road-up'; }
    t.m.x = pt[0]; t.m.y = pt[1];
    this.apply(map);
    if (!t.on) { t.on = true; G.fromTo(t.n, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(1.6)', overwrite: true }); }
  };
  P.hideRoadTag = function (map) {
    var t = this.tags && this.tags[map];
    if (!t || !t.on) return;
    t.on = false;
    G.to(t.n, { autoAlpha: 0, y: 4, duration: 0.25, overwrite: true });
  };

  P.hoverOvRoad = function (id, on, e) {
    if (on && (this.active !== 'overview' || this.busy)) return;
    var self = this, o = this.ovRoads && this.ovRoads[id];
    if (!o) return;
    if (on && this.ovHover && this.ovHover !== id) this.hoverOvRoad(this.ovHover, false);
    if (on && this.ovAreaHover) this.hoverOvArea(this.ovAreaHover, false);
    if (on) this.ovDim.setAttribute('d', this.ovDimRect);
    this.ovHover = on ? id : null;
    Object.keys(this.ovRoads).forEach(function (k) {
      var r = self.ovRoads[k];
      G.to(r.comet.g, { opacity: on && k !== id ? 0.15 : 1, duration: 0.4, overwrite: 'auto' });
      if (r.base) G.to(r.base, { opacity: on && k !== id ? 0.18 : 1, duration: 0.4, overwrite: 'auto' });
    });
    o.g.classList.toggle('is-hover', on);
    G.to(this.ovDim, { opacity: on ? 1 : 0, duration: 0.5, ease: 'power2.out', overwrite: true });
    if (this.ovlEl) this.ovlEl.classList.toggle('is-dim', on);
    if (on) o.hl.show(1.1);
    else { o.hl.hide(0.4); this.hideRoadTag('overview'); }
  };


  /* ---------- overview labels: live cartographic placement ----------
     The map image carries no text (tools/build_overview_svg.py -> js/overview-labels.js). Each label is a DOM node
     placed in screen space whenever the camera moves:
       · constant on-screen size at every zoom; more names appear as you zoom in (zoom tiers `z`, × default zoom)
       · greedy placement by priority `p`: nothing overlaps another label, an icon, the Sala pin or the UI
       · icon captions try 4 spots around their icon; road names sit on the straightest visible stretch of the
         road; the river name is set letter by letter along its curve; area names show only while they fit inside
       · hysteresis (a shown label keeps its spot and a small priority bonus) so labels don't flicker while panning */
  var OV_VECTOR = false;   /* false: designer's raster overview (map-tong.jpg); true: OSM vector map + live labels */
  var OVL = { gap: 4, cell: 48, tol: { road: 1.6, art: 2.4, line: 2.6 }, rep: 460, step: 18 };
  function ovlLine(pts) {
    var n = pts.length, X = new Float32Array(n), Y = new Float32Array(n), S = new Float32Array(n), bb = [1e9, 1e9, -1e9, -1e9];
    for (var i = 0; i < n; i++) {
      X[i] = pts[i][0]; Y[i] = pts[i][1];
      S[i] = i ? S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]) : 0;
      bb[0] = Math.min(bb[0], X[i]); bb[1] = Math.min(bb[1], Y[i]); bb[2] = Math.max(bb[2], X[i]); bb[3] = Math.max(bb[3], Y[i]);
    }
    return { X: X, Y: Y, S: S, len: S[n - 1], bb: bb };
  }
  function lineAt(Ln, u) {
    var lo = 0, hi = Ln.S.length - 1;
    u = u < 0 ? 0 : u > Ln.len ? Ln.len : u;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (Ln.S[m] <= u) lo = m; else hi = m; }
    var seg = Ln.S[hi] - Ln.S[lo] || 1, t = (u - Ln.S[lo]) / seg;
    return [Ln.X[lo] + (Ln.X[hi] - Ln.X[lo]) * t, Ln.Y[lo] + (Ln.Y[hi] - Ln.Y[lo]) * t, lo, hi];
  }
  function inPoly(P_, x, y) {
    var c = false;
    for (var i = 0, j = P_.length - 1; i < P_.length; j = i++) {
      var a = P_[i], b = P_[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  /* uniform grid of placed boxes (screen px) */
  function OvlGrid() { this.m = {}; }
  OvlGrid.prototype.each = function (b, fn) {
    var C = OVL.cell, x0 = Math.floor(b.x / C), x1 = Math.floor((b.x + b.w) / C), y0 = Math.floor(b.y / C), y1 = Math.floor((b.y + b.h) / C);
    for (var cx = x0; cx <= x1; cx++) for (var cy = y0; cy <= y1; cy++) if (fn(cx + ':' + cy) === true) return true;
    return false;
  };
  OvlGrid.prototype.add = function (b) { var m = this.m; this.each(b, function (k) { (m[k] || (m[k] = [])).push(b); }); };
  OvlGrid.prototype.hitK = function (b, k) {
    return this.hit(b) || (k !== 'art' && !!this.art && this.art.hit(b)) || (k === 'water' && !!this.land && this.land.hit(b));
  };
  OvlGrid.prototype.hit = function (b) {
    var m = this.m, g = OVL.gap;
    return this.each(b, function (k) {
      var a = m[k]; if (!a) return;
      for (var i = 0; i < a.length; i++) { var q = a[i]; if (b.x < q.x + q.w + g && q.x < b.x + b.w + g && b.y < q.y + q.h + g && q.y < b.y + b.h + g) return true; }
    });
  };

  P.buildOvLabels = function () {
    var LB = window.SALA_OV_LABELS, self = this;
    if (!LB) return;
    var L = this.layers.overview, layer = this.ovlEl = el('div', 'mm-ovl');
    layer.setAttribute('aria-hidden', 'true');
    L.el.insertBefore(layer, L.markersEl);
    L.el.appendChild(el('div', 'mm-ovl-attrib', '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'));
    this.ovl = LB.items.map(function (it) {
      var n = el('div', 'mm-ovl__t mm-ovl--' + it.k + (it.tone ? ' mm-ovl--' + it.tone : ''));
      if (it.k === 'water') {
        it.chars = Array.from(it.t).map(function (ch) { var sp = el('span', null, ch === ' ' ? ' ' : ch); n.appendChild(sp); return { el: sp, w: 0, tf: '' }; });
      } else if (it.k === 'ward') n.innerHTML = '<small>Phường</small><b>' + it.t + '</b>';
      else n.innerHTML = [].concat(it.t).join('<br>') + (it.sub ? '<i>' + it.sub + '</i>' : '');
      layer.appendChild(n);
      it.el = n; it.on = false; it.pl = null; it.tf = '';
      if (it.lines) it.lines = it.lines.map(ovlLine);
      else if (it.w) { it.iw = it.w; it.ih = it.h; }   /* the icon's box (map units); w/h become the label's own size */
      return it;
    });
    var measure = function () {
      self.ovl.forEach(function (it) {
        it.w = it.el.offsetWidth; it.h = it.el.offsetHeight;
        if (it.chars) it.chars.forEach(function (c) { c.w = c.el.offsetWidth; it.h = Math.max(it.h, c.el.offsetHeight); });
      });
      self.ovlReady = true; self.ovlLayout();
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure); else measure();
  };

  /* camera moved: follow at once (cheap), re-solve placement at most every ~110ms and once more when it settles */
  P.ovlUpdate = function () {
    if (!this.ovlReady) return;
    var self = this;
    this.ovlFollow();
    clearTimeout(this.ovlSettle);
    this.ovlSettle = setTimeout(function () { self.ovlLayout(); }, 140);
    if (!this.ovlRaf && performance.now() - (this.ovlLast || 0) > 110) this.ovlRaf = requestAnimationFrame(function () { self.ovlLayout(); });
  };

  P.ovlLayout = function () {
    this.ovlRaf = 0; this.ovlLast = performance.now();
    if (!this.ovlReady || !this.fw) return;
    var self = this, Lo = this.layers.overview, cam = Lo.cam, s = cam.s, tx = cam.tx, ty = cam.ty;
    var z = s / (Lo.sDefault || s), vw = this.fw - (this.padRight || 0), vh = this.fh;
    var grid = new OvlGrid(), fr = this.stage.getBoundingClientRect();
    var view = { x0: 4, y0: 4, x1: vw - 4, y1: vh - 4 };
    /* fixed obstacles: the UI chrome, the Sala pin, the hover road tag, and every icon on the map */
    var tag = this.tags && this.tags.overview;
    [this.controls, this.legend, this.modeEl, this.tabsEl, this.ptabs, this.frame.querySelector('.mm-header__logo'), this.salaPin, tag && tag.on ? tag.n : null,
      Lo.el.querySelector('.mm-ovl-attrib')].forEach(function (n) {
      if (!n) return;
      var r = n.getBoundingClientRect();
      if (r.width) grid.add({ x: r.left - fr.left - 4, y: r.top - fr.top - 4, w: r.width + 8, h: r.height + 8 });
    });
    this.ovlZone(s, tx, ty).forEach(function (b) { grid.add(b); });
    /* the river name stays on water: keep it off the filled areas (gold centre, parks) */
    var land = grid.land = new OvlGrid();
    ovlStrips(this.ovl.filter(function (it) { return it.poly; }).map(function (it) { return it.poly; }), s, tx, ty).forEach(function (b) { land.add(b); });
    /* the brown arterials: icon captions, wards and other roads keep off them (their own names sit beside them) */
    var art = grid.art = new OvlGrid(), R = this.ovRoads || {}, aw = 5.2 * s + 4;
    Object.keys(R).forEach(function (k) {
      var o = R[k];
      if (!o.pts) self.roadNearest('overview', o, { clientX: 0, clientY: 0 });
      for (var i = 0; i < o.pts.length; i++) {
        var X = o.pts[i][0] * s + tx, Y = o.pts[i][1] * s + ty;
        if (X > -aw && Y > -aw && X < vw + aw && Y < vh + aw) art.add({ x: X - aw / 2, y: Y - aw / 2, w: aw, h: aw });
      }
    });
    this.ovl.forEach(function (it) {
      if (!it.iw) return;
      var b = { x: (it.x - it.iw / 2) * s + tx, y: (it.y - it.ih / 2) * s + ty, w: it.iw * s, h: it.ih * s };
      if (b.x < vw && b.y < vh && b.x + b.w > 0 && b.y + b.h > 0) grid.add(b);
    });
    var groups = {};
    var order = this.ovl.slice().sort(function (a, b) { return (b.p + (b.on ? 8 : 0)) - (a.p + (a.on ? 8 : 0)); });
    order.forEach(function (it) {
      var want = z >= it.z * (it.on ? 0.9 : 1), pl = null;
      if (want) {
        if (it.lines) pl = it.k === 'water' ? self.ovlCurve(it, cam, view, grid, groups) : self.ovlPath(it, cam, view, grid);
        else pl = self.ovlPoint(it, cam, view, grid);
      }
      if (pl) {
        it.pl = pl;
        pl.boxes.forEach(function (b) { grid.add(b); });
        if (it.grp) (groups[it.grp] = groups[it.grp] || []).push(pl.c);
      }
      if (!!pl !== it.on) { it.on = !!pl; it.el.classList.toggle('is-on', it.on); }
    });
    this.ovlFollow();
  };

  /* the Sala zone's own outline (its SVG paths, sampled once into map space) as horizontal strips of screen boxes */
  P.ovlZone = function (s, tx, ty) {
    if (!this.salaZone) return [];
    if (!this.ovlZonePolys) {
      var z = D.overview.zone, svg = this.salaZone.querySelector('svg'), vb = svg.viewBox.baseVal;
      this.ovlZonePolys = [].map.call(svg.querySelectorAll('path'), function (pa) {
        var L = pa.getTotalLength(), n = Math.max(12, Math.ceil(L / 6)), out = [];
        for (var i = 0; i < n; i++) { var q = pa.getPointAtLength(L * i / n); out.push([z.x + q.x / vb.width * z.w, z.y + q.y / vb.height * z.h]); }
        return out;
      });
    }
    return ovlStrips(this.ovlZonePolys, s, tx, ty);
  };
  function ovlStrips(polys, s, tx, ty) {
    var boxes = [], ST = 10;
    polys.forEach(function (P_) {
      var sp = P_.map(function (p) { return [p[0] * s + tx, p[1] * s + ty]; }), y0 = Infinity, y1 = -Infinity;
      sp.forEach(function (p) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      for (var y = y0; y < y1; y += ST) {
        var a = Infinity, b = -Infinity, yb = Math.min(y + ST, y1);
        for (var i = 0, j = sp.length - 1; i < sp.length; j = i++) {
          var p = sp[i], q = sp[j];
          if (p[1] >= y && p[1] <= yb) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); }
          [y, yb].forEach(function (yy) {
            if ((p[1] > yy) !== (q[1] > yy)) { var x = p[0] + (q[0] - p[0]) * (yy - p[1]) / (q[1] - p[1]); a = Math.min(a, x); b = Math.max(b, x); }
          });
        }
        if (b > a) boxes.push({ x: a, y: y, w: b - a, h: yb - y });
      }
    });
    return boxes;
  }
  function boxIn(b, v) { return b.x >= v.x0 && b.y >= v.y0 && b.x + b.w <= v.x1 && b.y + b.h <= v.y1; }

  /* point labels: centred (wards, areas) or one of 4 spots around their icon */
  var OVL_SIDES = { below: [0, 1], above: [0, -1], right: [1, 0], left: [-1, 0], br: [1, 1], bl: [-1, 1], tr: [1, -1], tl: [-1, -1] };
  P.ovlPoint = function (it, cam, view, grid) {
    var s = cam.s, w = it.w, h = it.h, ax = it.x * s + cam.tx, ay = it.y * s + cam.ty;
    if (it.k === 'ward' || it.k === 'area') {
      var b = { x: ax - w / 2, y: ay - h / 2, w: w, h: h };
      if (!boxIn(b, view) || grid.hitK(b, it.k)) return null;
      if (it.poly) {   /* area name: only while the words fit inside the area */
        var hx = (w / 2 + 6) / s, hy = (h / 2 + 4) / s, P_ = it.poly;
        if (![[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].every(function (q) { return inPoly(P_, it.x + q[0] * hx, it.y + q[1] * hy); })) return null;
      }
      return { mx: it.x, my: it.y, kx: 0, ky: 0, px: 0, py: 0, a: 0, al: 'c', boxes: [b] };
    }
    var order = [it.pref || 'below'], prev = it.on && it.pl && it.pl.side;
    if (prev) order.unshift(prev);
    /* icon captions stay square to their icon (a diagonal caption reads as its neighbour's); small marks may go diagonal */
    (it.k === 'poi' || it.k === 'hub' ? ['below', 'right', 'left', 'above'] : ['right', 'left', 'below', 'above', 'br', 'bl', 'tr', 'tl']).forEach(function (d) { if (order.indexOf(d) < 0) order.push(d); });
    var G_ = it.k === 'bridge' || it.k === 'junc' ? 3 : 4;
    for (var i = 0; i < order.length; i++) {
      var v = OVL_SIDES[order[i]];
      if (!v) continue;
      var kx = v[0] * it.iw / 2, ky = v[1] * it.ih / 2, px = v[0] * (G_ + w / 2), py = v[1] * (G_ + h / 2);
      var cx = ax + kx * s + px, cy = ay + ky * s + py, bb = { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
      if (boxIn(bb, view) && !grid.hitK(bb, it.k))
        return { mx: it.x, my: it.y, kx: kx, ky: ky, px: px, py: py, a: 0, side: order[i], al: v[0] > 0 ? 'l' : v[0] < 0 ? 'r' : 'c', boxes: [bb] };
    }
    return null;
  };

  /* straight chord of a line around arc position u: null if the line bends more than `tol` px under the label */
  function ovlChord(Ln, u, half, s, tol) {
    var a = lineAt(Ln, u - half), b = lineAt(Ln, u + half), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < half * 1.8) return null;
    var ux = dx / L, uy = dy / L;
    for (var i = a[3]; i <= b[2]; i++) if (Math.abs((Ln.X[i] - a[0]) * uy - (Ln.Y[i] - a[1]) * ux) * s > tol) return null;
    if (ux < -1e-3 || (Math.abs(ux) <= 1e-3 && uy > 0)) { ux = -ux; uy = -uy; }   /* keep text upright */
    return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, ux: ux, uy: uy };
  }
  function ovlVisible(Ln, s, tx, ty, v) {
    var bb = Ln.bb;
    if (bb[2] * s + tx < v.x0 || bb[0] * s + tx > v.x1 || bb[3] * s + ty < v.y0 || bb[1] * s + ty > v.y1) return null;
    var u0 = Infinity, u1 = -Infinity;
    for (var i = 0; i < Ln.X.length; i++) {
      var X = Ln.X[i] * s + tx, Y = Ln.Y[i] * s + ty;
      if (X > v.x0 && X < v.x1 && Y > v.y0 && Y < v.y1) { if (Ln.S[i] < u0) u0 = Ln.S[i]; if (Ln.S[i] > u1) u1 = Ln.S[i]; }
    }
    return u1 > u0 ? [u0, u1] : null;
  }
  function ovlCands(it, li, r, half, step) {
    var pref = it.on && it.pl && it.pl.li === li ? it.pl.u : (r[0] + r[1]) / 2, c = [];
    for (var u = r[0] + half; u <= r[1] - half; u += step) c.push(u);
    if (pref >= r[0] + half && pref <= r[1] - half) c.push(pref);
    return c.sort(function (a, b) { return Math.abs(a - pref) - Math.abs(b - pref); }).slice(0, 48);
  }

  /* road / transit names: on (or beside) the straightest visible stretch, upright */
  P.ovlPath = function (it, cam, view, grid) {
    var s = cam.s, tx = cam.tx, ty = cam.ty, w = it.w, h = it.h, tol = OVL.tol[it.k] || 2;
    var half = (w / 2 + 4) / s, step = OVL.step / s;
    var off = it.k === 'art' ? h / 2 + 2.6 * s + 2 : it.k === 'line' ? h / 2 + 2 : 0;   /* px from the centre line */
    var idx = it.lines.map(function (_, i) { return i; });
    if (it.on && it.pl) idx.sort(function (a, b) { return (b === it.pl.li) - (a === it.pl.li); });
    for (var q = 0; q < idx.length; q++) {
      var li = idx[q], Ln = it.lines[li];
      if (Ln.len < 2 * half) continue;
      var r = ovlVisible(Ln, s, tx, ty, view);
      if (!r || r[1] - r[0] < 2 * half) continue;
      var cands = ovlCands(it, li, r, half, step);
      for (var k = 0; k < cands.length; k++) {
        var ch = ovlChord(Ln, cands[k], half, s, tol);
        if (!ch) continue;
        var sides = off ? (it.on && it.pl && it.pl.side === -1 ? [-1, 1] : [1, -1]) : [0];
        for (var j = 0; j < sides.length; j++) {
          var nx = -ch.uy * off * sides[j], ny = ch.ux * off * sides[j];
          var cx = ch.x * s + tx + nx, cy = ch.y * s + ty + ny, n = Math.max(1, Math.ceil(w / h)), boxes = [], ok = true;
          for (var m = 0; m < n && ok; m++) {
            var t = n === 1 ? 0 : -w / 2 + h / 2 + m * (w - h) / (n - 1);
            var b = { x: cx + ch.ux * t - h / 2, y: cy + ch.uy * t - h / 2, w: h, h: h };
            if (!boxIn(b, view) || grid.hitK(b, it.k)) ok = false; else boxes.push(b);
          }
          if (ok) return { mx: ch.x, my: ch.y, kx: 0, ky: 0, px: nx, py: ny, a: Math.atan2(ch.uy, ch.ux) * 180 / Math.PI, li: li, u: cands[k], side: sides[j], al: 'c', boxes: boxes };
        }
      }
    }
    return null;
  };

  /* river name: letter by letter along its curve (gentle bends only), repeats kept far apart */
  P.ovlGlyphs = function (it, Ln, u, s, tx, ty) {
    var W = 0; it.chars.forEach(function (c) { W += c.w; });
    var a = lineAt(Ln, u - W / 2 / s), b = lineAt(Ln, u + W / 2 / s), rev = b[0] < a[0], dir = rev ? -1 : 1;
    var pos = u - dir * W / 2 / s, out = [], prev = null, turn = 0;
    for (var i = 0; i < it.chars.length; i++) {
      var cw = it.chars[i].w / s, mid = pos + dir * cw / 2, p0 = lineAt(Ln, mid - dir * Math.max(cw, 4 / s)), p1 = lineAt(Ln, mid + dir * Math.max(cw, 4 / s));
      var ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), pm = lineAt(Ln, mid);
      if (prev != null) { var d = Math.abs(((ang - prev + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); if (d > 0.4) return null; turn += d; }
      prev = ang; out.push([pm[0] * s + tx, pm[1] * s + ty, ang * 180 / Math.PI]); pos += dir * cw;
    }
    return turn > 1.1 ? null : out;
  };
  P.ovlCurve = function (it, cam, view, grid, groups) {
    var s = cam.s, tx = cam.tx, ty = cam.ty, W = 0, h = it.h;
    it.chars.forEach(function (c) { W += c.w; });
    var half = (W / 2 + 6) / s, step = 26 / s, near = groups[it.grp] || [];
    for (var li = 0; li < it.lines.length; li++) {
      var Ln = it.lines[li];
      if (Ln.len < 2 * half) continue;
      var r = ovlVisible(Ln, s, tx, ty, view);
      if (!r || r[1] - r[0] < 2 * half) continue;
      var cands = ovlCands(it, li, r, half, step);
      for (var k = 0; k < cands.length; k++) {
        var g = this.ovlGlyphs(it, Ln, cands[k], s, tx, ty);
        if (!g) continue;
        var c = g[g.length >> 1];
        if (near.some(function (p) { return Math.hypot(p[0] - c[0], p[1] - c[1]) < OVL.rep; })) continue;
        var boxes = [], ok = true;
        for (var m = 0; m < g.length && ok; m++) {
          var b = { x: g[m][0] - h / 2, y: g[m][1] - h / 2, w: h, h: h };
          if (!boxIn(b, view) || grid.hitK(b, it.k)) ok = false; else boxes.push(b);
        }
        if (ok) return { li: li, u: cands[k], c: [c[0], c[1]], boxes: boxes };
      }
    }
    return null;
  };

  /* every frame the camera moves: labels ride with the map (their spots are re-solved by ovlLayout) */
  P.ovlFollow = function () {
    if (!this.ovl) return;
    var c = this.layers.overview.cam, s = c.s;
    for (var i = 0; i < this.ovl.length; i++) {
      var it = this.ovl[i], pl = it.pl;
      if (!pl) continue;
      if (it.chars) {
        var g = this.ovlGlyphs(it, it.lines[pl.li], pl.u, s, c.tx, c.ty);
        if (!g) continue;
        for (var j = 0; j < g.length; j++) {
          var ch = it.chars[j], t = 'translate(' + g[j][0].toFixed(1) + 'px,' + g[j][1].toFixed(1) + 'px) rotate(' + g[j][2].toFixed(1) + 'deg) translate(-50%,-50%)';
          if (ch.tf !== t) { ch.tf = t; ch.el.style.transform = t; }
        }
        continue;
      }
      var x = (pl.mx + pl.kx) * s + c.tx + pl.px, y = (pl.my + pl.ky) * s + c.ty + pl.py;
      var tf = pl.a ? 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + pl.a.toFixed(1) + 'deg) translate(-50%,-50%)'
        : 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-50%)';
      if (it.tf !== tf) { it.tf = tf; it.el.style.transform = tf; }
      if (it.al !== pl.al) { it.al = pl.al; it.el.setAttribute('data-al', pl.al); }
    }
  };

  /* TOD plan: the four Figma layers stacked (base, arrows 5.4, transit icons 5.3, routes 5.2) */
  P.buildPlan = function () {
    var c = this.layers.plan2d.canvas;
    var img = el('img', 'mm-base'); img.src = IMG + 'map-sala-2d.jpg'; img.alt = 'Bản đồ kết nối TOD khu đô thị Sala'; img.draggable = false;
    c.appendChild(img);
    this.planLayers = ['plan-arrows', 'plan-icons', 'plan-routes'].map(function (n) {
      var o = el('img', 'mm-base mm-plan-layer mm-plan-layer--' + n.split('-')[1]); o.src = IMG + n + '.webp'; o.alt = ''; o.draggable = false;
      c.appendChild(o); return o;
    });
  };

  P.buildMaster = function () {
    var self = this, L = this.layers.master3d, c = L.canvas, W = MAPS.master3d.w, H = MAPS.master3d.h;
    /* Figma "Map" 49:7667 — depth: a muted, darker, top-blurred base image with the SALA core
       shown on top in full colour and full sharpness through a soft (85px-blurred) focus mask */
    if (CONFIG.master3dBaked) {
      /* v9.6: the client's graded render (same framing as map-3d.jpg, registered at 1.1596x, 0.4 px median error).
         Its depth, vignette and colour are baked in, so it is shown as is: no extra grade, blur, dim or focus layers. */
      var baked = el('img', 'mm-base mm-3d-baked'); self.lazy(baked, 'master3d', IMG + CONFIG.master3dBaked); baked.alt = 'Phối cảnh tổng thể Khu đô thị Sala'; baked.draggable = false;
      c.appendChild(baked);
    } else {
    var img = el('img', 'mm-base mm-3d-base'); self.lazy(img, 'master3d', IMG + 'map-3d.webp'); img.alt = 'Phối cảnh tổng thể Khu đô thị Sala'; img.draggable = false;
    c.appendChild(img);
    /* progressive layer blur ~5.7px at the top fading out by 56% height (depth of field) */
    var dof = el('img', 'mm-base mm-3d-base mm-dof'); self.lazy(dof, 'master3d', IMG + 'map-3d.webp'); dof.alt = ''; dof.draggable = false;
    c.appendChild(dof);
    c.appendChild(el('div', 'mm-3d-dim'));
    var focus = el('img', 'mm-base mm-3d-focus'); self.lazy(focus, 'master3d', IMG + 'map-3d.webp'); focus.alt = ''; focus.draggable = false;
    c.appendChild(focus);
    c.appendChild(el('div', 'mm-softlight'));
    }

    /* ---- one SVG in map space: spotlight, project zones, roads ---- */
    var svg = this.mSvg = svgEl('svg', { 'class': 'mm-msvg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    svg.__host = { app: this, map: 'master3d' };
    var defs = '<defs>' +
      /* Figma material (Vector 2392): fill #BC8E49→#564121 @60%, stroke #E1CFA6→transparent */
      '<linearGradient id="mmZoneFill" x1="0.5" y1="0" x2="0.5" y2="1"><stop stop-color="#BC8E49"/><stop offset="1" stop-color="#564121"/></linearGradient>' +
      '<linearGradient id="mmZoneStroke" x1="0.68" y1="0.28" x2="0.46" y2="0.97"><stop stop-color="#E1CFA6"/><stop offset="1" stop-color="#7B715B" stop-opacity="0"/></linearGradient>' +
      '<filter id="mmGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>' + cometGradDefs('mmCometGradM') +
      /* road light filters, sized to match the overview's on screen (roads are scaled by 1/1.289) */
      '<filter id="mmRdGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6.45"/></filter>' +
      '<filter id="mmRdSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.87"/></filter>' +
      '<mask id="mmSpotMask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '"><rect width="' + W + '" height="' + H + '" fill="#fff"/><path class="mm-spot-hole" d="" fill="#000"/></mask>';
    D.lights.forEach(function (ln) {
      defs += '<linearGradient id="mmL_' + ln.id + '" x1="0" y1="0" x2="' + ln.w + '" y2="0" gradientUnits="userSpaceOnUse">' +
        '<stop stop-color="' + ln.color + '" stop-opacity="0"/><stop offset=".5" stop-color="' + ln.color + '"/><stop offset="1" stop-color="' + ln.color + '" stop-opacity="0"/></linearGradient>';
    });
    svg.innerHTML = defs + '</defs>';
    this.spot = svgEl('rect', { 'class': 'mm-spot', width: W, height: H, mask: 'url(#mmSpotMask)' });
    svg.appendChild(this.spot);
    this.spotHole = svg.querySelector('.mm-spot-hole');
    G.set(this.spot, { opacity: 0 });

    /* roads — same logic as the overview: hover dims the map, lights the road, fades the other comets */
    this.rdDim = svgEl('rect', { 'class': 'mm-ov-dim', width: W, height: H });
    svg.appendChild(this.rdDim);
    G.set(this.rdDim, { opacity: 0 });
    var gRoads = svgEl('g', { 'class': 'mm-roads' });
    svg.appendChild(gRoads);
    var K = 1 / 1.289;
    this.roads = {};
    D.lights.forEach(function (ln) {
      var g = svgEl('g', { 'class': 'mm-road-g' + (ln.gold ? ' is-gold' : ''), transform: 'scale(' + K.toFixed(5) + ') translate(' + ln.ox + ' ' + ln.oy + ')' });
      /* static road line: tapered to 0% at both ends of the road */
      /* idle: no road line at all (0%) — only the running comet; the bold Figma stroke is the hover state */
      var base = null;
      /* hover highlight + idle comet: the same ROAD_FX as the overview roads */
      var fx = roadLights(svg, g, ln.d, 1.289, 'mmCometGradM', 'mmRdGlow', 'mmRdSoft', ln.dur, 1), hl = fx.hl, comet = fx.comet;
      var hit = svgEl('path', { 'class': 'mm-road-hit', d: ln.d });
      g.appendChild(hit);
      var tp = null, text = null, tpath = null;   /* no road names along the roads: not in the design */
      gRoads.appendChild(g);
      var road = { ln: ln, g: g, base: base, comet: comet, hl: hl, hit: hit, text: text, tpath: tpath, tp: tp };
      self.roads[ln.id] = road;
      /* road name pops up only on hover (both modes, same as the overview) */
      function tag(e) { if (self.rdHover === ln.id) self.showRoadTag('master3d', road, ln.name, ln.gold, e); }
      hit.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { self.hoverRoad(ln.id, true); tag(e); } });
      hit.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') tag(e); });
      hit.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.hoverRoad(ln.id, false); });
      /* touch: tap a road to light it up, tap again to clear (same as the overview) */
      hit.addEventListener('click', function (e) {
        if (self.suppress) return;
        if (self.rdHover === ln.id && e.pointerType === 'touch') return self.hoverRoad(ln.id, false);
        self.hoverRoad(ln.id, true); tag(e);
      });
    });

    /* project zones */
    var gZones = svgEl('g', { 'class': 'mm-zones' });
    svg.appendChild(gZones);
    /* building outlines drawn in Figma (43:7639): each keeps its own fill / stroke gradient */
    var zDefs = svg.querySelector('defs');
    function grad(id, xy, stops) {
      var lg = svgEl('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: xy[0], y1: xy[1], x2: xy[2], y2: xy[3] });
      stops.forEach(function (st) { lg.appendChild(svgEl('stop', { offset: st[0], 'stop-color': st[1], 'stop-opacity': st[2] == null ? 1 : st[2] })); });
      zDefs.appendChild(lg);
    }
    D.projects.concat(D.landmarks || []).forEach(function (p) {
      var zs = (D.projectZones || {})[p.zone || p.id];
      if (!zs || !zs.length) return;
      var g = svgEl('g', { 'class': 'mm-zone-g' }), fx = [], ds = [];
      /* Figma 57:7825: the building itself, cut from the dusk render (lights on) by its outline */
      var cid = 'mmZC_' + p.id, clip = svgEl('clipPath', { id: cid });
      zs.forEach(function (z) { clip.appendChild(svgEl('path', { d: z.d })); });
      zDefs.appendChild(clip);
      var lit = svgEl('image', { 'class': 'mm-zone-lit', x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none', 'clip-path': 'url(#' + cid + ')' });
      self.lazy(lit, 'master3d', IMG + 'map-3d-dusk.webp');
      g.appendChild(lit); fx.push(lit);
      zs.forEach(function (z, i) {
        var fid = 'mmZF_' + p.id + '_' + i, sid = 'mmZS_' + p.id + '_' + i;
        /* v10.9: a project not yet on sale (Chưa mở bán) lights up in neutral greys instead of Sala gold */
        var neutral = p.status === 'closed';
        grad(fid, z.fill, neutral ? [[0, '#BDBAB4'], [1, '#55524D']] : z.fillStops);
        grad(sid, z.stroke, neutral ? [[0, '#F2F0EC', 1], [1, '#9A968E', 0]] : z.strokeStops);
        var fill = svgEl('path', { 'class': 'mm-zone-fill', d: z.d, fill: 'url(#' + fid + ')' });
        var line = svgEl('path', { 'class': 'mm-zone-line', d: z.d, stroke: 'url(#' + sid + ')', 'stroke-width': Math.max(1, z.sw * 1.6).toFixed(2) });
        g.appendChild(fill); g.appendChild(line); fx.push(fill, line); ds.push(z.d);
      });
      var d = ds.join(' ');
      gZones.appendChild(g);
      /* hover: a soft comet runs once around the outline (0% at head and tail) */
      var nt = p.status === 'closed';
      if (nt) g.classList.add('is-neutral');
      var trace = makeLight(svg, g, d, { grad: 'mmCometGradM', color: nt ? '#e8e6e2' : '#ffd98f', core: nt ? '#ffffff' : '#fff8ea', width: 1.8, glowWidth: 6, glowFilter: 'mmGlow', radius: 9, spacing: 3.5, profile: 'comet', head: 16, tail: 260, endFade: 6 });
      G.set(trace.g, { opacity: 0 });
      G.set(fx, { opacity: 0 });
      p._zone = { g: g, fx: fx, trace: trace, d: d, tr: '' };
      g.addEventListener('pointerenter', function () { self.hoverProject(p, true); });
      g.addEventListener('pointerleave', function () { self.hoverProject(p, false); });
      g.addEventListener('click', function () { if (!self.suppress && !p.zone) self.select('project', p); });
    });
    c.appendChild(svg);

    /* bridge / road labels (page: designer pills; section: bridges only as compact markers) */
    D.roads.forEach(function (r) {
      if (r.hidden) return;
      /* bridges: one node per bridge — a dot with its name badge right beside it (no leader line).
         Off-screen, the dot waits on the frame edge with the badge on the inner side; as the bridge comes
         into the frame the same dot travels onto it and the badge stays next to it (see updateEdges). */
      if (r.bridge) {
        var e = el('div', 'mm-edge', '<span class="mm-edge__dot"></span><button type="button" class="mm-edge__pill">' + esc(r.name) + '</button>');
        var pulse = function () { var d = e.querySelector('.mm-edge__dot'); G.fromTo(d, { boxShadow: '0 0 0 2px rgba(122,122,122,.9), 0 0 0 0 rgba(255,254,242,.7)' }, { boxShadow: '0 0 0 2px rgba(122,122,122,.9), 0 0 0 18px rgba(255,254,242,0)', duration: 0.9, ease: 'power2.out' }); };
        e.querySelector('.mm-edge__pill').addEventListener('pointerenter', pulse);
        e.querySelector('.mm-edge__pill').addEventListener('click', function () {
          if (self.busy) return;
          var it = (self.edgeEls || []).filter(function (q) { return q.el === e; })[0];
          if (it && !it.off) return pulse();
          var cam = self.layers.master3d.cam;
          self.animateCam('master3d', self.clampCam('master3d', self.camAround('master3d', r.x, r.y + 60, cam.s)), 1.1, 'power2.inOut');
          G.delayedCall(1.1, pulse);
        });
        self.layers.master3d.markersEl.appendChild(e);   /* same stacking layer as labels, so the hover road name can sit above it */
        (self.edgeEls = self.edgeEls || []).push({ el: e, r: r, on: false, side: null });
        return;
      }
      /* streets: no permanent label — like the overview, the name only pops up while the road is hovered */
    });

    this.makeRoadTag('master3d');

    D.projects.forEach(function (p) {
      var b = el('button', 'mm-proj mm-proj--' + p.side);
      b.type = 'button';
      b._pole = p.pole || 1;   /* v9.0: some Figma flags have a shorter pole (70 / 120 px) */
      b.setAttribute('data-status', p.status || 'closed');   /* v10.6: status dot before the name */
      b.setAttribute('aria-label', p.name);
      b.innerHTML = '<span class="mm-proj__line"></span><span class="mm-proj__tag">' + esc(p.name) + '</span>';
      b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') self.hoverProject(p, true); });
      b.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.hoverProject(p, false); });
      b.addEventListener('focus', function () { self.hoverProject(p, true); });
      b.addEventListener('blur', function () { self.hoverProject(p, false); });
      b.addEventListener('click', function () { if (!self.suppress) self.select('project', p); });
      p._el = b;
      self.addMarker('master3d', b, p.x, p.y, 'proj-' + p.side);
    });
    /* landmarks (v9.4): the gold Figma road tag, always shown; hover lights its outline */
    (D.landmarks || []).forEach(function (p) {
      var n = el('div', 'mm-road mm-road--up mm-road--gold mm-landmark', '<span class="mm-road__pill"></span><span class="mm-road__line"></span><span class="mm-road__dot"></span>');
      n.querySelector('.mm-road__pill').textContent = p.name;
      n._len = 20;   /* v11.0: 20 px leader (v10.5 had 16, too short) */
      n.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') self.hoverProject(p, true); });
      n.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.hoverProject(p, false); });
      n.addEventListener('click', function () { if (!self.suppress) self.hoverProject(p, !(self.hovered === p)); });
      p._el = n;
      self.addMarker('master3d', n, p.x, p.y, 'road-up');
    });
  };

  P.buildAmenity = function () {
    var self = this, c = this.layers.amenity.canvas;
    /* v9.7 (Figma 28418:14159): the same urban 3D render as Khu đô thị, shown as is; no dim on hover */
    var img = el('img', 'mm-base mm-3d-baked'); self.lazy(img, 'amenity', IMG + (CONFIG.master3dBaked || 'map-3d.webp')); img.alt = 'Bản đồ tiện ích Khu đô thị Sala'; img.draggable = false;
    c.appendChild(img);
    D.amenities.forEach(function (a) {
      var b = el('button', 'mm-pin' + (a.featured ? ' mm-pin--featured' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', a.name);
      /* hover / keyboard focus: the amenity name rises above the node */
      b.innerHTML = '<span class="mm-pin__pulse"></span>' + icon(I.amenity[a.icon]) +
        '<span class="mm-pin__tip" aria-hidden="true">' + esc(a.name) + '</span>';
      b.addEventListener('click', function () { if (!self.suppress) self.select('amenity', a); });
      /* v10.4: pins that share a name are one place (Tháp Đôi Văn Phòng A+, Chuỗi TTTM Đa Chức Năng):
         hovering any of them lights all of them in pink; only the hovered one shows the name tag */
      function twins(on) { D.amenities.forEach(function (o) { if (o !== a && o.name === a.name && o._el) o._el.classList.toggle('is-twin', on); }); }
      b.addEventListener('pointerenter', function () { twins(true); });
      b.addEventListener('pointerleave', function () { twins(false); });
      b.addEventListener('focus', function () { twins(true); });
      b.addEventListener('blur', function () { twins(false); });
      a._el = b;
      self.addMarker('amenity', b, a.x, a.y);
    });
    this.buildAmenityLines(c);
  };

  /* v10.1: lines on the amenity map (Tuyến Buggy), with the same light + hover as the urban map roads */
  P.buildAmenityLines = function (c) {
    var self = this, R = D.amenityLines || [], W = MAPS.amenity.w, H = MAPS.amenity.h;
    if (!R.length) return;
    var svg = svgEl('svg', { 'class': 'mm-msvg mm-alines', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    svg.__host = { app: this, map: 'amenity' };
    svg.innerHTML = '<defs><filter id="mmAGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '<filter id="mmASoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>' + cometGradDefs('mmCometGradA') + '</defs>';
    this.alDim = svgEl('rect', { 'class': 'mm-ov-dim', width: W, height: H });
    svg.appendChild(this.alDim); G.set(this.alDim, { opacity: 0 });
    this.alines = {};
    R.forEach(function (ln) {
      var g = svgEl('g', { 'class': 'mm-road-g' });
      var fx = roadLights(svg, g, ln.d, 1, 'mmCometGradA', 'mmAGlow', 'mmASoft', ln.dur || 6, 1);
      var hit = svgEl('path', { 'class': 'mm-road-hit', d: ln.d });
      g.appendChild(hit); svg.appendChild(g);
      var o = self.alines[ln.id] = { ln: ln, g: g, hl: fx.hl, comet: fx.comet, hit: hit, pts: null };
      function tag(e) { if (self.alHover === ln.id) self.showRoadTag('amenity', o, ln.name, false, e); }
      hit.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { self.hoverALine(ln.id, true); tag(e); } });
      hit.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') tag(e); });
      hit.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.hoverALine(ln.id, false); });
      hit.addEventListener('click', function (e) {
        if (self.suppress) return;
        if (self.alHover === ln.id && e.pointerType === 'touch') return self.hoverALine(ln.id, false);
        self.hoverALine(ln.id, true); tag(e);
      });
    });
    c.appendChild(svg);
    this.makeRoadTag('amenity');
  };
  P.hoverALine = function (id, on) {
    if (on && (this.active !== 'amenity' || this.busy)) return;
    var self = this, r = this.alines && this.alines[id];
    if (!r) return;
    if (on && this.alHover && this.alHover !== id) this.hoverALine(this.alHover, false);
    if (!on && this.alHover !== id) return;
    this.alHover = on ? id : null;
    Object.keys(this.alines).forEach(function (k) { G.to(self.alines[k].comet.g, { opacity: on && k !== id ? 0.15 : 1, duration: 0.4, overwrite: 'auto' }); });
    r.g.classList.toggle('is-hover', on);
    G.to(this.alDim, { opacity: on ? 1 : 0, duration: 0.5, ease: 'power2.out', overwrite: true });
    if (on) r.hl.show(1.1);
    else { r.hl.hide(0.4); this.hideRoadTag('amenity'); }
  };

  /* ---------- layout & camera ---------- */
  P.layoutName = function () {
    var w = this.fw, h = this.fh;
    if (this.mode === 'section') return w < 760 ? 'section-mobile' : 'section-desktop';
    if (h <= 500 && w > h) return 'page-landscape';
    if (w < 760) return 'section-mobile';
    return 'page-desktop';
  };

  P.measure = function () {
    var r = this.stage.getBoundingClientRect();
    this.fw = r.width || this.frame.clientWidth;
    this.fh = r.height || this.frame.clientHeight;
    this.layout = this.layoutName();
    this.mobile = this.layout === 'section-mobile' || this.layout === 'page-landscape';
    this.root.setAttribute('data-layout', this.layout);
    this.cloud.resize(this.fw, this.fh);
    var ls = this.lineScale = (this.layout === 'section-desktop' || this.layout === 'page-desktop') ? 1 : 0.72;
    var self = this;
    Object.keys(this.markers).forEach(function (k2) { self.markers[k2].forEach(function (m) { m.w = 0; }); });
    this.root.querySelectorAll('.mm-proj').forEach(function (n) { n.style.height = Math.round(PROJ_POLE * ls * (n._pole || 1)) + 'px'; });   /* v8.7: 120 → 84 */
    this.root.querySelectorAll('.mm-road').forEach(function (n) {
      var line = n.querySelector('.mm-road__line'), len = Math.round(n._len * ls);
      if (n.classList.contains('mm-road--left') || n.classList.contains('mm-road--right')) line.style.width = len + 'px';
      else line.style.height = len + 'px';
    });
    this.placeRoadNames();
  };

  /* put each road name at the point of its path nearest to the designer's label anchor */
  P.placeRoadNames = function () {
    return;
    var self = this;
    if (this._namesPlaced) return;
    Object.keys(this.roads || {}).forEach(function (id) {
      var r = self.roads[id], ln = r.ln, path = r.tp;
      var len; try { len = path.getTotalLength(); } catch (e) { return; }
      if (!len) return;
      var tx = ln.textAt[0] * 1.289 - ln.ox, ty = ln.textAt[1] * 1.289 - ln.oy, best = 0, bd = Infinity;
      for (var i = 0; i <= 240; i++) {
        var pt = path.getPointAtLength(len * i / 240), d = (pt.x - tx) * (pt.x - tx) + (pt.y - ty) * (pt.y - ty);
        if (d < bd) { bd = d; best = i / 240; }
      }
      r.tpath.setAttribute('startOffset', (best * 100).toFixed(1) + '%');
      self._namesPlaced = true;
    });
  };

  P.panelIsOverlay = function () { return this.mobile || this.fw < 900; };

  P.defaultCam = function (map) {
    var L = LAYOUTS[this.layout], c = L.cams[map];
    var k = Math.max(this.fw / L.dw, this.fh / L.dh), s = c[2] * k;
    this.layers[map].sMax = s * 3.5;   /* zoom-in limit stays where the designed view put it */
    if (map === 'master3d' || map === 'overview' || map === 'amenity') {
      /* every map opens fully zoomed out (the whole map, feedback 02/11); zooming in is the visitor's choice */
      var b = MAPS[map].bounds, w = this.fw - (this.padRight || 0);
      s = Math.max(w / (b[2] - b[0]), this.fh / (b[3] - b[1]));
      this.layers[map].sDefault = s;
      /* v10.5: on the 3D maps the opening view keeps the bottom edge (marina) in frame; any crop comes off the top */
      var ty = (map === 'master3d' || map === 'amenity') ? this.fh - b[3] * s : this.fh / 2 - (b[1] + b[3]) / 2 * s;
      /* v11.0: …but never so far that an always-on landmark tag (pill 26 + leader 20 + 8 px margin) leaves the top edge */
      if (map === 'master3d') (D.landmarks || []).forEach(function (l) { ty = Math.max(ty, 54 * (this.lineScale || 1) + 8 - l.y * s); }, this);
      return this.clampCam(map, { s: s, tx: w / 2 - (b[0] + b[2]) / 2 * s, ty: ty });
    }
    this.layers[map].sDefault = s;
    return this.clampCam(map, { s: s, tx: this.fw / 2 - c[0] * s, ty: this.fh / 2 - c[1] * s });
  };

  P.clampCam = function (map, cam) {
    var b = MAPS[map].bounds, bw = b[2] - b[0], bh = b[3] - b[1];
    var fw = this.fw, fh = this.fh, pad = this.padRight;
    var minS = Math.max(fw / bw, fh / bh), sDef = this.layers[map].sDefault || minS;
    var s = clamp(cam.s, minS, Math.max(this.layers[map].sMax || sDef * 3.5, minS * 1.5));
    var minTx = fw - pad - b[2] * s, maxTx = -b[0] * s;
    if (minTx > maxTx) minTx = maxTx = (fw - pad - (b[0] + b[2]) * s) / 2;
    var minTy = fh - b[3] * s, maxTy = -b[1] * s;
    if (minTy > maxTy) minTy = maxTy = (fh - (b[1] + b[3]) * s) / 2;
    return { s: s, tx: clamp(cam.tx, minTx, maxTx), ty: clamp(cam.ty, minTy, maxTy) };
  };

  P.apply = function (map) {
    var L = this.layers[map], c = L.cam;
    L.canvas.style.transform = 'translate3d(' + c.tx + 'px,' + c.ty + 'px,0) scale(' + c.s + ')';
    var ms = this.markers[map];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], x = m.x * c.s + c.tx, y = m.y * c.s + c.ty, ox = 0, oy = 0;
      if (m.anchor !== 'none') {
        if (!m.w) { m.w = m.el.offsetWidth; m.h = m.el.offsetHeight; }
        switch (m.anchor) {
          case 'proj-right': ox = -1; oy = -m.h; break;
          case 'proj-left': ox = -m.w + 1; oy = -m.h; break;
          case 'road-up': ox = -m.w / 2; oy = -m.h; break;
          case 'road-down': ox = -m.w / 2; oy = 0; break;
          case 'road-left': ox = -m.w; oy = -m.h / 2; break;
          case 'road-right': ox = 0; oy = -m.h / 2; break;
        }
      }
      /* `translate` positions the marker; GSAP keeps `transform` free for its own motion */
      m.wrap.style.translate = Math.round(x + ox) + 'px ' + Math.round(y + oy) + 'px';
    }
    if (this.hovered && map === this.active) this.placeCard();
    if (map === 'master3d') this.updateEdges();
    if (map === 'overview') this.ovlUpdate();
    /* clouds sit above the map: they follow the camera at 60% speed (parallax) */
    if (map === this.active && this.cloud && !this.busy) {
      var pp = this.cloudPan(map, c);
      this.cloud.u.panX = pp[0]; this.cloud.u.panY = pp[1];
    }
  };

  /* cloud parallax offset for a camera (clouds follow the map at 60%) */
  P.cloudPan = function (map, c) {
    var cc = this.centerOf(map, c), mm = Math.min(this.fw, this.fh) || 1;
    return [cc[0] * c.s / mm * 2.4 * 0.6, -cc[1] * c.s / mm * 2.4 * 0.6];
  };

  /* bridge nodes that are outside the frame are pinned to the frame edge (with a direction arrow) */
  P.updateEdges = function () {
    if (!this.edgeEls) return;
    var c = this.layers.master3d.cam, show = this.active === 'master3d';
    var L = 22, T = 22, R = this.fw - 22 - (this.padRight || 0), B = this.fh - (this.mode === 'section' ? 96 : 104);
    var ctl = this.controls ? this.controls.getBoundingClientRect() : null, fr = this.stage.getBoundingClientRect();
    var ctlR = ctl ? ctl.right - fr.left + 18 : 104, ctlB = ctl ? ctl.bottom - fr.top + 10 : 280;
    var GAP = 8, placed = [];
    function hit(a) { return placed.some(function (q) { return a.x < q.x + q.w + 6 && q.x < a.x + a.w + 6 && a.y < q.y + q.h + 4 && q.y < a.y + a.h + 4; }); }
    var tagOn = this.tags && this.tags.master3d && this.tags.master3d.on;
    if (show) this.layers.master3d.markersEl.querySelectorAll('.mm-proj__tag, .mm-road .mm-road__pill').forEach(function (n) {
      if (!tagOn && n.closest('.mm-road--tag')) return;
      var r = n.getBoundingClientRect();   /* count labels by layout (they may still be fading in) */
      if (r.width) placed.push({ x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height });
    });
    var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    var sectionCalm = this.mode === 'section' || this.mobile, sMin = (this.layers.master3d.sDefault || c.s) * 1.35;
    this.edgeEls.forEach(function (e) {
      if (!show) { if (e.on) { e.on = false; e.el.classList.remove('is-on'); } return; }
      var x = e.r.x * c.s + c.tx, y = e.r.y * c.s + c.ty;
      var cy = clamp(y, T, B), left = cy < ctlB ? ctlR : L, cx = clamp(x, left, R);
      e.off = cx !== x || cy !== y;
      /* section (embed): calmer — a bridge node shows only once the visitor has zoomed in (≥ 1.35× the opening view)
         and the bridge itself is in the frame; no nodes pinned to the edges. Page keeps the full behaviour. */
      if (sectionCalm && (e.off || c.s < sMin)) { if (e.on) { e.on = false; e.el.classList.remove('is-on'); } return; }
      var pill = e.pill || (e.pill = e.el.querySelector('.mm-edge__pill')), dot = e.dot || (e.dot = e.el.querySelector('.mm-edge__dot'));
      var w = pill.offsetWidth || 120, h = pill.offsetHeight || 26;
      /* badge side: inward when pinned to an edge, otherwise the designer's side (dir); fall back to the others */
      var pref = [];
      if (x < left) pref.push('right'); if (x > R) pref.push('left'); if (y < T) pref.push('down'); if (y > B) pref.push('up');
      pref.push(e.r.dir === 'up' ? 'up' : e.r.dir === 'left' ? 'left' : e.r.dir === 'right' ? 'right' : 'down');
      ['right', 'left', 'down', 'up'].forEach(function (d) { if (pref.indexOf(d) < 0) pref.push(d); });
      var box = null, side = pref[0];
      for (var i = 0; i < pref.length; i++) {
        var v = DIRS[pref[i]], bx = cx + v[0] * (GAP + w / 2 + 4) - w / 2, by = cy + v[1] * (GAP + h / 2 + 4) - h / 2;
        bx = clamp(bx, left, R - w); by = clamp(by, T, B - h);
        var cand = { x: bx, y: by, w: w, h: h };
        if (!box) { box = cand; side = pref[i]; }
        if (!hit(cand)) { box = cand; side = pref[i]; break; }
      }
      placed.push(box);
      if (e.side && e.side !== side) {   /* glide when the badge swaps sides, instead of jumping */
        pill.classList.add('is-gliding'); clearTimeout(e.gt); e.gt = setTimeout(function () { pill.classList.remove('is-gliding'); }, 320);
      }
      e.side = side;
      dot.style.transform = 'translate(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px)';
      pill.style.transform = 'translate(' + Math.round(box.x) + 'px,' + Math.round(box.y) + 'px)';
      e.el.classList.toggle('is-off', e.off);
      if (!e.on) { e.on = true; e.el.classList.add('is-on'); }
    });
  };

  P.setCam = function (map, cam, noClamp) { this.layers[map].cam = noClamp ? cam : this.clampCam(map, cam); this.apply(map); };

  P.centerOf = function (map, cam) { var c = cam || this.layers[map].cam; return [(this.fw / 2 - c.tx) / c.s, (this.fh / 2 - c.ty) / c.s]; };
  P.camAround = function (map, x, y, s, viewW) { var vw = viewW == null ? this.fw : viewW; return { s: s, tx: vw / 2 - x * s, ty: this.fh / 2 - y * s }; };
  P.zoomedFrom = function (map, cam, f) { var c = this.centerOf(map, cam); return this.camAround(map, c[0], c[1], cam.s * f); };

  /* camera tween in center/log-scale space so zooms feel like a real camera */
  P.animateCam = function (map, target, dur, ease) {
    var self = this, L = this.layers[map];
    if (L.tween) L.tween.kill();
    var from = { s: L.cam.s, tx: L.cam.tx, ty: L.cam.ty };
    var c0 = this.centerOf(map, from), c1 = this.centerOf(map, target), o = { p: 0 };
    L.tween = G.to(o, {
      p: 1, duration: dur, ease: ease || 'power2.inOut',
      onUpdate: function () {
        var e = o.p, s = from.s * Math.pow(target.s / from.s, e);
        var cx = c0[0] + (c1[0] - c0[0]) * e, cy = c0[1] + (c1[1] - c0[1]) * e;
        L.cam = { s: s, tx: self.fw / 2 - cx * s, ty: self.fh / 2 - cy * s };
        self.apply(map);
      },
      onComplete: function () { L.tween = null; }
    });
    return L.tween;
  };

  P.zoomBy = function (f, px, py, animate) {
    if (this.busy) return;
    var map = this.active, c = this.layers[map].cam;
    if (px == null) { px = (this.fw - this.padRight) / 2; py = this.fh / 2; }
    var s = this.clampCam(map, { s: c.s * f, tx: 0, ty: 0 }).s;
    var cam = this.clampCam(map, { s: s, tx: px - (px - c.tx) * (s / c.s), ty: py - (py - c.ty) * (s / c.s) });
    if (animate) this.animateCam(map, cam, 0.55, 'power3.out'); else this.setCam(map, cam, true);
  };

  /* ---------- interaction ---------- */
  P.bind = function () {
    var self = this, stage = this.stage;
    this.root.addEventListener('click', function (e) {
      /* "Xem chi tiết" with no page yet: a short notice instead of a dead link */
      var cta = e.target.closest('.mm-cta');
      if (cta && self.root.contains(cta) && (!cta.getAttribute('href') || cta.getAttribute('href') === '#')) {
        e.preventDefault(); self.toast(cta.getAttribute('data-toast') || 'Tính năng đang được phát triển'); return;
      }
      var t = e.target.closest('[data-go],[data-act]');
      if (!t || !self.root.contains(t)) return;
      if (t.hasAttribute('data-go')) self.go(t.getAttribute('data-go'));
      var a = t.getAttribute('data-act');
      if (a === 'zin') self.zoomBy(1.5, null, null, true);
      if (a === 'zout') self.zoomBy(1 / 1.5, null, null, true);
      if (a === 'reload') self.reload();
      if (a === 'full') self.toggleFullscreen();
    });
    this.panel.querySelector('.mm-panel__close').addEventListener('click', function () { self.deselect(); });
    this.backdrop.addEventListener('click', function () { self.deselect(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && self.selection) self.deselect(); });

    var pts = new Map(), start = null, track = [];
    var coop = this.mode === 'section';
    if (coop) stage.classList.add('is-coop');
    function snapshot() {
      var arr = Array.from(pts.values()), cx = 0, cy = 0;
      arr.forEach(function (p) { cx += p.x; cy += p.y; });
      cx /= arr.length; cy /= arr.length;
      var d = arr.length > 1 ? Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) : 0;
      var c = self.layers[self.active].cam;
      return { cx: cx, cy: cy, d: d, cam: { s: c.s, tx: c.tx, ty: c.ty }, n: arr.length };
    }
    function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    stage.addEventListener('pointerdown', function (e) {
      if (coop && e.pointerType === 'touch') return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (self.busy) return;
      self.suppress = false;
      pts.set(e.pointerId, local(e));
      start = snapshot(); start.moved = 0; track = [];
      var L = self.layers[self.active]; if (L.tween) L.tween.kill();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId) || self.busy) return;
      pts.set(e.pointerId, local(e));
      var now = snapshot();
      if (now.n !== start.n) { start = now; start.moved = 99; return; }
      var dx = now.cx - start.cx, dy = now.cy - start.cy;
      start.moved = Math.max(start.moved, Math.hypot(dx, dy));
      if (start.moved < 4) return;
      if (!stage.classList.contains('is-dragging')) {
        stage.classList.add('is-dragging'); self.hideCard();
        try { stage.setPointerCapture(e.pointerId); } catch (err) { }
      }
      self.suppress = true;
      var c = start.cam, s = c.s;
      if (now.n > 1 && start.d) s = self.clampCam(self.active, { s: c.s * (now.d / start.d), tx: 0, ty: 0 }).s;
      self.setCam(self.active, { s: s, tx: now.cx - (start.cx - c.tx) * (s / c.s), ty: now.cy - (start.cy - c.ty) * (s / c.s) });
      track.push({ t: performance.now(), x: now.cx, y: now.cy });
      if (track.length > 6) track.shift();
    });
    function end(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        stage.classList.remove('is-dragging');
        /* inertia: keep gliding with the release velocity */
        if (track.length > 2 && self.suppress) {
          var a = track[0], b = track[track.length - 1], dt = (b.t - a.t) / 1000;
          if (dt > 0 && performance.now() - b.t < 80) {
            var vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
            if (Math.hypot(vx, vy) > 180) {
              var c = self.layers[self.active].cam;
              self.animateCam(self.active, self.clampCam(self.active, { s: c.s, tx: c.tx + vx * 0.32, ty: c.ty + vy * 0.32 }), 0.9, 'power3.out');
            }
          }
        }
        setTimeout(function () { self.suppress = false; }, 0);
      } else { start = snapshot(); start.moved = 99; }
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('click', function (e) { if (self.suppress) { e.stopPropagation(); e.preventDefault(); } }, true);

    if (coop) {
      var t0 = null;
      function tsnap(e) {
        var r = stage.getBoundingClientRect(), a = e.touches[0], b = e.touches[1], c = self.layers[self.active].cam;
        return { cx: (a.clientX + b.clientX) / 2 - r.left, cy: (a.clientY + b.clientY) / 2 - r.top, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), cam: { s: c.s, tx: c.tx, ty: c.ty } };
      }
      stage.addEventListener('touchstart', function (e) {
        if (self.busy) return;
        if (e.touches.length >= 2) { t0 = tsnap(e); self.hideHint(); var L = self.layers[self.active]; if (L.tween) L.tween.kill(); }
      }, { passive: true });
      stage.addEventListener('touchmove', function (e) {
        if (self.busy) return;
        if (e.touches.length < 2) { self.showHint('Dùng hai ngón tay để di chuyển bản đồ'); return; }
        e.preventDefault();
        if (!t0) t0 = tsnap(e);
        var n = tsnap(e), c = t0.cam, s = self.clampCam(self.active, { s: c.s * (n.d / t0.d), tx: 0, ty: 0 }).s;
        self.suppress = true;
        self.setCam(self.active, { s: s, tx: n.cx - (t0.cx - c.tx) * (s / c.s), ty: n.cy - (t0.cy - c.ty) * (s / c.s) });
      }, { passive: false });
      stage.addEventListener('touchend', function (e) { if (e.touches.length < 2) { t0 = null; setTimeout(function () { self.suppress = false; }, 50); } });
    }

    stage.addEventListener('wheel', function (e) {
      if (self.busy) return;
      var p = local(e), dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      /* plain mouse wheel zooms on both versions. In the embed, once the map can't zoom further that way
         (fully zoomed out and still scrolling down, or at max zoom), the wheel goes back to scrolling the page */
      if (self.mode === 'section' && !(e.ctrlKey || e.metaKey)) {
        var c = self.layers[self.active].cam, lim = self.clampCam(self.active, { s: dy > 0 ? 1e-6 : 1e6, tx: 0, ty: 0 }).s;
        if (Math.abs(c.s - lim) < 1e-3) return;
      }
      e.preventDefault();
      var pinch = e.ctrlKey && Math.abs(dy) < 40;
      self.zoomBy(Math.exp(-clamp(dy, -120, 120) * (pinch ? 0.012 : 0.0022)), p.x, p.y, false);
    }, { passive: false });
    stage.addEventListener('dblclick', function (e) { var p = local(e); self.zoomBy(1.6, p.x, p.y, true); });

    var rt;
    function onR() { clearTimeout(rt); rt = setTimeout(function () { self.onResize(); }, 120); }
    window.addEventListener('resize', onR);
    if (window.ResizeObserver) new ResizeObserver(onR).observe(this.frame);
  };

  P.onResize = function () {
    var w = this.fw, h = this.fh;
    this.measure();
    if (w === this.fw && h === this.fh) return;
    var self = this;
    Object.keys(MAPS).forEach(function (k) { self.layers[k].cam = self.defaultCam(k); self.apply(k); });
    if (this.selection) this.focusSelection(false);
    this.updateChrome();
  };

  P.showHint = function (msg) {
    return;   /* gesture hints are not in the design */
    var h = this.hint, self = this;
    h.textContent = msg;
    G.to(h, { autoAlpha: 1, duration: 0.25, overwrite: true });
    clearTimeout(this._hintT);
    this._hintT = setTimeout(function () { self.hideHint(); }, 1300);
  };
  P.hideHint = function () { G.to(this.hint, { autoAlpha: 0, duration: 0.3, overwrite: true }); };

  P.toggleFullscreen = function () {
    var d = document, r = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { var p = (r.requestFullscreen || r.webkitRequestFullscreen).call(r); if (p && p.catch) p.catch(function () { }); }
    } catch (e) { }
  };

  /* ---------- hover: projects ---------- */
  P.hoverProject = function (p, on) {
    if (this.active !== 'master3d' || this.busy) return;
    var z = p._zone, sel = this.selection && this.selection.item;
    if (on) {
      if (this.hovered && this.hovered !== p) this.hoverProject(this.hovered, false);
      this.hovered = p;
      p._el.classList.add('is-hover');
      this.layers.master3d.markersEl.classList.add('is-focusing');   /* other project flags turn grey while one is hovered */
      if (z) {
        this.spotHole.setAttribute('d', z.d);
        this.spotHole.setAttribute('transform', z.tr);
        G.to(this.spot, { opacity: 0.38, duration: 0.45, overwrite: true });
        G.to(z.fx, { opacity: 1, duration: 0.35, overwrite: true });
        z.trace.once(1.6);
      }
      this.showCard(p);
    } else {
      p._el.classList.remove('is-hover');
      if (this.hovered === p) this.hovered = null;
      if (!this.hovered) this.layers.master3d.markersEl.classList.remove('is-focusing');
      if (sel === p) { this.hideCard(); return; }
      if (z) {
        G.to(z.fx, { opacity: 0, duration: 0.35, overwrite: true });
        z.trace.hide(0.3);
      }
      if (!this.hovered) {
        if (sel && sel._zone) { this.spotHole.setAttribute('d', sel._zone.d); this.spotHole.setAttribute('transform', sel._zone.tr); }
        else G.to(this.spot, { opacity: 0, duration: 0.4, overwrite: true });
      }
      this.hideCard();
    }
  };

  P.showCard = function (p) {
    return;   /* no hover card: the design has only the label tag */
    if (!HOVER || (this.selection && this.selection.item === p)) return;
    var d = p.data;
    this.card.innerHTML = '<b>' + esc(d ? d.title : p.name) + '</b>' +
      (p.teaser ? '<span>' + esc(p.teaser) + '</span>' : '') +
      '<em>' + (d ? 'Nhấn để xem chi tiết' : 'Thông tin đang cập nhật') + '</em>';
    this.cardFor = p;
    this.placeCard();
    G.fromTo(this.card, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, overwrite: true });
  };
  P.placeCard = function () {
    var p = this.cardFor; if (!p || !p._el) return;
    var r = p._el.getBoundingClientRect(), fr = this.stage.getBoundingClientRect();
    var tag = p._el.querySelector('.mm-proj__tag').getBoundingClientRect();
    var x = (p.side === 'right' ? tag.left : tag.right) - fr.left, y = tag.top - fr.top - 8;
    var w = this.card.offsetWidth || 180, h = this.card.offsetHeight || 70;
    x = p.side === 'right' ? x : x - w;
    this.card.style.translate = Math.round(clamp(x, 8, this.fw - w - 8)) + 'px ' + Math.round(Math.max(8, y - h)) + 'px';
  };
  P.hideCard = function () { this.cardFor = null; G.to(this.card, { autoAlpha: 0, duration: 0.2, overwrite: true }); };

  /* ---------- hover: roads & bridges ---------- */
  P.hoverRoad = function (id, on) {
    if (on && (this.active !== 'master3d' || this.busy)) return;
    var self = this, r = this.roads && this.roads[id];
    if (!r) return;
    if (on && this.rdHover && this.rdHover !== id) this.hoverRoad(this.rdHover, false);
    if (!on && this.rdHover !== id) return;
    this.rdHover = on ? id : null;
    Object.keys(this.roads).forEach(function (k) {
      G.to(self.roads[k].comet.g, { opacity: on && k !== id ? 0.15 : 1, duration: 0.4, overwrite: 'auto' });
    });
    r.g.classList.toggle('is-hover', on);
    G.to(this.rdDim, { opacity: on ? 1 : 0, duration: 0.5, ease: 'power2.out', overwrite: true });
    if (on) r.hl.show(1.1);
    else { r.hl.hide(0.4); this.hideRoadTag('master3d'); }
    D.roads.forEach(function (rd) { if (rd.path === id && rd._el) rd._el.classList.toggle('is-hover', on); });
  };
  P.pulseBridge = function (n) {
    var dot = n.querySelector('.mm-road__dot');
    if (dot) G.fromTo(dot, { scale: 0.6, opacity: 1 }, { scale: 3.2, opacity: 0, duration: 0.9, ease: 'power2.out' });
  };

  /* ---------- chrome ---------- */
  P.updateChrome = function () {
    var v = this.view, inOverview = v === 'overview' || v === 'tod';
    if (this.modeEl) {
      var mv = inOverview ? 'overview' : 'urban';
      this.modeEl.setAttribute('data-active', mv);
      this.modeEl.querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-go') === mv; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
    }
    if (this.tabsEl) {
      var bs = this.tabsEl.querySelectorAll('button');
      /* Figma: on the TOD plan the in-map tab bar shows with "Khu đô thị" highlighted */
      var tv = v === 'amenity' ? 'amenity' : 'urban';
      bs.forEach(function (b) { var on = b.getAttribute('data-go') === tv; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
      var ind = this.tabsEl.querySelector('.mm-tabs__indicator'), w = bs[0].offsetWidth || 160;
      ind.style.width = w + 'px';
      ind.style.transform = 'translateX(' + (v === 'amenity' ? w : 0) + 'px)';
      var show = v !== 'overview' && !this._hideTabs;
      G.to(this.tabsEl, { autoAlpha: show ? 1 : 0, y: show ? 0 : 14, duration: 0.45, overwrite: true });
    }
    if (this.ptabs) {
      var cur = null;
      var pv = v === 'tod' ? 'overview' : v;
      this.ptabs.querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-go') === pv; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); if (on) cur = b; });
      var pi = this.ptabs.querySelector('.mm-ptabs__indicator');
      if (cur) { pi.style.width = cur.offsetWidth + 'px'; pi.style.transform = 'translateX(' + (cur.offsetLeft - 4) + 'px)'; }
    }
    G.to(this.legend, { autoAlpha: this.active === 'overview' ? 1 : 0, duration: 0.4, overwrite: true });
    this.updateEdges();
    var rl = this.controls.querySelector('[data-ctrl="reload"]');
    rl.classList.toggle('is-hidden', this.mode === 'section' && !!this.selection && !this.panelIsOverlay());
  };

  P.setTitle = function (view, instant) {
    if (!this.titleEl) return;
    var t = D.titles[view === 'overview' ? 'overview' : 'urban'], node = this.titleEl;  /* TOD plan uses the second title, as in Figma */
    var html = '<span class="ln">' + esc(t[0]) + '</span><span class="ln accent">' + esc(t[1]) + '</span>';
    var dsc = D.descriptions[view === 'overview' ? 'overview' : 'urban'], de = this.descEl;
    if (instant) { node.innerHTML = html; if (de) de.textContent = dsc; return; }
    if (de && de.textContent !== dsc) G.timeline()
      .to(de, { autoAlpha: 0, y: -6, duration: 0.3, ease: 'power2.in' })
      .add(function () { de.textContent = dsc; })
      .to(de, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    if (node.innerHTML === html) return;
    G.timeline()
      .to(node.querySelectorAll('.ln'), { yPercent: -40, autoAlpha: 0, duration: 0.35, stagger: 0.06, ease: 'power2.in' })
      .add(function () { node.innerHTML = html; })
      .fromTo(function () { return node.querySelectorAll('.ln'); }, { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
  };

  /* ---------- reveals ---------- */
  P.reveal = function (map, delay) {
    var d = delay || 0, L = this.layers[map].markersEl, self = this;
    /* while the clouds still cover the frame, wait: the reveal plays as soon as the clearing opens (cloudsOut),
       so nothing animates unseen and then pops in */
    if (this.frame.classList.contains('is-clouded')) {
      if (map === 'master3d') this.flagsHidden();
      this._revealWait = map; return;
    }
    if (map === 'master3d') {
      /* flags: each pole rises from its building, then the name unfurls from the pole like a flag;
         they ripple out from the centre of the view, one after another */
      var cam = this.layers.master3d.cam, cx = (this.fw - (this.padRight || 0)) / 2, cy = this.fh / 2;
      var items = D.projects.filter(function (p) { return p._el; }).map(function (p) {
        var dx = p.x * cam.s + cam.tx - cx, dy = p.y * cam.s + cam.ty - cy;
        return { el: p._el, k: dx * dx + dy * dy };
      }).sort(function (a, b) { return a.k - b.k; });
      this.flagsHidden();
      var tl = G.timeline({ delay: d });
      items.forEach(function (it, i) {
        var line = it.el.querySelector('.mm-proj__line'), tag = it.el.querySelector('.mm-proj__tag'), t = i * 0.09;
        tl.to(line, { scaleY: 1, duration: 0.55, ease: 'power2.out', clearProps: 'transform' }, t)
          .to(tag, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power3.out', clearProps: 'clipPath' }, t + 0.38)
          .fromTo(tag, { color: 'rgba(255,254,242,0)' }, { color: 'rgba(255,254,242,1)', duration: 0.4, ease: 'none', clearProps: 'color' }, t + 0.55);
      });
      G.fromTo(L.querySelectorAll('.mm-road'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.04, delay: d + 0.4 });
      /* no road sweep on arrival: roads only light up when someone interacts with them */
    } else if (map === 'amenity') {
      G.fromTo(L.querySelectorAll('.mm-pin'), { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: { each: 0.03, from: 'center' }, ease: 'back.out(2.2)', delay: d, clearProps: 'transform' });
    } else if (map === 'overview') {
      var zp = this.salaZone.querySelectorAll('path');
      G.fromTo(this.salaPin, { y: -60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'bounce.out', delay: d + 0.2 });
      G.fromTo(zp, { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.1, delay: d });
      var ovr = this.ovRoads || {};
      Object.keys(ovr).forEach(function (k, i) {
        var r = ovr[k];
        r.hl.show(1.6, d + 0.3 + i * 0.18);
        r.hl.hide(0.9, d + 2.0 + i * 0.18);
      });
    }
  };

  /* flags folded away (pole down, name rolled into the pole) — the starting state of the reveal */
  P.flagsHidden = function () {
    D.projects.forEach(function (p) {
      if (!p._el) return;
      var right = p._el.classList.contains('mm-proj--right');
      G.set(p._el.querySelector('.mm-proj__line'), { scaleY: 0, transformOrigin: '50% 100%' });
      G.set(p._el.querySelector('.mm-proj__tag'), { clipPath: right ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)' });
    });
  };

  /* first load: only the clouds and the spinning Sala logo until the map image is ready, then the clouds part.
     No controls, tabs, legend, labels or nodes show while the clouds cover the frame (.mm-frame.is-clouded). */
  P.intro = function (want) {
    var self = this, u = this.cloud.u, map = want ? CONFIG.mapOf[want] : 'overview';
    this.busy = true;
    this.frame.classList.add('is-clouded');
    G.set(u, { density: 1, edge: 0, alpha: 1, scale: 2.2, hole: 0 });
    G.set(this.veil, { autoAlpha: this.cloud.ok ? 0.9 : 1 });   /* white cloud bed under the logo */
    G.fromTo(this.loader, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', delay: 0.1, overwrite: 'auto' });
    if (want) {
      this.view = want; this.setTitle(want);
      this.setCam(map, this.zoomedFrom(map, this.defaultCam(map), 1.3), true);
      this.showLayer(map); this.updateChrome();
    }
    this.loadMap(map, true);
    var img = this.layers[map].canvas.querySelector('img');
    var ready = img && !img.complete ? new Promise(function (r) { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }) : Promise.resolve();
    return Promise.all([ready, new Promise(function (r) { setTimeout(r, 1300); })]).then(function () {
      var tl = G.timeline();
      setTimeout(function () { self.loadRest(); }, 600);
      self.cloudsOut(tl, 0, map);
      tl.add(function () { self.animateCam(map, self.defaultCam(map), 1.9, 'power3.out'); self.reveal(map, 0.5); }, 0);
      return done(tl);
    }).then(function () { G.set(self.loader, { autoAlpha: 0, scale: 0.6, overwrite: true }); self.busy = false; self.updateChrome(); if (self.showRotateHint) self.showRotateHint(); });
  };

  /* TOD plan layers come in one after another: routes wipe out from the centre, then icons, then arrows */
  P.revealPlan = function (d) {
    var L = this.planLayers; if (!L) return;
    var routes = L[2], icons = L[1], arrows = L[0], st = { r: 0 };
    G.set([icons, arrows], { autoAlpha: 0 });
    G.fromTo(st, { r: 0 }, { r: 140, duration: 2.0, ease: 'power2.inOut', delay: d,
      onUpdate: function () { var m = 'radial-gradient(circle at 52% 45%, #000 ' + (st.r - 12) + '%, transparent ' + st.r + '%)'; routes.style.webkitMaskImage = m; routes.style.maskImage = m; },
      onComplete: function () { routes.style.webkitMaskImage = routes.style.maskImage = 'none'; } });
    G.fromTo(icons, { autoAlpha: 0, scale: 1.015 }, { autoAlpha: 1, scale: 1, duration: 0.8, delay: d + 1.0, ease: 'power2.out' });
    G.fromTo(arrows, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: d + 1.5, ease: 'power1.out' });
  };

  /* ---------- clouds timeline pieces ---------- */
  /* close in: density rises while the features grow (we fly into the bank) */
  P.cloudsIn = function (tl, at) {
    var u = this.cloud.u, self = this;
    tl.to(u, { edge: 0, alpha: 1, duration: 0.9, ease: 'sine.inOut' }, at)
      .to(u, { density: 1, duration: 1.15, ease: 'power2.inOut' }, at)
      .to(u, { scale: 2.2, duration: 1.25, ease: 'power1.in' }, at)
      .set(u, { hole: 0 }, at)
      .to(this.veil, { autoAlpha: 0.55, duration: 0.5, ease: 'sine.inOut' }, at + 0.55)   /* light white bed: a quick pass, no loading screen */
      .add(function () { self.frame.classList.add('is-clouded'); }, at);           /* UI and nodes fade out with the clouds */
    /* the spinning logo + full white bed belong to the first page load (intro); during map changes they appear
       only if the new map really has to wait for its image (holdUntilLoaded) */
    if (!this.cloud.ok) tl.to(this.veil, { autoAlpha: 1, duration: 0.6 }, at + 0.4);
    return tl;
  };
  /* part: a clearing opens from the centre and the clouds sweep past the camera,
     then settle back into the ambient edge mist of the new map */
  P.cloudsOut = function (tl, at, map) {
    var u = this.cloud.u, amb = AMBIENT[map || this.active] || AMBIENT.master3d, self = this;
    tl.to(this.loader, { autoAlpha: 0, scale: 0.7, duration: 0.35, ease: 'power2.in', overwrite: 'auto' }, at)
      .add(function () {   /* UI comes back once the clearing is open; a waiting reveal plays now */
        self.frame.classList.remove('is-clouded'); self.frame.classList.remove('is-swapping');
        var w = self._revealWait; self._revealWait = null;
        if (w) self.reveal(w, 0.1);
      }, at + 1.0)
      .to(this.veil, { autoAlpha: 0, duration: 0.7, ease: 'sine.out' }, at)
      .to(u, { hole: 2.4, duration: 2.0, ease: 'power2.inOut' }, at)
      .to(u, { scale: 4.2, duration: 2.0, ease: 'power2.out' }, at)
      .to(u, { density: 0, duration: 1.3, ease: 'power1.in' }, at + 0.4)
      .add(function () {
        /* settle into the ambient mist without holding up the interaction */
        G.set(u, { hole: 0, scale: 1, edge: amb.edge, alpha: 0 });
        G.to(u, { density: amb.density, alpha: amb.alpha, duration: 1.6, ease: 'sine.inOut' });
      }, at + 2.02);   /* after the hole/scale tweens (2.0 s) end — earlier, they overwrote the reset and the edge mist never came back */
    return tl;
  };
  P.ambient = function (map, dur) {
    var amb = AMBIENT[map];
    G.to(this.cloud.u, { density: amb.density, alpha: amb.alpha, edge: amb.edge, scale: 1, hole: 0, duration: dur == null ? 1.2 : dur, ease: 'sine.inOut', overwrite: 'auto' });
  };

  P.showLayer = function (map, fade) {
    var self = this;
    Object.keys(this.layers).forEach(function (k) {
      var L = self.layers[k].el, on = k === map;
      L.classList.toggle('is-active', on);
      if (fade) G.to(L, { autoAlpha: on ? 1 : 0, duration: fade, ease: 'power1.inOut', overwrite: true });
      else G.set(L, { autoAlpha: on ? 1 : 0 });
    });
    this.active = map;
  };

  /* ---------- navigation ---------- */
  /* clouds only on the very first load (intro); switching maps afterwards is a quick, simple crossfade (feedback 02/11).
     dive / toOverview / switchTab (cloud transitions) are kept below but no longer used. */
  P.go = function (target) {
    if (target === 'tod') target = 'urban';                         /* the 2D TOD plan is no longer shown */
    if (this.busy || target === this.view) return;
    return this.quickSwitch(target);
  };

  P.quickSwitch = async function (target) {
    this.loadMap(CONFIG.mapOf[target] || target, true);   /* start fetching right away if it is still waiting */
    if (this.ovHover) this.hoverOvRoad(this.ovHover, false);
    if (this.rdHover) this.hoverRoad(this.rdHover, false);
    if (this.alHover) this.hoverALine(this.alHover, false);
    this.busy = true;
    this.deselect(true);
    var self = this, map = CONFIG.mapOf[target], prev = this.active;
    this.view = target;
    this.setTitle(target);
    this.updateChrome();
    var def = this.defaultCam(map);
    this.setCam(map, this.zoomedFrom(map, def, 1.3), true);
    if (map === 'master3d') this.flagsHidden();
    if (prev !== map) this.animateCam(prev, this.zoomedFrom(prev, this.layers[prev].cam, 1.2), 0.8, 'power2.in');
    var u = this.cloud.u, pan = this.cloudPan(map, def), amb = AMBIENT[map] || AMBIENT.master3d, tl = G.timeline();
    G.killTweensOf(u); G.killTweensOf(this.veil);
    {
      /* one transition everywhere (feedback 02/11), the first-load look: white clouds close in, the maps swap
         underneath, then the clouds burst open from the centre. The spinning logo only shows if the new map's
         image still has to load (holdUntilLoaded waits behind the clouds). */
      G.to(u, { panX: pan[0], panY: pan[1], duration: 1.6, ease: 'sine.inOut' });
      tl.add(function () { self.frame.classList.add('is-swapping'); }, 0)
        .set(u, { hole: 0, sweep: 0, drift: 0 }, 0)
        .to(u, { density: 1, edge: 0, alpha: 1, duration: 0.55, ease: 'sine.inOut' }, 0)
        .to(u, { scale: 2.2, duration: 0.6, ease: 'sine.in' }, 0)
        .to(this.veil, { autoAlpha: 0.9, duration: 0.45, ease: 'sine.inOut' }, 0.1)
        .add(function () { self.showLayer(map); self._revealWait = map; if (map === 'master3d') self.flagsHidden(); }, 0.58)
        .add(function () { self.animateCam(map, def, 1.9, 'power3.out'); }, 0.6);
      this.holdUntilLoaded(tl, 0.58, map);
      this.cloudsOut(tl, 0.6, map);
      await new Promise(function (r) { tl.add(r, 1.75); });
    }
    if (prev !== map) { this.layers[prev].cam = this.defaultCam(prev); this.apply(prev); }
    this.updateChrome();
    this.busy = false;
  };

  P.dive = async function (target) {
    var self = this, from = this.active;
    if (this.ovHover) this.hoverOvRoad(this.ovHover, false);
    if (this.rdHover) this.hoverRoad(this.rdHover, false);
    if (this.alHover) this.hoverALine(this.alHover, false);
    this.busy = true;
    this.deselect(true);
    this.view = target;
    this._hideTabs = true;
    this.updateChrome();
    var first = CONFIG.mapOf[target], def = this.defaultCam(first), pin = D.overview.pin;
    var tl = G.timeline();
    if (from === 'overview') {
      tl.add(this.animateCam('overview', this.camAround('overview', pin.x, pin.y - 60, this.layers.overview.cam.s * 2.4), 1.4, 'power2.in'), 0)
        .to(this.salaPin, { autoAlpha: 0, duration: 0.4 }, 0.6);
    } else {
      tl.add(this.animateCam(from, this.zoomedFrom(from, this.layers[from].cam, 1.35), 1.4, 'power2.in'), 0);
    }
    this.cloudsIn(tl, 0.15);
    tl.add(function () {
      self.setTitle(target);
      self.setCam(first, self.zoomedFrom(first, def, 1.4), true);
      self.showLayer(first);
    }, 1.3);
    this.holdUntilLoaded(tl, 1.3, first);
    this.cloudsOut(tl, 1.35, first);
    tl.add(function () {
      self.animateCam(first, def, 1.9, 'power3.out');
      self._hideTabs = false; self.updateChrome();
      if (first === 'plan2d') self.revealPlan(0.6); else self.reveal(first, 0.5);
    }, 1.35);
    if (this.mapLoaded(first)) tl.timeScale(2.1);   /* image already there: a quick cloud pass (~1.6 s) */
    await done(tl);
    G.set(this.salaPin, { autoAlpha: 1 });
    if (from !== first) { this.layers[from].cam = this.defaultCam(from); this.apply(from); }
    this.updateChrome();
    this.busy = false;
  };

  P.toOverview = async function () {
    var self = this;
    if (this.rdHover) this.hoverRoad(this.rdHover, false);
    if (this.alHover) this.hoverALine(this.alHover, false);
    this.busy = true;
    this.deselect(true);
    this.view = 'overview';
    this.updateChrome();
    var cur = this.active, def = this.defaultCam('overview'), pin = D.overview.pin;
    var tl = G.timeline();
    tl.add(this.animateCam(cur, this.zoomedFrom(cur, this.layers[cur].cam, 1.3), 1.25, 'power2.in'), 0);
    this.cloudsIn(tl, 0);
    tl.add(function () {
      self.setTitle('overview');
      self.setCam('overview', self.camAround('overview', pin.x, pin.y - 60, def.s * 2.1), true);
      self.showLayer('overview');
      self.updateChrome();
    }, 1.15);
    this.holdUntilLoaded(tl, 1.15, 'overview');
    this.cloudsOut(tl, 1.2, 'overview');
    tl.add(function () { self.animateCam('overview', def, 2.0, 'power3.out'); self.reveal('overview', 0.6); }, 1.2);
    if (this.mapLoaded('overview')) tl.timeScale(2.1);
    await done(tl);
    this.layers[cur].cam = this.defaultCam(cur); this.apply(cur);
    this.busy = false;
  };

  /* Khu đô thị ⇄ Tiện ích: also through the clouds (feedback 02/11) — quick when the map is already loaded,
     held behind the clouds (with the spinning logo) until its image arrives when it isn't */
  P.switchTab = async function (target) {
    if (this.rdHover) this.hoverRoad(this.rdHover, false);
    if (this.alHover) this.hoverALine(this.alHover, false);
    this.busy = true;
    this.deselect(true);
    var self = this, map = target === 'amenity' ? 'amenity' : 'master3d', prev = this.active;
    this.view = target;
    this.updateChrome();
    var def = this.defaultCam(map), quick = this.mapLoaded(map), tl = G.timeline();
    tl.add(this.animateCam(prev, this.zoomedFrom(prev, this.layers[prev].cam, 1.3), 1.25, 'power2.in'), 0);
    this.cloudsIn(tl, 0);
    tl.add(function () { self.setCam(map, self.zoomedFrom(map, def, 1.3), true); self.showLayer(map); }, 1.15);
    this.holdUntilLoaded(tl, 1.15, map);
    this.cloudsOut(tl, 1.2, map);
    tl.add(function () { self.animateCam(map, def, 1.9, 'power3.out'); self.reveal(map, 0.5); }, 1.2);
    if (quick) tl.timeScale(2.1);
    await done(tl);
    this.layers[prev].cam = this.defaultCam(prev); this.apply(prev);
    this.updateChrome();
    this.busy = false;
  };

  /* map images ready? (all <img> of the map's canvas decoded) */
  /* page speed (02/11): map images are only requested when needed. The map that opens first is fetched at high
     priority on its own; the other maps follow one after another in the background once it is on screen, so on a
     slow connection the first map no longer shares the bandwidth with ~2 MB of maps nobody is looking at yet. */
  P.lazy = function (node, map, url) {
    (this.pending[map] = this.pending[map] || []).push({ el: node, url: url });
  };
  P.loadMap = function (map, high) {
    var list = this.pending[map];
    if (!list) return;
    delete this.pending[map];
    list.forEach(function (it) {
      if (it.el.tagName.toLowerCase() === 'img') {
        if (high) it.el.setAttribute('fetchpriority', 'high');
        it.el.src = it.url;
      } else {
        it.el.setAttribute('href', it.url);
        it.el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', it.url);
      }
    });
  };
  P.loadRest = function () {   /* the remaining maps, one at a time, after the first one is up */
    var self = this, order = ['master3d', 'amenity', 'overview'].filter(function (k) { return self.pending[k]; });
    (function next() {
      var k = order.shift(); if (!k) return;
      if (!self.pending[k]) return next();
      self.loadMap(k);
      self.mapReady(k).then(function () { setTimeout(next, 150); });
    })();
  };
  P.mapLoaded = function (map) {
    if (this.pending[map]) return false;
    return [].every.call(this.layers[map].canvas.querySelectorAll('img'), function (im) { return im.complete && im.naturalWidth > 0; });
  };
  P.mapReady = function (map) {
    this.loadMap(map, true);
    return Promise.all([].map.call(this.layers[map].canvas.querySelectorAll('img'), function (im) {
      if (im.complete) return null;
      return new Promise(function (r) { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); });
    }));
  };
  /* pause a cloud timeline at the swap point until the new map's image has loaded */
  P.holdUntilLoaded = function (tl, at, map) {
    /* feedback 02/11: the spinning logo only when the wait is long. The check runs when the clouds are closed
       (not when the click happens), so an image that arrived meanwhile never pauses anything; a short wait
       (< LOGO_DELAY) holds the clouds quietly, without the logo. */
    var self = this, LOGO_DELAY = 600;
    tl.add(function () {
      if (self.mapLoaded(map)) return;
      tl.pause(at + 0.01);   /* snap back exactly to the hold point */
      var shown = false;
      var timer = setTimeout(function () {
        shown = true;
        G.to(self.veil, { autoAlpha: 0.9, duration: 0.3 });
        G.fromTo(self.loader, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', overwrite: 'auto' });
      }, LOGO_DELAY);
      Promise.race([self.mapReady(map), new Promise(function (r) { setTimeout(r, 10000); })]).then(function () {   /* never stuck */
        clearTimeout(timer);
        tl.resume();
      });
    }, at + 0.01);
  };

  /* "Về góc nhìn ban đầu": glide back to the opening view (no clouds) */
  P.reload = async function () {
    if (this.busy) return;
    var map = this.active;
    this.busy = true;
    this.deselect(true);
    await done(this.animateCam(map, this.defaultCam(map), 0.9, 'power3.inOut'));
    this.busy = false;
  };

  /* ---------- selection & panel ---------- */
  P.select = function (kind, item) {
    if (this.busy) return;
    if (!item.data && !(kind === 'project' && item.thumb)) return;   /* v9.9: a project without content opens a short panel */
    if (this.selection && this.selection.item === item) return;
    this.clearSelectionMarks();
    this.selection = { kind: kind, item: item };
    if (kind === 'project') {
      D.projects.forEach(function (p) { p._el.classList.toggle('is-selected', p === item); p._el.classList.toggle('is-dim', p !== item); });
      var z = item._zone;
      if (z) {
        this.spotHole.setAttribute('d', z.d); this.spotHole.setAttribute('transform', z.tr);
        G.to(this.spot, { opacity: 0.38, duration: 0.45, overwrite: true });
        G.to(z.fx, { opacity: 1, duration: 0.35, overwrite: true });
      }
      this.hideCard();
    } else {
      item._el.classList.add('is-active');
    }
    this.renderPanel(kind, item);
    this.openPanel();
    this.focusSelection(true);
    this.updateChrome();
  };

  P.clearSelectionMarks = function () {
    D.projects.forEach(function (p) {
      if (p._el) p._el.classList.remove('is-selected', 'is-dim');
      if (p._zone) { G.to(p._zone.fx, { opacity: 0, duration: 0.3, overwrite: true }); p._zone.trace.hide(0.3); }
    });
    if (this.spot && !this.hovered) G.to(this.spot, { opacity: 0, duration: 0.35, overwrite: true });
    D.amenities.forEach(function (a) { if (a._el) a._el.classList.remove('is-active'); });
  };

  P.focusSelection = function (animate) {
    var it = this.selection.item, map = this.active;
    this.padRight = this.panelIsOverlay() ? 0 : this.panel.offsetWidth;
    var s = this.layers[map].cam.s;
    var cam = this.clampCam(map, { s: s, tx: (this.fw - this.padRight) / 2 - it.x * s, ty: this.fh / 2 - it.y * s });
    if (animate) this.animateCam(map, cam, 0.9, 'power3.inOut'); else this.setCam(map, cam, true);
  };

  P.openPanel = function () {
    var p = this.panel;
    p.classList.add('is-open');
    p.setAttribute('aria-hidden', 'false');
    this.backdrop.classList.add('is-on');
    this.root.classList.add('panel-open');
    p.querySelector('.mm-panel__body').scrollTop = 0;
    G.fromTo(p.querySelectorAll('.mm-panel__title, .mm-col > *, .mm-panel__empty, .mm-panel__foot > *'),
      { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.045, ease: 'power3.out', delay: 0.15 });
    var media = p.querySelector('.mm-panel__media img');
    if (media) G.fromTo(media, { scale: 1.12 }, { scale: 1, duration: 1.4, ease: 'power2.out', delay: 0.1 });
  };

  P.deselect = function (silent) {
    if (!this.selection) return;
    this.selection = null;
    this.clearSelectionMarks();
    this.panel.classList.remove('is-open');
    this.panel.setAttribute('aria-hidden', 'true');
    this.backdrop.classList.remove('is-on');
    this.root.classList.remove('panel-open');
    this.padRight = 0;
    var map = this.active;
    if (!silent) this.animateCam(map, this.clampCam(map, this.layers[map].cam), 0.6, 'power2.out');
    else this.setCam(map, this.layers[map].cam);
    this.updateChrome();
  };

  P.renderPanel = function (kind, item) {
    var d = item.data, P2 = this.panel;
    P2.setAttribute('aria-label', d ? d.title : item.name);
    /* v9.8 (Figma 28422:16102 / 16114 / 16126): a project's panel header shows its sales status in the status colour */
    var kindEl = P2.querySelector('.mm-panel__kind'), st = kind === 'project' ? (SALE_STATUS[item.status] || SALE_STATUS.closed) : null;
    kindEl.textContent = st ? st.label : 'Tiện ích';
    kindEl.setAttribute('data-status', st ? (item.status || 'closed') : '');
    var body = P2.querySelector('.mm-panel__body'), foot = P2.querySelector('.mm-panel__foot');
    var title = d ? d.title : item.name;
    P2.classList.toggle('is-brief', !d);   /* v9.9: short panel (no content yet): the phone sheet hugs its content */
    var html = '<h3 class="mm-panel__title">' + esc(title) + '</h3>';
    if (d) {
      /* one rule for every popover (feedback 02/11): label on the left, value on the right; stats are [label, value] */
      var stats = d.stats.map(function (s) {
        return '<div class="mm-stat"><span class="k">' + esc(s[0]) + '</span><span class="v">' + esc(s[1]) + '</span></div>';
      }).join('');
      /* gallery items: a path, or { src, thumb } (small copy in the strip, full size in the viewer) */
      var thumbs = d.gallery.map(function (g, i) { var full = g.src || g, th = g.thumb || full;
        return '<button type="button" class="mm-skel" data-src="' + full + '" aria-label="Xem ảnh ' + (i + 1) + '"><img src="' + th + '" alt="" loading="lazy"></button>'; }).join('');
      /* v11.2: until the real pages exist, each CTA says where it will go */
      var ctaToast = kind === 'project' ? 'Điều hướng trang chi tiết dự án' : 'Điều hướng trang chi tiết tiện ích';
      var cta = '<a class="mm-cta" href="' + (d.href || '#') + '" data-toast="' + ctaToast + '">' + esc(d.cta) + icon(I.arrowRight) + '</a>';
      html = '<div class="mm-col mm-col--a">' + html +
        '<div class="mm-panel__media mm-skel"><img src="' + d.image + '" alt="' + esc(title) + '"></div>' +
        '<p class="mm-panel__desc">' + esc(d.desc) + '</p></div>' +
        '<div class="mm-col mm-col--b"><div class="mm-acc"><button type="button" class="mm-acc__head" aria-expanded="true">Thông tin chung' + icon(I.chevron) + '</button>' +
        '<div class="mm-acc__body"><div class="mm-acc__inner">' + stats + '</div></div></div>' +
        '<div class="mm-gal"><div class="mm-gal__head"><span class="mm-gal__count">Hình ảnh (' + d.gallery.length + ')</span>' +
        '<div class="mm-gal__nav"><button type="button" class="prev" aria-label="Ảnh trước">' + icon(I.chevron) + '</button>' +
        '<button type="button" class="next" aria-label="Ảnh sau">' + icon(I.chevron) + '</button></div></div>' +
        '<div class="mm-gal__track">' + thumbs + '</div></div>' +
        cta.replace('class="mm-cta"', 'class="mm-cta mm-cta-inline"') + '</div>';
      foot.innerHTML = cta; foot.style.display = '';
    } else if (kind === 'project' && item.thumb) {
      /* v9.9 (feedback 05/11): no content yet → status, name, thumbnail and "Đăng kí nhận thông tin" only */
      /* v11.2: Chưa mở bán → "Đăng kí nhận thông tin" (form page); Đang / Sắp mở bán → "Xem chi tiết dự án" (detail page) */
      var closed = (item.status || 'closed') === 'closed';
      var reg = closed
        ? '<a class="mm-cta" href="' + (item.registerHref || '#') + '" data-toast="Điều hướng trang form đăng kí">Đăng kí nhận thông tin' + icon(I.arrowRight) + '</a>'
        : '<a class="mm-cta" href="' + (item.href || '#') + '" data-toast="Điều hướng trang chi tiết dự án">Xem chi tiết dự án' + icon(I.arrowRight) + '</a>';
      html = '<div class="mm-col mm-col--a">' + html +
        '<div class="mm-panel__media mm-skel"><img src="' + item.thumb + '" alt="' + esc(title) + '"></div></div>' +
        '<div class="mm-col mm-col--b">' + reg.replace('class="mm-cta"', 'class="mm-cta mm-cta-inline"') + '</div>';
      foot.innerHTML = reg; foot.style.display = '';
    } else {
      html += '<p class="mm-panel__empty">Thông tin chi tiết về ' + esc(item.name) + ' đang được cập nhật.</p>';
      foot.innerHTML = ''; foot.style.display = 'none';
    }
    body.innerHTML = html;
    if (!d) {
      body.querySelectorAll('.mm-skel img').forEach(function (im) {
        var box = im.parentNode;
        function done() { box.classList.add('is-loaded'); }
        if (im.complete && im.naturalWidth) done();
        else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); }
      });
      return;
    }
    /* skeleton (feedback 02/11): a shimmering placeholder in the image frames until each picture has loaded,
       instead of an empty grey box; the picture then fades in */
    body.querySelectorAll('.mm-skel img').forEach(function (im) {
      var box = im.parentNode;
      function done() { box.classList.add('is-loaded'); }
      if (im.complete && im.naturalWidth) done();
      else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); }
    });
    var acc = body.querySelector('.mm-acc');
    acc.querySelector('.mm-acc__head').addEventListener('click', function () { var closed = acc.classList.toggle('is-closed'); this.setAttribute('aria-expanded', !closed); });
    /* gallery: thumbnails open a full-screen viewer (the panel image stays as it is); ‹ › scroll the strip */
    var track = body.querySelector('.mm-gal__track'), self = this;
    var btns = track.querySelectorAll('button'), srcs = [].map.call(btns, function (b) { return b.getAttribute('data-src'); });
    btns.forEach(function (b, i) { b.addEventListener('click', function () { self.openViewer(srcs, i, title); }); });
    function page(dir) { track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' }); }
    body.querySelector('.mm-gal__nav .prev').addEventListener('click', function () { page(-1); });
    body.querySelector('.mm-gal__nav .next').addEventListener('click', function () { page(1); });
  };

  /* ---------- toast: short notice at the top of the map ---------- */
  P.toast = function (msg) {
    var t = this.toastEl;
    if (!t) { t = this.toastEl = el('div', 'mm-toast'); t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); this.root.appendChild(t); }
    t.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7.5" stroke="currentColor" stroke-width="1.4"/><path d="M9 8v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="5.4" r=".9" fill="currentColor"/></svg>' +
      '<span>' + esc(msg) + '</span>';
    clearTimeout(this.toastT);
    G.fromTo(t, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out', overwrite: true });
    this.toastT = setTimeout(function () { G.to(t, { autoAlpha: 0, y: -8, duration: 0.3, ease: 'power1.in', overwrite: true }); }, 2600);
  };

  /* ---------- image viewer (lightbox) ---------- */
  P.openViewer = function (srcs, i, title) {
    var self = this, v = this.viewer;
    if (!v) {
      v = this.viewer = el('div', 'mm-viewer');
      v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-hidden', 'true');
      v.innerHTML = '<div class="mm-viewer__top"><span class="mm-viewer__title"></span><span class="mm-viewer__count"></span>' +
        '<button type="button" class="mm-viewer__close" aria-label="Đóng">' + icon(I.close) + '</button></div>' +
        '<div class="mm-viewer__stage"><img alt=""></div>' +
        '<button type="button" class="mm-viewer__nav prev" aria-label="Ảnh trước">' + icon(I.chevron) + '</button>' +
        '<button type="button" class="mm-viewer__nav next" aria-label="Ảnh sau">' + icon(I.chevron) + '</button>' +
        '<div class="mm-viewer__strip"></div>';
      this.root.appendChild(v);
      G.set(v, { autoAlpha: 0 });
      v.querySelector('.mm-viewer__close').addEventListener('click', function () { self.closeViewer(); });
      v.querySelector('.prev').addEventListener('click', function () { self.viewerGo(-1); });
      v.querySelector('.next').addEventListener('click', function () { self.viewerGo(1); });
      v.addEventListener('click', function (e) { if (e.target === v || e.target.classList.contains('mm-viewer__stage')) self.closeViewer(); });
      document.addEventListener('keydown', function (e) {
        if (!self.viewerOn) return;
        if (e.key === 'Escape') { e.stopPropagation(); self.closeViewer(); }
        if (e.key === 'ArrowLeft') self.viewerGo(-1);
        if (e.key === 'ArrowRight') self.viewerGo(1);
      }, true);
      var x0 = null;   /* swipe on touch */
      v.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      v.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) self.viewerGo(dx < 0 ? 1 : -1); x0 = null; });
    }
    this.viewerSrcs = srcs;
    v.querySelector('.mm-viewer__title').textContent = title || '';
    var ths = this.viewerThumbs = [].map.call(this.panel.querySelectorAll('.mm-gal__track img'), function (im) { return im.getAttribute('src'); });
    v.querySelector('.mm-viewer__strip').innerHTML = srcs.map(function (s, k) { return '<button type="button" aria-label="Ảnh ' + (k + 1) + '"><img src="' + (ths[k] || s) + '" alt=""></button>'; }).join('');
    v.querySelectorAll('.mm-viewer__strip button').forEach(function (b, k) { b.addEventListener('click', function () { self.viewerShow(k); }); });
    v.classList.toggle('is-single', srcs.length < 2);
    this.viewerShow(i, true);
    this.viewerOn = true; this.viewerFocus = document.activeElement;
    v.setAttribute('aria-hidden', 'false');
    G.to(v, { autoAlpha: 1, duration: 0.3, ease: 'power1.out', overwrite: true });
    G.fromTo(v.querySelector('.mm-viewer__stage img'), { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'power3.out' });
    v.querySelector('.mm-viewer__close').focus({ preventScroll: true });
  };
  P.viewerShow = function (i, instant) {
    /* feedback 02/11 "bấm đổi ảnh nhưng ảnh không đổi": on a slow connection the browser kept the old picture on
       screen until the new full-size file arrived. Now a click changes the picture at once: the (already loaded)
       thumbnail is shown softly blurred in the same fixed 16:9 frame, then the full image replaces it as soon
       as it is decoded. The pictures next to it are preloaded. */
    var self = this, v = this.viewer, n = this.viewerSrcs.length, img = v.querySelector('.mm-viewer__stage img');
    this.viewerIdx = (i + n) % n;
    var idx = this.viewerIdx, src = this.viewerSrcs[idx], th = (this.viewerThumbs || [])[idx];
    var tok = this.viewerTok = (this.viewerTok || 0) + 1;
    var cache = this.viewerCache || (this.viewerCache = {});
    v.querySelector('.mm-viewer__count').textContent = (idx + 1) + ' / ' + n;
    var cur = null;
    v.querySelectorAll('.mm-viewer__strip button').forEach(function (b, k) { var on = k === idx; b.classList.toggle('is-current', on); if (on) cur = b; });
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: instant ? 'auto' : 'smooth' });

    function load(u) {
      if (!cache[u]) cache[u] = new Promise(function (r) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).catch(function () {}).then(function () { r(im); }); };
        im.onerror = function () { r(null); };
        im.src = u;
      });
      return cache[u];
    }
    function showFull(im) {
      if (tok !== self.viewerTok) return;
      img.src = src;
      img.classList.remove('is-lowres');
    }
    function show() {
      var ready = cache[src] && cache[src].done;
      if (ready) { showFull(ready); return; }
      if (th) {   /* instant placeholder: the thumbnail (the 16:9 frame keeps the size, see CSS) */
        img.src = th; img.classList.add('is-lowres');
      }
    }
    var p = load(src);
    p.then(function (im) { p.done = im || true; showFull(im); });
    /* preload the neighbours so the next click is instant */
    p.then(function () { [idx + 1, idx - 1].forEach(function (k) { var u = self.viewerSrcs[(k + n) % n]; load(u).then(function (im) { cache[u].done = im || true; }); }); });

    if (instant) { show(); return; }
    G.to(img, { autoAlpha: 0, duration: 0.12, overwrite: true, onComplete: function () {
      if (tok !== self.viewerTok) return;
      show(); G.fromTo(img, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
    } });
  };
  P.viewerGo = function (d) { if (this.viewerOn && this.viewerSrcs.length > 1) this.viewerShow(this.viewerIdx + d); };
  P.closeViewer = function () {
    if (!this.viewerOn) return;
    var v = this.viewer;
    this.viewerOn = false;
    v.setAttribute('aria-hidden', 'true');
    G.to(v, { autoAlpha: 0, duration: 0.25, ease: 'power1.in', overwrite: true });
    if (this.viewerFocus && this.viewerFocus.focus) this.viewerFocus.focus({ preventScroll: true });
  };

  /* ---------- boot ---------- */
  function boot() {
    if (!G) { console.error('GSAP is required'); return; }
    var all = [];
    document.querySelectorAll('[data-mm]').forEach(function (n) { n._mm = new MasterMap(n); all.push(n._mm); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
      all.forEach(function (m) { m.measure(); Object.keys(MAPS).forEach(function (k) { m.apply(k); }); m.updateChrome(); });
    });
  }
  window.SalaBoot = boot;
  if (!window.SALA_MANUAL_BOOT) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
  window.SalaMasterMap = MasterMap;
})();
