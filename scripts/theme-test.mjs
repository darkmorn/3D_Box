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
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2800));

const report = {};
const read = () =>
  page.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).backgroundColor : null;
    };
    return {
      theme: document.documentElement.dataset.theme,
      topChrome: cs('.top-chrome'),
      sidePanel: cs('.side-panel'),
      timeline: cs('.timeline-dock'),
    };
  });

const luminance = (rgb) => {
  const m = rgb?.match(/\d+/g);
  if (!m) return null;
  const [r, g, b] = m.map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

report.initial = await read();
report.defaultsToDark = report.initial.theme === 'dark';
report.darkIsActuallyDark = luminance(report.initial.topChrome) < 0.3;
await page.screenshot({ path: `${OUT}/theme-dark.png` });

await page.click('.theme-toggle');
await new Promise((r) => setTimeout(r, 1000));
report.afterToggle = await read();
report.togglesToLight = report.afterToggle.theme === 'light';
report.lightIsActuallyLight = luminance(report.afterToggle.topChrome) > 0.7;
await page.screenshot({ path: `${OUT}/theme-light.png` });

// the choice must survive a reload
await page.reload({ waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2400));
report.afterReload = (await read()).theme;
report.persists = report.afterReload === 'light';

// put it back to dark so a fresh visitor sees the default
await page.click('.theme-toggle');
await new Promise((r) => setTimeout(r, 800));
report.backToDark = (await read()).theme === 'dark';

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
