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

// switch to the keyframe-bearing rig so the viewfinder has a real shot
await page.click('.camera-row:nth-child(1)');
await new Promise((r) => setTimeout(r, 700));

// Compare the viewfinder by screenshotting just that element: the WebGL canvas
// is not readable outside its frame without preserveDrawingBuffer.
const feedShot = async () => {
  const el = await page.$('.monitor-wrap');
  return el.screenshot({ encoding: 'base64' });
};

report.feedHash1 = (await feedShot()).length;
await new Promise((r) => setTimeout(r, 500));
const shot2 = await feedShot();

// the feed must not drift while nothing is moving
report.feedStableWhenIdle = (await feedShot()) === shot2;

// drag the rig through its gizmo, then confirm the feed changed
const gizmo = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas');
  const r = c.getBoundingClientRect();
  return { x: r.width / 2, y: r.height / 2 };
});
await page.mouse.move(gizmo.x, gizmo.y);
await page.mouse.down();
await page.mouse.move(gizmo.x + 120, gizmo.y - 40, { steps: 12 });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 900));

const shot3 = await feedShot();
report.feedChangedOnDrag = shot3 !== shot2;
await page.screenshot({ path: `${OUT}/c08-after-rig-drag.png` });

// timeline play should move the active rig and update the shot
await page.click('.play-btn');
await new Promise((r) => setTimeout(r, 2000));
const during = await page.$eval('.timecode', (e) => e.textContent);
await page.screenshot({ path: `${OUT}/c09-playing-shot.png` });
await page.click('.play-btn');
report.progressDuringPlay = during;

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
