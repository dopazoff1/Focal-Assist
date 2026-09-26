const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const output = path.resolve('.design-qa');
fs.mkdirSync(output, { recursive: true });
const routeSource = fs.readFileSync('src/app/app.routes.ts', 'utf8');
const dirs = [...new Set([...routeSource.matchAll(/import\('\.\/components\/([^/]+)\//g)].map(m => m[1]))]
  .filter(name => !/^(v[45]|marketing|astra|public-chat)/.test(name));
if (!dirs.includes('calendar')) dirs.push('calendar');
const inventoryOnly = process.argv.includes('--inventory-only');
const map = dirs.map(name => {
  const root = path.join('src/app/components', name);
  const files = fs.readdirSync(root).filter(file => /\.(ts|css|html)$/.test(file));
  const sources = files.map(file => ({ file, source: fs.readFileSync(path.join(root, file), 'utf8') }));
  return {
    name, files,
    nested: [...new Set(sources.flatMap(({ source }) => [...source.matchAll(/<([a-z]+-[\w-]+)/g)].map(m => m[1])))],
    motion: sources.flatMap(({ file, source }) => source.split('\n').flatMap((line, index) =>
      /@keyframes|animation:|requestAnimationFrame|setInterval|setTimeout|ResizeObserver|IntersectionObserver/.test(line)
        ? [{ file, line: index + 1, source: line.trim().slice(0, 200) }] : [])),
  };
});
fs.writeFileSync(path.join(output, inventoryOnly ? 'component-map-after.json' : 'component-map.json'), JSON.stringify(map, null, 2));

if (!inventoryOnly) (async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    await page.goto('http://localhost:4200/login');
    await page.locator('#login-email').fill('test@test.com');
    await page.locator('#login-password').fill('1234');
    await page.screenshot({ path: path.join(output, 'before-login.png') });
    await page.locator('.login-btn').click();
    await page.waitForURL('**/v3/**', { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, 'before-home.png') });
    const profile = await page.evaluate(() => ({
      path: location.pathname, width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      animations: document.getAnimations().map(a => ({ state: a.playState, name: a.animationName || 'WAAPI' })),
      canvasCount: document.querySelectorAll('canvas').length,
      heading: document.querySelector('h1')?.textContent,
      topbar: document.querySelector('.v3-topbar')?.getBoundingClientRect().height,
    }));
    fs.writeFileSync(path.join(output, 'baseline.json'), JSON.stringify(profile, null, 2));
    console.log(JSON.stringify({ components: map.length, profile }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
