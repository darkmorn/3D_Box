import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${OUT}/01-initial.png` });

const report = {};

report.canvas = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas');
  if (!c) return null;
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  return { w: c.width, h: c.height, hasGL: !!gl };
});

report.objectCount = await page.$$eval('.object-row', (els) => els.length);
report.status = await page.$eval('.status', (el) => el.textContent);

// select an object -> inspector appears
await page.click('.object-row');
await new Promise((r) => setTimeout(r, 600));
report.inspectorVisible = (await page.$('.inspector')) !== null;
await page.screenshot({ path: `${OUT}/02-selected.png` });

// play the camera move to the middle
await page.click('.play-btn');
await new Promise((r) => setTimeout(r, 2200));
report.progressAfterPlay = await page.$eval('.timecode', (el) => el.textContent);
await page.screenshot({ path: `${OUT}/03-playing.png` });
await page.click('.play-btn');

// scrub to end
await page.$eval('.scrub', (el) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '0.95');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 700));
report.progressAfterScrub = await page.$eval('.timecode', (el) => el.textContent);
await page.screenshot({ path: `${OUT}/04-scrubbed.png` });

// render preview mode (no grid / no path)
await page.evaluate(() => {
  [...document.querySelectorAll('.mode-btn')].find((b) => b.textContent.includes('成片预览')).click();
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}/05-render-mode.png` });
await page.evaluate(() => {
  [...document.querySelectorAll('.mode-btn')].find((b) => b.textContent.includes('场景调度')).click();
});
await new Promise((r) => setTimeout(r, 400));

// generate a fresh scene from the street demo prompt
await page.click('.examples button:nth-child(2)');
await page.click('.send-btn');
await page.waitForFunction(
  () => !document.querySelector('.send-btn').disabled,
  { timeout: 20000 },
);
await new Promise((r) => setTimeout(r, 1200));
report.statusAfterGenerate = await page.$eval('.status', (el) => el.textContent);
report.titleAfterGenerate = await page.$eval('.brand-text span', (el) => el.textContent);
report.objectCountAfterGenerate = await page.$$eval('.object-row', (els) => els.length);
await page.screenshot({ path: `${OUT}/06-generated.png` });

// capture-frame button downloads + shows preview
const before = fs.readdirSync(OUT).length;
await page.click('.ghost-btn');
await new Promise((r) => setTimeout(r, 900));
report.framePeek = (await page.$('.frame-peek img')) !== null;
await page.screenshot({ path: `${OUT}/07-frame-peek.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));

await browser.close();
