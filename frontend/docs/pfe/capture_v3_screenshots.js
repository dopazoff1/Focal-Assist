const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:4200';
const outDir = path.join(process.cwd(), 'docs', 'pfe', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  ['01-login', '/login', false],
  ['02-command-center', '/v3/home', true],
  ['03-knowledge-base', '/v3/knowledge-base', true],
  ['04-kb-analytics', '/v3/kb-analytics', true],
  ['05-magic-assistance', '/v3/magic-assistance', true],
  ['06-crm-inbox', '/v3/crm', true],
  ['07-chat-projects', '/v3/chat-projects', true],
  ['08-live-chat', '/v3/live-chat', true],
  ['09-process-assistant', '/v3/process-assistant', true],
  ['10-academy', '/v3/academy', true],
  ['11-role-access-map', '/v3/role-access-map', true],
];

async function loginPayload(page) {
  const response = await page.request.post(`${baseUrl}/auth/login`, {
    data: { email: 'test@test.com', password: '1234' },
  });
  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }
  return await response.json();
}

async function applyUser(page, user) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate((u) => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('token', u.token || '');
    localStorage.setItem('id', String(u.id));
    localStorage.setItem('firstName', u.firstName || '');
    localStorage.setItem('lastName', u.lastName || '');
    localStorage.setItem('email', u.email || '');
    localStorage.setItem('dob', u.dob || '');
    localStorage.setItem('role', String(u.role || 'ADMIN'));
    localStorage.setItem('status', u.status || 'ONLINE');
    localStorage.setItem('timeZone', u.timeZone || '');
    localStorage.setItem('hasProfilePhoto', u.hasProfilePhoto ? '1' : '0');
    localStorage.setItem('profilePhotoUpdatedAt', u.profilePhotoUpdatedAt || '');
    localStorage.setItem('name', `${u.firstName || ''} ${u.lastName || ''}`.trim());
  }, user);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });

  const user = await loginPayload(page);
  // For screenshots we need the shell navigation visible. The backend still enforces
  // permissions; this only helps frontend-only feature chips render in the deck.
  user.role = 'ADMIN';

  for (const [name, route, auth] of routes) {
    if (auth) await applyUser(page, user);
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(auth ? 2200 : 900);
    const target = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: target, fullPage: false });
    console.log(target);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
