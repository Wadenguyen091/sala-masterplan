// Bake the vector overview (assets/map/overview.svg) + the sepia grade into one 2x raster,
// so pan/zoom is as light as a plain image. Run: node tools/bake_overview.cjs  (needs playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SCALE = +(process.argv[2] || 2);
(async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'assets/map/overview.svg'), 'utf8');
  const ff = (w, sub) => `@font-face{font-family:'Alegreya Sans';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, 'fonts', `alegreya-sans-${sub}-${w}-normal.woff2`)).toString('base64')}) format('woff2');unicode-range:${sub === 'latin' ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F' : 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'}}`;
  const fonts = [400, 500, 700].map(w => ff(w, 'latin') + ff(w, 'vietnamese')).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
    html,body{margin:0;background:#fff}
    #m{position:relative;width:1647px;height:1288px;overflow:hidden;isolation:isolate}
    #m svg{position:absolute;inset:0;width:100%;height:100%}
    #m .ov-labels text{paint-order:stroke;stroke:rgba(255,255,255,.6);stroke-width:1.4px;stroke-linejoin:round}
    #m .ov-labels .ov-ward{stroke-width:2px}
    #m::before{content:'';position:absolute;inset:0;background:rgba(68,50,25,.5);mix-blend-mode:hue;z-index:1}
    #m::after{content:'';position:absolute;inset:0;background:rgba(85,54,6,.2);z-index:1}
  </style></head><body><div id="m">${svg}</div></body></html>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1647, height: 1288 }, deviceScaleFactor: SCALE });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  const out = path.join(ROOT, 'assets/img/map-overview.png');
  await (await p.$('#m')).screenshot({ path: out });
  await b.close(); console.log(out);
})();
