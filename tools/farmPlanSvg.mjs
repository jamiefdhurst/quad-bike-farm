// Renders the farm plan's map (docs/farm-plan-map.html, which draws it with script) to docs/farm-plan.svg: the proposed map only, with its
// colours and text styles written into the SVG so it stands on its own. Run it after changing the map page, in the same PR as the plan.
//
//   node tools/farmPlanSvg.mjs

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromePath } from './frameBudgetRun.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const page = pathToFileURL(`${root}docs/farm-plan-map.html`).href;
const out = `${root}docs/farm-plan.svg`;

const executablePath = chromePath();
if (!executablePath) throw new Error('no Chrome found. Set CHROME_PATH.');
const browser = await puppeteer.launch({ executablePath, headless: 'new' });
try {
  const tab = await browser.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.goto(page, { waitUntil: 'load' });
  if (errors.length) throw new Error(`the map page threw: ${errors.join('; ')}`);
  const svg = await tab.evaluate(() => {
    const map = document.getElementById('map').cloneNode(true);
    // The first view is the proposed map; the second is today's farm at the same scale.
    map.querySelectorAll(':scope > g.view').forEach((v, k) => (k === 0 ? v.removeAttribute('style') : v.remove()));
    map.querySelectorAll('.on').forEach((e) => e.classList.remove('on'));
    map.querySelectorAll('[tabindex]').forEach((e) => e.removeAttribute('tabindex'));
    // The page's map colours (the light :root, not the dark theme's) and the map's text styles.
    const keep = /^(\.fname|\.fsub|\.bname|\.big|\.grid text|\.road-label|\.lbl)/;
    const rules = [...[...document.styleSheets].find((sheet) => sheet.ownerNode.tagName === 'STYLE').cssRules]; // not the fonts' sheet
    const vars = rules.find((r) => r.selectorText === ':root').style;
    const mapVars = [...vars].filter((n) => n.startsWith('--m-') || n === '--display' || n === '--ui').map((n) => `  ${n}: ${vars.getPropertyValue(n).trim()};`);
    const css = [':root {', ...mapVars, '}', ...rules.filter((r) => r.selectorText && keep.test(r.selectorText)).map((r) => r.cssText)].join('\n');
    const [, , w, h] = map.getAttribute('viewBox').split(/\s+/);
    map.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    map.setAttribute('width', w);
    map.setAttribute('height', h);
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `\n${css}\n`;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'The farm plan';
    map.prepend(style);
    map.prepend(title);
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const [x, y] = map.getAttribute('viewBox').split(/\s+/);
    Object.entries({ x, y, width: w, height: h, fill: 'var(--m-paper)' }).forEach(([k, v]) => bg.setAttribute(k, v));
    style.after(bg);
    return new XMLSerializer().serializeToString(map);
  });
  writeFileSync(out, `${svg}\n`);
  console.log(`wrote ${out} (${Math.round(svg.length / 1024)} KB)`);
} finally {
  await browser.close();
}
