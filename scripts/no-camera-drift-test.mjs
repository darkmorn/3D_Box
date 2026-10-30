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
await new Promise((r) => setTimeout(r, 2600));

const report = {};

// expose the director camera so we can prove it does not move during a drag
await page.evaluate(() => {
  const el = document.querySelector('.viewport');
  window.__cam = () => {
    const api = el.__viewport?.current || el.__viewport;
    return api?.getCamera?.() || api?.captureView?.() || null;
  };
});

await page.evaluate(() => {
  const rows = document.querySelectorAll('.object-row');
  rows[1].click();
});
await new Promise((r) => setTimeout(r, 600));

const camBefore = await page.evaluate(() => window.__cam());
report.camBefore = camBefore;
report.isScreenCentre = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas').getBoundingClientRect();
  return { cx: Math.round(c.width / 2), cy: Math.round(c.height / 2), w: c.width, h: c.height };
});

const posBefore = await page.$eval('.vec dd', (e) => e.textContent);

// drag the gizmo horizontally
const box = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas').getBoundingClientRect();
  return { x: c.width / 2, y: c.height / 2 };
});
await page.mouse.move(box.x, box.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(box.x + i * 10, box.y + i * 2);
}
await page.mouse.up();
await new Promise((r) => setTimeout(r, 600));

const camAfter = await page.evaluate(() => window.__cam());
report.camAfter = camAfter;
report.objectMoved = (await page.$eval('.vec dd', (e) => e.textContent)) !== posBefore;

const dist = (a, b) =>
  a && b ? Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]) : null;
report.cameraDrift = dist(camBefore, camAfter);
report.cameraStayedPut = report.cameraDrift !== null && report.cameraDrift < 0.01;

await page.screenshot({ path: `${OUT}/d01-after-object-drag.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
