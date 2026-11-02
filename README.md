# SALA — Interactive Master Plan

Code from the Figma section "UI MASTER PLAN SECTION" (file Yf13AguwKZMteDUXNND9at, node 31:3900).
Plain HTML/CSS/JS. Nothing to build or install.

## Opening it
- `index.html`: the website section (Bản đồ tổng quan / Bản đồ khu đô thị)
- `masterplan.html`: the full-screen Masterplan page (3 tabs: Tổng quan / Khu đô thị / Tiện ích)

Double-click a file to open it in Chrome or Edge. It works offline from file://.
If you need a local server, run `npx serve .` or `python -m http.server` in this folder.

## v4.9
- Opening the urban 3D map no longer lights up every road. Only the subtle running comets show; a road lights up only on hover or tap.

## v4.8
- The hover road name is always the top label: above project tags and bridge badges. The bridge nodes now live in the marker layer.
- Shop House = the long strip (2407). Sarimi = 2405 + the buildings 2406.

## v4.2: mode button, bridge leaders, road names on hover
- **Section ⇄ Page** is one demo-only button in the left control column, in the same style as zoom and reload. It has a swap icon (⇄), and its tooltip reads "DEMO · Chuyển sang chế độ Page / Chuyển về chế độ Section". Remove it (`.mm-ctrl--mode` in `app.js`) when the pages go live behind the real menu hub. The current view carries over (`#view=urban|tod|amenity`). Hrefs come from `window.SALA_MODE_HREF` (default `index.html` / `masterplan.html`).
- **Bridges:** one node per bridge, a dot with its name badge right beside it and no leader line. When the bridge is outside the frame, the dot waits on the frame edge with the badge on the inner side. As the bridge comes into the frame, the same dot travels onto it and the badge stays next to it, on the designer's side (`dir`). The badge moves to another side if that spot is taken, gliding when it swaps sides. Clicking an off-screen badge glides the map to the bridge.
- **Road names on hover** (both maps): the gold Figma road label (brand #BC8E49, like the Nguyễn Cơ Thạch pill) (pill, leader and dot) pops up at the pointer's spot on the road and follows it along the road. It hangs below the road near the top of the frame. Streets have no permanent label on any map, including the 3D page: the name only appears while the road is hovered, as on the overview.

## v4.0: lit buildings, off-screen bridge nodes
- Hovering or selecting a project shows the building cut out from the dusk render (`assets/img/map-3d-dusk.jpg`, image `Group 2147223724` in Figma frame 57:7825) by its outline, so the building lights up. The gold Figma tint stays very light on top (16%), with the outline stroke and the comet running around it.
- Bridges outside the frame keep a node pinned to the frame edge, with an arrow pointing to the bridge and its name. The node keeps clear of the zoom controls and other nodes. Clicking it glides the map to the bridge. While a bridge is off-screen, its own label is hidden so it never shows twice.

## v3.9: bridge nodes on the real bridges, lighter idle roads
- The bridge anchors were read from `map-3d.jpg` and sit on the bridge decks. Thủ Thiêm 2 is the inverted-Y cable-stayed bridge, Thủ Thiêm 3 the single-pylon bridge (confirmed by Hyun), Thủ Thiêm 1 the long bridge on the right, and Thủ Thiêm 4 the arch bridge on the left. Cầu đi bộ (confirmed by Hyun) keeps the designer's Figma anchor, because its deck is not clearly visible in the render.
- Idle road lines on the 3D map are 0%: only the running comet shows. The bold gold Figma stroke only appears on hover.

## v3.8: one road logic on both maps
- Road lights on the urban 3D map use the same logic and look as the overview (`ROAD_FX` + `roadLights()` in `app.js`): the same gold comet with the same size and timing, and the same hover: the map dims, the road lights up tapered to 0% at both ends, and the other comets fade. On touch, tap a road to toggle. Sizes are scaled by 1.289 because the 3D roads are drawn at that scale.
- Where a building outline sits on top of a road (e.g. the Shop House strip on Nguyễn Cơ Thạch), the building gets the hover.

## v3.7: building outlines from Figma (frame "Map" 43:7639)
- The hover and selection zones for projects use the outlines Hyun drew in Figma (Vector 2392 and 2401–2408). They are converted to map space in `js/data.js` → `projectZones`. Each outline keeps its own fill and stroke gradient from Figma; Saritown has a multi-stop gradient.
- Mapping: 2392 Sarene residence, 2401 Sadora, 2408 Saroma Villa, 2404 Saritown, 2403 Savila, 2405 + 2406 Sarimi (the buildings), 2402 Sarina, 2407 Shop House (the long strip along Nguyễn Cơ Thạch). Sarene has no outline yet.
- Hover: the map dims, the building shows its Figma fill and stroke, and a soft comet runs once around the outline (0% at head and tail).

## v3.6: depth on the 3D master map (Figma Map 49:7667)
- Base image: exposure -0.12, saturation -0.44 and temperature +0.05 (as CSS `filter`), plus 20% black (`.mm-3d-dim`) and a progressive blur at the top (`.mm-dof`).
- The SALA core is shown on top in full colour and sharpness (`.mm-3d-focus`) through a soft mask. `assets/img/map-3d-focus.png` is Figma's Vector 2373 with its 85.6px layer blur, so camera pan and zoom stay smooth.
- The soft-light gradient sits on top, as in Figma.

## v3.2: brown road highlight on the overview map
- The 4 brown arterial roads on `map-tong.jpg` (Võ Văn Kiệt – Mai Chí Thọ, Nguyễn Hữu Cảnh, Cao tốc Long Thành – Dầu Giây, Đỗ Xuân Hợp) are traced from the image into SVG paths in `js/data.js` → `overviewRoads`. The Figma file has no separate vector for them.
- Idle: a soft gold light runs along each axis as a comet. It fades in at the head and out along the tail, with no hard dash ends. Every road light (comet, opening sweep, hover highlight and the static line on the 3D map) is drawn through a mask of soft dots along the path (`makeLight` in `app.js`). Brightness is shaped along the path and always tapers to 0% at both ends of the road. The 3D map's road lights use the same effect. When the map opens, the axes are drawn on one after another.
- Hover (tap on mobile): the map dims slightly, the road glows gold with a bright core drawn along it.

## v3: cloud layer and clean Figma images
- The maps use only the original image layers from Figma, with no baked-in clouds. Figma effects are rebuilt in CSS: progressive blur at the top of the 3D image (6.5px → 0 at 56%), the soft-light gradient, and the 30% shade on the top-view.
- The TOD 2D map has 4 separate Figma layers: base, direction arrows (5.4), transit icons (5.3) and dotted routes (5.2). After the clouds part, the routes spread out from the center, then the icons and arrows fade in.
- Clouds are a single WebGL shader layer on top of the map, like explore.ownprimland.com: two cloud layers (near and far), lit from the top left, drifting slowly. When idle, the clouds stay at the edges of the frame and follow the camera with parallax. On transition, the clouds thicken while flying into the bank, open a gap from the center, then sweep past the camera.

## v2 — GSAP
- Motion uses GSAP 3.14.2 (bundled in `js/vendor/gsap.min.js`, so it works offline). The approach follows the official greensock/gsap-skills: timelines, `autoAlpha`, transform aliases, `ticker`.
- Cloud transition: the 2 Figma cloud bands close in, with ~54 cloud puffs (cut from the Figma cloud texture) flying toward the camera on a canvas, Three.js "Clouds" demo style. Then they part and the map zooms back into place.
- Building hover: outline traced per building on the 3D image. The fill and stroke use the Figma material from Vector 2392 (gold gradient #BC8E49→#564121 @60%, stroke #E1CFA6). The rest of the map dims to spotlight the building and a light line runs around the outline. Sarene residence uses the exact Figma shape.
- Roads: hovering a road or its label (page) lights up a glowing run along it and dims the other roads.
- Drag has inertia (the map keeps gliding after you let go). Markers and pins appear in a stagger, and the panel content flows in.

## Interactions
- Pan by dragging. Zoom with the +/- buttons, by double-clicking, or with Ctrl/⌘ + scroll (in the section). On the full page, plain scroll zooms. On phones, use two fingers.
- "Bản đồ tổng quan" mode: the location map. Clicking the SALA pin flies through the clouds to the green TOD plan, still in "Bản đồ tổng quan" mode (title "Dòng chảy kết nối", with the in-map Khu đô thị / Tiện ích tab bar as in Figma). Clicking "Bản đồ tổng quan" again returns to the location map.
- "Bản đồ khu đô thị" mode: flies through the clouds straight to the 3D master map, where light runs along the roads. The Tiện ích tab crossfades to the top-view amenity map.
- Hovering a project label raises it (Sarene residence also highlights its zone). Clicking a label opens the "Dự án" panel and the other labels turn gray.
- The Tiện ích tab shows the top-view map with its pins. Clicking a pin enlarges it, turns it red and opens the "Tiện ích" panel.
- Reload: clouds cover the map, the SALA logo spins, and the view resets.
- Mobile: the panel becomes a bottom sheet. On the Masterplan page in portrait, a "Hãy xoay ngang điện thoại" prompt appears. Landscape uses the 932×430 layout.

## Text
- The UI only shows text that exists in Figma. There is no hover card, no amenity tooltip, no road names along the roads, no gesture hints and no "đang cập nhật" placeholder.

## Editing content
- `js/data.js` holds titles, project, road label and amenity coordinates, and panel content.
  Items with `data: null` have no content in the Figma file yet, so clicking them does not open the panel. Add `data` to enable it.
- `js/app.js` → `CONFIG.planBeforeMaster`: set it to `false` to go straight to the 3D map instead of showing the 2D plan first.
- Fonts: the design uses Cerigo Std VU / Optima VU. If they are installed on the machine they load automatically.
  Otherwise the page falls back to Alegreya / Alegreya Sans from Google Fonts.

## v5.0: vector overview map from OpenStreetMap
- The overview (location) map is now a vector SVG built from OpenStreetMap data, so it stays sharp at any zoom. It replaces `map-tong.jpg`, which is kept only as a fallback.
  - Data: OpenFreeMap vector tiles (© OpenStreetMap contributors, ODbL), saved in `tools/thu-thiem-osm.json`.
  - Builder: `python3 tools/build_overview_svg.py app` writes `assets/map/overview.svg` and `js/overview-svg.js` (inline, so labels use the page fonts). It also updates the 4 highlight paths, the SALA zone and the pin in `js/data.js`.
- **Content follows the old overview:**
  - Water, parks, the road network by class, the city-centre tint and the gold Thủ Thiêm centre.
  - Brown arterials: Võ Văn Kiệt – Mai Chí Thọ, Nguyễn Hữu Cảnh, Xa lộ Hà Nội, the Long Thành – Dầu Giây expressway and Đỗ Xuân Hợp.
  - Rail: Metro 1 (real alignment), Metro 2 and the North–South elevated rail (schematic).
  - Bridges and the tunnel on their real spans.
  - Landmarks at their true positions, drawn as gold vector icons.
  - The same ward and road labels as before.
- Labels and icons the designer placed schematically go through an affine fitted between the old raster and OSM. Edit their positions in `WARDS` / `ROADS` in the builder.
- v5.1 refinement:
  - Calmer cartography: dual carriageways welded into one ribbon, only two road classes, small ponds dropped, water and parks smoothed, and the gold centre redrawn as one clean block.
  - The gold landmark icons were redrawn as fine vectors in the designer's style (white window details), sized and nudged so they never overlap.
- The attribution "© OpenStreetMap contributors" sits bottom-left in the map, as the ODbL requires.

## v5.2: performance (no more lag)
- **Overview map:** the OpenStreetMap SVG and its sepia grade are baked into one 2x WebP (`assets/img/map-overview.webp`, 283KB) with `node tools/bake_overview.cjs`. Panning and zooming now move one image, so the browser no longer redraws thousands of vector paths every frame. The SVG stays the source in `assets/map/overview.svg`. After `python3 tools/build_overview_svg.py app`, run the bake again.
- **Road and outline lights:** these used to be per-light SVG masks with blur filters, re-rendered every frame. They are now drawn by one screen-space canvas per map (`lightEngine` / `makeLight` in `app.js`). The look is the same (soft glow, 0% head and tail), at a fraction of the cost.
- **Clouds:** the idle edge mist renders at a lower resolution and 30 fps. Transitions still run at full rate.
- Headless test while panning/zooming the overview: about 150 ms/frame before, about 33 ms after (software GPU; a real GPU is much faster).

## v5.3: smart labels on the overview map

The overview image (`assets/img/map-overview.webp`) no longer carries any text. Every name is placed live by `app.js`
(`ovlLayout` / `ovlFollow`) from `js/overview-labels.js`, which `tools/build_overview_svg.py app` generates from the OSM data.

- **Constant size:** labels stay the same size on screen at every zoom; more names appear as you zoom in.
  Each label has a zoom tier `z` (× the default zoom) and a priority `p`.
- **No overlaps:** labels are placed greedily by priority and never overlap each other. They also keep clear of
  icons, the Sala pin and zone outline, the brown arterials and the UI (controls, legend, tabs, logo).
- **Placement by kind:**
  - Icon captions try below, right, left and above the icon.
  - Bridges and junctions can also go diagonal.
  - Road names sit on the straightest visible stretch, kept upright; arterial names sit beside the brown line.
  - "Sông Sài Gòn" is set letter by letter along the river.
  - Area names ("Trung tâm hành chính", "Lâm viên sinh thái") show only when they fit inside their area.
- **Stability:** a shown label keeps its spot and gets a priority bonus, so nothing flickers while panning.
  Placement is re-solved at most every ~110 ms while moving, and once more when the camera settles.
- **Hover:** hovering a road dims the labels with the map.
- **Attribution:** "© OpenStreetMap contributors" sits at the bottom right of the overview map.

Where to tweak:
- Styles: `css/style.css` → `.mm-ovl--*` (ward, road, art, line, poi, bridge, area, water, hub, air, junc).
- Spacing and road straightness: `OVL` in `app.js`.
- Which names show, their priority and zoom tier: `label_specs()` in `tools/build_overview_svg.py`.
- `assets/map/overview-print.svg` is a static print version with the text burned in.

## v5.4: overview back on the designer's raster map

The overview uses the designer's map `assets/img/map-tong.jpg` again, with its own text, and the sepia grade from CSS.
The Sala zone, the pin and the 4 highlighted arterials use their traced positions on that image again.

The OSM vector map and the live labels are kept in the repo. To switch back:
1. Set `OV_VECTOR = true` in `app.js`.
2. Add `<script src="js/overview-labels.js"></script>` after `data.js` in both HTML pages.
3. Restore the OSM zone, pin and road paths in `data.js` by running `python3 tools/build_overview_svg.py app`.

## v5.5: SALA pin goes straight to the 3D urban map; legend 1.5×

Clicking the SALA pin on the overview now dives straight into "Khu đô thị" (3D); the green 2D TOD plan step is dropped,
so the tabs always match the map on screen. `buildPlan()` is kept in `app.js` but no longer called; old `#view=tod` links open the urban map.
The legend image is 1.5× bigger: 278×404 px on desktop and 180 px wide on phones (`.mm-legend img` in `style.css`).

Hover and select on the 3D map: the whole building is covered by its Figma gold gradient at 60% (Figma 43:7639), with the dusk render under it (`.mm-zone-fill` in `style.css`).

## v5.7: loading shows only clouds and the spinning logo

- **First load:** the frame opens fully clouded with the spinning Sala logo. Once the map image is loaded (and at least
  1.3 s has passed), the clouds part and the controls, tabs, legend, labels and nodes fade in. This is `intro()` in `app.js`.
- **Map changes:** while the clouds cover the frame, the frame has the class `.mm-frame.is-clouded`. That class hides the
  controls, tabs, legend, project labels, road tags and bridge nodes, and blocks clicks on them. The spinning logo shows
  in the middle. The class is added in `cloudsIn` and removed about 1 s into `cloudsOut`.
- A `#view=urban` or `#view=amenity` link opens straight on that map under the same intro, with no extra cloud pass.

## v5.8: one 3-tab bar in the embed; Khu đô thị opens zoomed out

- **Section (embed):** the outer "Bản đồ tổng quan / Bản đồ khu đô thị" switch and the in-map 2-tab bar are gone.
  The embed now uses the same single bar as the full page: "Tổng quan / Khu đô thị / Tiện ích".
  - It sits at the bottom centre of the map and always highlights the map on screen.
  - It slides left to stay centred when the panel opens on desktop.
  - On phones it shows icon plus text at 14 px.
  - Code: `.mm-ptabs--embed` in `style.css`; the bar is built in `buildChrome`.
- **3D Khu đô thị:** the default camera is now fully zoomed out, so the whole render fills the frame. Visitors zoom in themselves.
  The zoom-in limit stays where it was (3.5× the old designed view). Code: `defaultCam('master3d')`.
- Section (embed) legend: a little smaller than the full page, 232×337 px (150 px wide on phones).
- While a popover is open (`.panel-open`), the bridge nodes fade out; they come back when it closes.
- Sarene: total apartments 441 (was 480), per the client.
- Legend: top-right corner with the same 20 px margin as the controls column (section and page; 8 px on small landscape pages, same as the controls).
- Project label "Sarene residence" renamed to "Sarene" (client). The second "Sarene" label (id `sarene`, near the lake, no data) is removed.
- Fix: the spinning logo could stay on screen after the first load when the map image loaded fast. The logo tweens now override each other, and the logo is force-hidden when the intro ends.

## v5.9: image viewer, Sarene renders, grey flags on hover

- **Gallery in the popover:** clicking a thumbnail no longer swaps the panel image. It opens the photo full-screen in a viewer.
  - The viewer has a title, an "n / N" count, ‹ › buttons, arrow keys, swipe on phones, and a thumbnail strip.
  - Esc, the close button or a click outside the photo closes it.
  - The ‹ › in the gallery header scroll the thumbnail strip.
  - Code: `openViewer` / `viewerShow` / `closeViewer` in `app.js`, `.mm-viewer*` in `style.css`.
- **Sarene renders:** 12 images from the client in `assets/img/sarene/`. Each has a full-size copy (`NN.webp`, max 1600 px) for the viewer and a small copy (`NN-t.webp`, 480 px) for the strip.
  - Gallery items in `data.js` can be `{ src, thumb }` or a plain path.
  - The first render is also the panel's main image.
- **Hover on a building:** the other project flags turn grey (`.mm-markers.is-focusing`), so the hovered one stands out.

## v6.0: every tab change goes through the clouds, timed by loading

- **Khu đô thị ⇄ Tiện ích:** this switch used to be a crossfade. It now flies through the clouds like the other tab changes.
- **Speed follows loading:**
  - If the new map's image is already loaded, the cloud pass runs faster: about 1.9 s instead of 2.6 s.
  - If it isn't, the timeline pauses behind the clouds with the spinning logo until the image arrives, then the clouds part.
  - A 10 s safety limit stops it from ever getting stuck.
  - Code: `mapLoaded`, `mapReady` and `holdUntilLoaded` in `app.js`, used by `dive`, `toOverview` and `switchTab`.
- **Fix: logo during map changes.** The logo tweens now use `overwrite: 'auto'`, so the spinning logo appears during map changes again.
  With `overwrite: true`, the fade-out tween had cancelled the fade-in as soon as it was created.
- Tổng quan also opens fully zoomed out (the whole map fills the frame), same as Khu đô thị. Zooming in is left to the visitor.
- "Xem chi tiết dự án / tiện ích" with no page yet (`href: '#'`) shows a toast, "Tính năng đang được phát triển", instead of a dead link (`P.toast`, `.mm-toast`).
- Page (full view): the Sala logo links back to the home page, the section version (`modeHref('section')`).
- Tiện ích: hovering an amenity node (or focusing it with the keyboard) shows its name in a solid Sala-gold tooltip above it (`.mm-pin__tip`).
- Page: a bottom fade, black 30% to 0% going up (`.mm-bottomfade`, up to 300 px tall), sits over the map image and under the labels, clouds and UI. It makes the Sala logo read on every map.
- Tiện ích: the flat 30% black over the whole top-view (`.mm-shade`) is removed. Only the screen-fixed bottom fade (black 30% → 0%) stays, now in both section and page, and it does not change with zoom.
- Loading: while the clouds cover the frame, a white cloud bed (`.mm-clouds__veil`, about 90%) sits under the spinning logo. The background stays white with good contrast on first load, on map changes and while waiting for an image.
- Section (embed) 3D map: no bridge nodes at the opening view. A bridge node appears once the visitor zooms in (≥ 1.35× the opening zoom) and that bridge is inside the frame. No off-screen nodes are pinned to the edges. Page keeps all nodes as before (`updateEdges`).
- Controls slimmed: every group is 44 px wide (4 px border, 36×36 buttons, 18 px icons), with an 8 px gap. The +/− pair is 44×80, the single buttons are 44×44.
- Switch bar balanced with the controls. Tabs are 44 px tall, with 16 px text and 18 px icons.
  - Desktop bar: 449×60.
  - Phone portrait: 40 px tabs, 14 px text.
  - Phone landscape: 56×44 icon-only tabs.
- One margin for all map chrome: the controls, legend, switch bar and logo sit 12 px from the frame edge (was 20 px; 8 px on small landscape pages).
- Sala pin on the overview is 0.75× its old size (the disc is about 99 px on desktop). The tip stays on the same spot, and the click area shrinks with it.
- Switch bar: 2 px border (was 4).
- Control groups match the switch: 2 px border, 4 px inset, 32 px buttons. Still 44 px wide; the +/− pair is 44×76, the singles are 44×44.
- Standard corner radius is 4 px on every chrome box (switch, controls, legend); the inner pieces (active tab, buttons) are 2 px.
- Road comets (overview and 3D): no longer looping on every road. Each map runs one comet at a time on a random road, then stays quiet for 6–10 s (`cometLoop`, `COMET_GAP` in `app.js`). Hover highlights are unchanged.
- Fix: the edge mist was gone after every cloud transition. The ambient reset ran before the hole and scale tweens ended, and they overwrote it. The reset now runs after them (`cloudsOut`), so the mist drifts again at the frame edges on all maps.
- Idle edge mist: lighter, with small soft puffs instead of big banks. In the shader, `fq` doubles the frequency, the edge is softer and the shadows paler when `uEdge` = 1. AMBIENT density is 0.42–0.46 and alpha 0.65–0.7. The covering cloud bank used in transitions is unchanged.
- Tools have hover tooltips in solid Sala gold, to the right of each button: "Phóng to", "Thu nhỏ", "Về góc nhìn ban đầu" (the reload button) and "Toàn màn hình". They come from `data-tip`, use `.mm-ctrl button[data-tip]`, and are hidden on touch screens. The demo mode button keeps its own tooltip.

## v7.0: HD overview map + new legend; flags unfurl after the clouds

- **Overview map:** `assets/img/map-overview-hd.webp` is the designer's new 7482 px export, scaled to 4096 px.
  - It was registered on the old `map-tong.jpg` by matching the brown arterials: new = 5.258 × old − (475, 876), in old raster px.
  - It sits at map space (82.9, 335.7), 1304.9 × 1021.2 (`.mm-ov-img--hd`).
  - `MAPS.overview.bounds` now equals that extent.
  - The Sala zone, the pin and the road lights keep their coordinates and line up with the new roads.
  - The sepia grade is kept.
- **Legend:** `assets/img/legend-hd.webp` is the new legend, Vietnamese only. It keeps its proportions (`height: auto`).
- **Project flags (3D map):**
  - The reveal now waits until the clouds have opened. While the clouds cover the frame, `reveal` stores the map in `_revealWait`, and `cloudsOut` plays it.
  - In the reveal, each pole rises from its building, then the name unfurls from the pole (clip-path) and the text fades in.
  - Flags ripple outward from the centre of the view, 0.09 s apart (`reveal`, `flagsHidden`).
- Fix: Tiện ích top-view was placed 4.5 px down (the Figma offset), which left a black strip along the top edge when zoomed in. It now starts at 0. I checked the four corners of all three maps when zoomed in: no black strips.
- Tiện ích nodes: all Sala pink at rest. The hovered or selected node turns gold, and the others go grey meanwhile (`.mm-markers:has(.mm-pin:hover)`).

## v7.2: phones portrait + landscape; popover scrollbar

- **Portrait phones:**
  - The full-screen "Hãy xoay ngang" wall is gone, and the map is fully usable upright.
  - A small gold hint, "Xoay ngang để xem rõ hơn", appears once per session above the tab bar (`buildRotateHint`, `.mm-rothint`).
  - It closes with ×, on its own after about 7 s, or as soon as the phone is turned.
  - The legend is compact: 112 px.
  - The page version uses the same centred 3-tab bar with text as the embed, with a smaller logo above it on the left.
- **Landscape phones:** the legend is 128 px wide.
- **Bridge nodes:** on all phone layouts they behave like the embed: they show only after zooming in, and only for the bridges inside the frame.
- **Popover scrollbar:** a thin gold scrollbar with no track (6 px, darker on hover) instead of the grey OS bar.
- Sarene popover title: "Sarene" (was "Căn hộ Sarene").
- Tool column is the same in section and page: a gold +/− pair and cream single buttons. Section used to make every group gold.
- Cung văn hóa thiếu nhi: 3 renders from the client plus the existing render, in `assets/img/cung-van-hoa/` (full size and thumbnails). The first is the panel image. The old tower thumbnails (thumb-a/b) are no longer used there.
- Page (full map): the Sala logo is removed. The 3-tab bar sits alone at the bottom centre, 12 px from the bottom (8 px on landscape phones).
- Tiện ích: while a node is hovered or selected it turns gold, the other nodes go grey and the map dims a little (`.mm-am-dim`, black 32%).

## v7.4: full cloud loading only on the first visit; quick cloud puff between maps

- **First load (`intro`):** full clouds, the white bed and the spinning logo until the map image is ready. Unchanged.
- **Map changes:** `go` → `quickSwitch`.
  - The maps crossfade (0.55 s) while a quick, soft cloud puff drifts across: up in 0.42 s, back to the edge mist in 0.8 s, about 1.2 s in total.
  - There is no loading screen. The logo appears only if the new map's image really is not loaded yet.
- **"Về góc nhìn ban đầu":** glides back to the opening view, without clouds.
- The long cloud transitions (`dive`, `toOverview`, `switchTab`) are kept in `app.js` but not used.
- **Smoother cloud veil between maps:**
  - The noise is no longer zoomed (`scale` stays 1).
  - The cloud parallax offset glides to the new map's camera, so it no longer snaps at the end (`cloudPan`).
  - The veil rises and falls on one curve over 1.5 s.
  - The maps swap at 0.18 s, while the veil thickens.
  - The new map settles in 1.3 s.
- **Mouse wheel zoom works in the embed too, without holding Ctrl.**
  - Once the map is fully zoomed out and you keep scrolling down, or it is at max zoom, the wheel scrolls the page again.
  - On phones, zoom and pan use two fingers (pinch). One finger scrolls the page.
- Map changes (`quickSwitch`) have no clouds now. The current map fades out (0.28 s), then the new one fades in (0.45 s) while its camera settles. The edge mist stays and glides with the camera. Clouds remain only on the first load.
- Every map (Tổng quan, Khu đô thị, Tiện ích) opens fully zoomed out, both on first load and each time you switch to it. A map you leave is reset to that view. Code: `defaultCam`.

## v7.7: white-cloud quick switch; full-screen button

- **Map switches (`quickSwitch`):** they go through white clouds, the same look as the first load but without the logo.
  - Clouds and a white bed rise in 0.4 s, the maps swap underneath, then everything clears in 0.8 s.
  - The cloud noise is never zoomed, and the parallax glides to the new camera.
  - Labels, flags and nodes hide under the clouds (`.is-swapping`), while the tabs and tools stay. The flags unfurl once it clears.
- **First load:** white clouds and the spinning logo, unchanged.
- **Embed button:** "Xem toàn màn hình", with a 4-arrow expand icon, opens the full Masterplan page. It used to be the DEMO swap button.
- **Page button:** "Quay lại trang trước", with a back-arrow icon. It goes back in history to the previous page, or to the home page (embed) when the page was opened directly. Both use the gold tooltip.
- **Quick switch, same motion as the first load:**
  - It flies into the white cloud bank in 0.55 s: density up, a slight zoom into the clouds, and the white bed.
  - The maps swap underneath.
  - Then it plays the same clearing as the first load (`cloudsOut`: a hole opens from the centre while the clouds sweep past), at 1.35× speed.
  - The new map's camera glides in as the clouds part.
  - The map is interactive again after about 1.3 s.
- **Quick tab change, map already loaded:** a white cloud band flies across from left to right, about 1.4 s.
  - It covers the frame, the maps swap underneath, and it moves on to the right.
  - Labels and nodes come back once it has passed.
  - This uses the shader's `uSweep`, `uSweepL`, `uSweepT` and `uDrift` uniforms, and the white bed follows the band with a mask.
- **Map not loaded yet** (first load, or a slow image): the clouds close in, the logo spins until the image arrives, then the clouds burst open from the centre.
- **Gallery strip in the popover:** no scrollbar; it is moved with the ‹ › arrows.
- Sweep made softer: finer puffs (the same small puffs as the edge mist), wide feathered edges (±0.3 in the shader, ±28% on the white bed), a gentler rise (density 0.92, bed 0.8), and a steady drift to the right. About 1.6 s in total.

## v8.0: one transition style everywhere
- **Same cloud transition for every tab change and for the first load** (feedback 02/11 "nhất quán 1 kiểu transition"):
  - white clouds close in;
  - the maps swap underneath;
  - the clouds burst open from the centre (`cloudsOut`).
  - The left-to-right sweep was removed. The `uSweep*` uniforms stay in the shader but are unused (sweep 0).
- **Spinning logo only when loading is slow:**
  - `holdUntilLoaded` checks once the clouds have closed.
  - If the map image has arrived, nothing pauses and there is no logo.
  - If the map is still loading, the clouds hold quietly. The logo appears only if the wait passes 0.6 s (`LOGO_DELAY`), then the clouds open when the image is ready (10 s safety).

## v8.1: page speed + photo viewer fix (02/11)
- **Page speed**, measured with Playwright, cache off:
  - **Before:** 4.1 MB. On slow 4G, the first map appeared after 10.1 s and the page was interactive after 12.2 s.
  - **After:** 2.8 MB. On slow 4G, the first map appears after 4.5 s and the page is interactive after 6.5 s.
  - **Fast network:** about 0.6 s to the first map. The ~3.6 s to interactive is the cloud intro itself.
- **WebP map images** (q78, no visible difference at 4× zoom). The JPGs stay in `assets/img/` for the tools.
  - `map-3d.webp`: 1.25 MB → 845 KB.
  - `map-topview.webp`: 1.18 MB → 731 KB.
  - `map-3d-dusk.webp`: 751 KB → 419 KB.
  - `pattern-sala.webp` (the loading logo): 74 KB → 31 KB.
- **Opening map first:**
  - Map images register through `lazy(node, map, url)`. Nothing is requested at build time.
  - `loadMap(map, high)` sets the sources, with `fetchpriority=high` for the map being opened.
  - The intro loads only the opening map. About 0.6 s after it shows, `loadRest()` fetches the other maps one at a time in the background.
  - A tab click calls `loadMap` at once. `mapLoaded`/`mapReady` take pending maps into account, so `holdUntilLoaded` still covers a map that is not there yet (logo only after 0.6 s).
- **Photo viewer fix** ("bấm đổi ảnh nhưng ảnh không đổi"):
  - **Problem:** on a slow connection the browser kept the old photo on screen until the new full-size file arrived. The counter changed, but the photo did not.
  - **Now:** the photo changes at once. The cached thumbnail shows at the full image's size, softly blurred (`.is-lowres`), then the full image replaces it once decoded.
  - The photos either side are preloaded, so ‹ › is usually instant.
  - A token stops a late load from overwriting a newer click.
- **Viewer frame (v8.2):** every photo shows at one size (feedback "chung 1 size, tránh nhảy lúc to lúc nhỏ").
  - The frame is a fixed 16:9 box: the largest that fits the stage, at most 1280 px wide (container query units on `.mm-viewer__stage`).
  - The photo fills it with `object-fit: cover`.
  - Cung văn hóa photos (765–1600 px, ratios 1.85–2.0) and Sarene (1224×755) now all take the same box, so stepping through never jumps.
  - The viewer strip thumbnails are 16:9 too.

## v8.3: popover stats rule + skeleton (02/11)
- **Stats, one rule:** every popover puts the label on the left and the value on the right.
  - `stats` in data.js are now `[label, value]` for every item.
  - The `statsValueFirst` option was removed.
  - Sarene was converted to the new order.
- **Skeleton:**
  - The main image and gallery thumbnails sit in `.mm-skel` frames: a soft shimmer (Sala cream) until each picture has loaded.
  - The picture then fades in (`.is-loaded`). Already cached pictures show at once.
  - The shimmer stops under `prefers-reduced-motion`.
