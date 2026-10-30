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

// select an object so the inspector (with the 3 mode buttons) appears
await page.evaluate(() => document.querySelectorAll('.object-row')[1].click());
await new Promise((r) => setTimeout(r, 700));
report.modeButtons = await page.$$eval('.seg button', (els) => els.length);

// scale readout before
const scaleBefore = await page.$$eval('.vec dd', (els) => els[1].textContent);
report.scaleBefore = scaleBefore;
await page.screenshot({ path: `${OUT}/s01-translate-mode.png` });

// switch to scale mode: square handles replace the move arrows
await page.click('.seg button:nth-child(3)');
await new Promise((r) => setTimeout(r, 700));
report.scaleModeActive = await page.$eval('.seg button:nth-child(3)', (el) =>
  el.classList.contains('active'),
);
await page.screenshot({ path: `${OUT}/s02-scale-mode.png` });

// Drag the green Y scale handle (top of the object) and confirm the size changed.
const box = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas').getBoundingClientRect();
  return { x: c.width / 2, y: c.height / 2 };
});

let scaled = false;
// the Y handle sits above the selected mesh's centre; probe downward along that
// column until the drag actually resizes something
for (const dy of [-95, -80, -65, -50, 60, 80]) {
  const sx = box.x;
  const sy = box.y + dy;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy - 90, { steps: 14 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 400));
  const now = await page.$$eval('.vec dd', (els) => els[1].textContent);
  if (now !== scaleBefore) {
    scaled = true;
    report.scaleAfter = now;
    break;
  }
}
report.scaleChanged = scaled;
await page.screenshot({ path: `${OUT}/s03-after-scale.png` });

// back to translate: move arrows return
await page.click('.seg button:nth-child(1)');
await new Promise((r) => setTimeout(r, 600));
report.translateModeActive = await page.$eval('.seg button:nth-child(1)', (el) =>
  el.classList.contains('active'),
);
await page.screenshot({ path: `${OUT}/s04-back-to-translate.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
