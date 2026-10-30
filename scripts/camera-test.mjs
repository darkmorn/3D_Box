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
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2600));

const report = {};
// the side panel opens on the scene tab; camera controls live under 机位
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.side-tabs button')].find((b) =>
    b.textContent.includes('机位'),
  );
  tab?.click();
});
await new Promise((r) => setTimeout(r, 700));

report.initialCameras = await page.$$eval('.camera-row', (e) => e.length);
report.initialName = await page.$eval('.cam-name', (e) => e.textContent);
report.monitorPresent = (await page.$('.monitor')) !== null;
await page.screenshot({ path: `${OUT}/c01-director-initial.png` });

// monitor should be showing a rendered frustum view (not blank)
report.monitorPainted = await page.evaluate(() => {
  const el = document.querySelector('.monitor');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});

// add a camera
await page.click('.add-cam');
await new Promise((r) => setTimeout(r, 700));
report.camerasAfterAdd = await page.$$eval('.camera-row', (e) => e.length);
report.selectedAfterAdd = await page.$eval('.camera-row.active .cam-name', (e) => e.textContent);
await page.screenshot({ path: `${OUT}/c02-camera-added.png` });

// switch FOV preset to 长焦
await page.evaluate(() => {
  [...document.querySelectorAll('.fov-presets button')].find((b) => b.textContent.includes('长焦')).click();
});
await new Promise((r) => setTimeout(r, 600));
report.fovAfterPreset = await page.$eval('.cam-field label em', (e) => e.textContent);
await page.screenshot({ path: `${OUT}/c03-fov-tele.png` });

// capture a keyframe from the current director view
const framesBefore = await page.$$eval('.camera-row.active .cam-meta', (e) => e[0].textContent);
await page.evaluate(() => {
  [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('捕获当前视角')).click();
});
await new Promise((r) => setTimeout(r, 600));
const framesAfter = await page.$$eval('.camera-row.active .cam-meta', (e) => e[0].textContent);
report.keyframesBefore = framesBefore;
report.keyframesAfter = framesAfter;

// enter look-through mode on the active camera
await page.evaluate(() => {
  [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('进入取景')).click();
});
await new Promise((r) => setTimeout(r, 900));
report.lookThroughActive = await page.$eval('.cam-btn.on', (e) => e.textContent).catch(() => null);
await page.screenshot({ path: `${OUT}/c04-look-through.png` });

// exit again
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.cam-btn')].find((x) => x.textContent.includes('退出取景'));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 600));

// camera POV helper
await page.evaluate(() => {
  [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('机位视角')).click();
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/c05-camera-pov.png` });

// render mode should shoot through the active camera
await page.evaluate(() => {
  [...document.querySelectorAll('.mode-btn')].find((b) => b.textContent.includes('成片预览')).click();
});
await new Promise((r) => setTimeout(r, 900));
report.cameraPanelHiddenInRender = await page.evaluate(() => {
  const p = document.querySelector('.camera-panel');
  return p ? getComputedStyle(p).display : 'missing';
});
await page.screenshot({ path: `${OUT}/c06-render-through-camera.png` });

await page.evaluate(() => {
  [...document.querySelectorAll('.mode-btn')].find((b) => b.textContent.includes('场景调度')).click();
});
await new Promise((r) => setTimeout(r, 500));

// duplicate then delete
await page.evaluate(() => {
  [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('复制')).click();
});
await new Promise((r) => setTimeout(r, 700));
report.camerasAfterDuplicate = await page.$$eval('.camera-row', (e) => e.length);

await page.evaluate(() => {
  [...document.querySelectorAll('.cam-btn')].find((b) => b.textContent.includes('删除')).click();
});
await new Promise((r) => setTimeout(r, 700));
report.camerasAfterDelete = await page.$$eval('.camera-row', (e) => e.length);

// generate a new scene -> cameras reseeded
await page.click('.examples button:nth-child(2)');
await page.click('.send-btn');
await page.waitForFunction(() => !document.querySelector('.send-btn').disabled, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1200));
report.camerasAfterGenerate = await page.$$eval('.camera-row', (e) => e.length);
report.sceneTitle = await page.$eval('.brand-text span', (e) => e.textContent);
await page.screenshot({ path: `${OUT}/c07-reseeded.png` });

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
