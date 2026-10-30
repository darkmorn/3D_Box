import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.URL || 'http://127.0.0.1:8008/';
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2800));

const report = {};

// node cards keep a stable pixel size at any zoom
const nodePx = () =>
  page.evaluate(() => {
    const mount = document.querySelector('.viewport');
    const api = mount?.__viewport?.current || mount?.__viewport;
    return api?.debugNodePixelSize ? api.debugNodePixelSize() : null;
  });

report.pxAtDefault = await nodePx();
await page.screenshot({ path: `${OUT}/nc01-nodes.png` });

const box = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas').getBoundingClientRect();
  return { x: c.width / 2, y: c.height / 2 };
});
for (let i = 0; i < 14; i++) {
  await page.mouse.move(box.x, box.y);
  await page.mouse.wheel({ deltaY: 240 });
  await new Promise((r) => setTimeout(r, 25));
}
await new Promise((r) => setTimeout(r, 600));
report.pxZoomedOut = await nodePx();
report.sizeStable =
  report.pxAtDefault && report.pxZoomedOut
    ? Math.abs(report.pxAtDefault.w - report.pxZoomedOut.w) <= 2
    : false;
await page.screenshot({ path: `${OUT}/nc02-zoomed.png` });

// clicking empty space clears the selection and hides the gizmo
await page.evaluate(() => document.querySelectorAll('.object-row')[1]?.click());
await new Promise((r) => setTimeout(r, 600));
report.selectedBefore = await page.evaluate(() =>
  !!document.querySelector('.object-row.active'),
);

// click a far corner of the canvas (empty sky)
await page.mouse.click(box.x - 380, box.y - 260);
await new Promise((r) => setTimeout(r, 700));
report.selectedAfterBlankClick = await page.evaluate(() =>
  !!document.querySelector('.object-row.active'),
);
report.gizmoHidden = await page.evaluate(() => {
  const mount = document.querySelector('.viewport');
  const api = mount?.__viewport?.current || mount?.__viewport;
  return api?.debugGizmoVisible ? !api.debugGizmoVisible() : null;
});
await page.screenshot({ path: `${OUT}/nc03-blank-click.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
