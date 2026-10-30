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
report.buttonLabel = await page.$eval('.export-btn:not(.is-secondary)', (e) => e.textContent.trim());
report.jsonButton = await page.$eval('.export-btn.is-secondary', (e) => e.textContent.trim());

// record a short take through the exposed API and inspect the result
const take = await page.evaluate(async () => {
  const mount = document.querySelector('.viewport');
  const api = mount.__viewport?.current || mount.__viewport;
  if (!api?.recordShot) return { error: 'recordShot missing' };

  // start from the dark UI to prove the plate is forced light
  const themeBefore = document.documentElement.dataset.theme;
  const blob = await api.recordShot({ fps: 24, seconds: 1.5 });
  const themeAfter = document.documentElement.dataset.theme;

  // decode it back to confirm size + a sample frame
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.src = url;
  v.muted = true;
  await new Promise((res, rej) => {
    v.onloadedmetadata = res;
    v.onerror = () => rej(new Error('decode failed'));
    setTimeout(() => rej(new Error('timeout')), 8000);
  });
  const meta = { duration: +v.duration.toFixed(2), w: v.videoWidth, h: v.videoHeight, bytes: blob.size };
  v.currentTime = 0.3;
  await new Promise((r) => { v.onseeked = r; setTimeout(r, 2500); });
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const px = c.getContext('2d').getImageData(30, 30, 1, 1).data;
  return { themeBefore, themeAfter, meta, topLeftPixel: [px[0], px[1], px[2]] };
});

report.take = take;
report.plateIsLight = take.topLeftPixel && take.topLeftPixel[0] > 150;
report.themeRestored = take.themeBefore === take.themeAfter;
report.errors = errors;

console.log(JSON.stringify(report, null, 2));
await browser.close();
