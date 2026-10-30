import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.URL || 'http://127.0.0.1:8008/';
const OUT = 'shots';

if (!fs.existsSync(`${OUT}/02-selected.png`)) {
  console.error('run smoke.mjs first');
  process.exit(1);
}

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
await new Promise((r) => setTimeout(r, 2500));

const report = {};

// select the central box then drag its gizmo
await page.click('.object-row:nth-child(1)');
await new Promise((r) => setTimeout(r, 500));
report.posBefore = await page.$eval('.vec dd', (el) => el.textContent);

const gizmo = await page.evaluate(() => {
  const canvas = document.querySelector('.viewport canvas');
  const r = canvas.getBoundingClientRect();
  return { x: r.width / 2, y: r.height / 2 };
});

// drag from the gizmo origin (object center is near screen centre after fit)
await page.mouse.move(gizmo.x - 60, gizmo.y + 20);
await page.mouse.down();
await page.mouse.move(gizmo.x - 20, gizmo.y + 20, { steps: 10 });
await page.mouse.move(gizmo.x + 40, gizmo.y + 20, { steps: 10 });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 600));
report.posAfterDrag = await page.$eval('.vec dd', (el) => el.textContent);

report.stillSelected = (await page.$('.inspector')) !== null;
report.objectCount = await page.$$eval('.object-row', (e) => e.length);
await page.screenshot({ path: `${OUT}/08-after-drag.png` });

// rotate gizmo mode switch keeps selection
await page.click('.seg button:nth-child(2)');
await new Promise((r) => setTimeout(r, 400));
report.selectionAfterModeSwitch = (await page.$('.inspector')) !== null;

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
