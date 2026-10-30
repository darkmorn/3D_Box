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

// open the camera tab
await page.evaluate(() => {
  [...document.querySelectorAll('.side-tabs button')].find((b) => b.textContent.includes('机位'))?.click();
});
await new Promise((r) => setTimeout(r, 700));

const readKeys = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.keyframe-row')].map((r) => ({
      label: r.querySelector('.kf-label')?.textContent,
      time: r.querySelector('.kf-time')?.textContent,
    })),
  );

report.before = await readKeys();

// ---- 1. adding a node must not re-time the existing ones ----
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('添加节点'));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 800));
const afterAdd = await readKeys();
report.afterAdd = afterAdd;
report.existingTimesUnchanged = report.before.every((k) => {
  const match = afterAdd.find((n) => n.label === k.label);
  return match && match.time === k.time;
});
report.nodeCountGrew = afterAdd.length === report.before.length + 1;
await page.screenshot({ path: `${OUT}/kf01-after-add.png` });

// ---- 2. a middle node can be deleted ----
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.keyframe-row')];
  const mid = rows[1];
  mid?.click();
});
await new Promise((r) => setTimeout(r, 500));
report.deleteEnabled = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('删除选中'));
  return btn ? !btn.disabled : null;
});
const beforeDelete = await readKeys();
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('删除选中'));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 700));
const afterDelete = await readKeys();
report.afterDelete = afterDelete;
report.deleteWorked = afterDelete.length === beforeDelete.length - 1;

// ---- 3. nodes stay a constant size on screen when zooming out ----
const nodeScreenSize = () =>
  page.evaluate(() => {
    const mount = document.querySelector('.viewport');
    if (!mount) return null;
    const api = mount.__viewport?.current || mount.__viewport;
    return api?.debugNodeScreenRadius ? api.debugNodeScreenRadius() : null;
  });

const nearSize = await nodeScreenSize();
report.nearRadius = nearSize;
const canvasBox = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: r.width / 2, y: r.height / 2 };
});
report.canvasFound = !!canvasBox;

for (let i = 0; canvasBox && i < 18; i++) {
  await page.mouse.move(canvasBox.x, canvasBox.y);
  await page.mouse.wheel({ deltaY: 240 });
  await new Promise((r) => setTimeout(r, 30));
}
await new Promise((r) => setTimeout(r, 700));
const farSize = await nodeScreenSize();
report.nodeScreenRadius = { near: nearSize, far: farSize };
report.nodeSizeStable =
  nearSize != null && farSize != null && Math.abs(nearSize - farSize) / Math.max(nearSize, 1) < 0.25;

await page.screenshot({ path: `${OUT}/kf02-zoomed-out.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
