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

// the side panel opens on the scene tab; camera controls live under 机位
await page.evaluate(() => {
  [...document.querySelectorAll('.side-tabs button')]
    .find((b) => b.textContent.includes('机位'))
    ?.click();
});
await new Promise((r) => setTimeout(r, 700));

// park the director view next to the rig so its rings are on screen
await page.click('.camera-row');
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => {
  [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('机位视角'))?.click();
});
await new Promise((r) => setTimeout(r, 1100));
await page.screenshot({ path: `${OUT}/g01-rig-visible.png` });

// Walk a grid over the canvas looking for the app's own `grab` cursor, which
// pickRing sets only when a gimbal ring is under the pointer.
const findRing = async () => {
  const { w, h } = await page.evaluate(() => {
    const c = document.querySelector('.viewport canvas').getBoundingClientRect();
    return { w: c.width, h: c.height };
  });
  for (let y = h * 0.25; y < h * 0.95; y += h * 0.03) {
    for (let x = w * 0.05; x < w * 0.95; x += w * 0.02) {
      await page.mouse.move(x, y);
      await new Promise((r) => setTimeout(r, 12));
      const cursor = await page.evaluate(() => document.querySelector('.viewport canvas')?.style.cursor);
      if (cursor === 'grab') return { x, y };
    }
  }
  return null;
};

const spot = await findRing();
report.ringFound = !!spot;

if (spot) {
  // read the rig's aim before and after the ring drag
  const readAim = () =>
    page.evaluate(() => {
      const row = document.querySelector('.camera-row');
      return row ? row.textContent : null;
    });

  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(spot.x + i * 12, spot.y);
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 600));

  report.ringSpot = { x: Math.round(spot.x), y: Math.round(spot.y) };
  await page.screenshot({ path: `${OUT}/g02-after-ring-drag.png` });

  // Director camera must not have moved with the ring drag.
  const cam = await page.evaluate(() => {
    const m = document.querySelector('.viewport');
    const api = m.__viewport?.current || m.__viewport;
    return api?.getCamera?.() || null;
  });
  report.directorCam = cam;
}

await page.screenshot({ path: `${OUT}/g03-final.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
