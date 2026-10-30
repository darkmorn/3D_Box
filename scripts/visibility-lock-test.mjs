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

// ---- scene objects ----
report.rows = await page.$$eval('.object-row', (e) => e.length);
report.iconButtonsPerRow = await page.$$eval('.object-row:first-child .row-icon', (e) => e.length);

// hide the first object
await page.evaluate(() => {
  document.querySelector('.object-row .row-icon')?.click();
});
await new Promise((r) => setTimeout(r, 500));
report.hiddenClassApplied = await page.$eval('.object-row', (e) =>
  e.classList.contains('is-hidden'),
);
await page.screenshot({ path: `${OUT}/vl01-object-hidden.png` });

// unhide
await page.evaluate(() => document.querySelector('.object-row .row-icon')?.click());
await new Promise((r) => setTimeout(r, 400));
report.hiddenClassCleared = await page.$eval('.object-row', (e) =>
  !e.classList.contains('is-hidden'),
);

// lock the second object: the row gains is-locked and the gizmo must detach
await page.evaluate(() => {
  const row = document.querySelectorAll('.object-row')[1];
  row.querySelectorAll('.row-icon')[1].click();
  row.click();
});
await new Promise((r) => setTimeout(r, 700));
report.lockClassApplied = await page.evaluate(() =>
  document.querySelectorAll('.object-row')[1].classList.contains('is-locked'),
);
await page.screenshot({ path: `${OUT}/vl02-object-locked.png` });

// ---- cameras ----
await page.evaluate(() => {
  [...document.querySelectorAll('.side-tabs button')].find((b) => b.textContent.includes('机位'))?.click();
});
await new Promise((r) => setTimeout(r, 700));

report.cameraRows = await page.$$eval('.camera-row', (e) => e.length);
report.cameraIconsPerRow = await page.$$eval('.camera-row:first-child .row-icon', (e) => e.length);

await page.evaluate(() => {
  document.querySelector('.camera-row .row-icon')?.click();
});
await new Promise((r) => setTimeout(r, 500));
report.cameraHidden = await page.$eval('.camera-row', (e) => e.classList.contains('is-hidden'));
await page.screenshot({ path: `${OUT}/vl03-camera-hidden.png` });

await page.evaluate(() => {
  const row = document.querySelector('.camera-row');
  row.querySelectorAll('.row-icon')[1]?.click();
});
await new Promise((r) => setTimeout(r, 500));
report.cameraLocked = await page.$eval('.camera-row', (e) => e.classList.contains('is-locked'));

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
