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
const api = () =>
  page.evaluate(() => {
    const m = document.querySelector('.viewport');
    const a = m?.__viewport?.current || m?.__viewport;
    return a ? { hasDebug: !!a.debugPathState } : null;
  });
report.api = await api();

// open the camera tab
await page.evaluate(() => {
  [...document.querySelectorAll('.side-tabs button')].find((b) => b.textContent.includes('机位'))?.click();
});
await new Promise((r) => setTimeout(r, 700));

// select camera 1 so its path is drawn
await page.evaluate(() => document.querySelector('.camera-row')?.click());
await new Promise((r) => setTimeout(r, 800));

const pathInfo = () =>
  page.evaluate(() => {
    const m = document.querySelector('.viewport');
    const a = m?.__viewport?.current || m?.__viewport;
    return a?.debugPathState?.() || null;
  });

report.beforeHide = await pathInfo();
await page.screenshot({ path: `${OUT}/p01-path-visible.png` });

// hide camera 1 with the eye button
await page.evaluate(() => {
  document.querySelector('.camera-row .row-icon')?.click();
});
await new Promise((r) => setTimeout(r, 900));
report.afterHidePath = await pathInfo();
report.pathHidden = report.afterHidePath && report.afterHidePath.knots === 0;
await page.screenshot({ path: `${OUT}/p02-path-hidden.png` });

// ---- clicking empty space clears the gizmo ----
await page.evaluate(() => {
  document.querySelector('.camera-row .row-icon')?.click(); // unhide
});
await new Promise((r) => setTimeout(r, 700));
await page.evaluate(() => document.querySelector('.camera-row')?.click());
await new Promise((r) => setTimeout(r, 700));

const gizmoVisible = () =>
  page.evaluate(() => {
    const m = document.querySelector('.viewport');
    const a = m?.__viewport?.current || m?.__viewport;
    return a?.debugGizmoCount?.() ?? null;
  });

report.gizmoWhileSelected = await gizmoVisible();

// click a far corner of the viewport = empty space
const box = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas');
  const r = c.getBoundingClientRect();
  return { x: r.left + 40, y: r.top + 40 };
});
await page.mouse.click(box.x, box.y);
await new Promise((r) => setTimeout(r, 700));
report.gizmoAfterEmptyClick = await gizmoVisible();
report.gizmoCleared = report.gizmoAfterEmptyClick === 0;
await page.screenshot({ path: `${OUT}/p03-empty-click.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
