const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:4200';
const outDir = path.join(process.cwd(), 'docs', 'pfe', 'screenshots-full');
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  ['01-login', '/login', false],
  ['02-command-center', '/v3/home', true],
  ['03-calendar', '/v3/calendar', true],
  ['04-crm-inbox', '/v3/crm', true],
  ['05-crm-ticket-detail', '/v3/crm/ticket/1', true],
  ['06-magic-assistance', '/v3/magic-assistance', true],
  ['07-knowledge-base', '/v3/knowledge-base', true],
  ['08-kb-analytics', '/v3/kb-analytics', true],
  ['09-collaboration-hub', '/v3/collaboration', true],
  ['10-chat-projects', '/v3/chat-projects', true],
  ['11-live-chat', '/v3/live-chat', true],
  ['12-process-assistant', '/v3/process-assistant', true],
  ['13-academy-home', '/v3/academy', true],
  ['14-academy-catalog', '/v3/academy/catalog', true],
  ['15-academy-course-viewer', '/v3/academy/course/1', true],
  ['16-academy-certificate', '/v3/academy/course/1/certificate', true],
  ['17-academy-studio', '/v3/academy/studio', true],
  ['18-academy-course-editor', '/v3/academy/studio/course/1', true],
  ['19-academy-analytics', '/v3/academy/analytics', true],
  ['20-staff-management', '/v3/staff-management', true],
  ['21-tree-builder', '/v3/tree-builder', true],
  ['22-kb-map-builder', '/v3/kb-map-builder', true],
  ['23-case-tag-builder', '/v3/case-tag-builder', true],
  ['24-prompt-map-builder', '/v3/prompt-map-builder', true],
  ['25-article-management', '/v3/article-management', true],
  ['26-article-editor', '/v3/article-management/edit/1', true],
  ['27-role-access-map', '/v3/role-access-map', true],
  ['28-settings', '/v3/settings', true],
  ['29-adherence-dashboard', '/v3/adherence-dashboard', true],
  ['30-qa-evaluation', '/v3/qa-evaluation', true],
  ['31-team-management', '/v3/team-management', true],
  ['32-channel-access-map', '/v3/channel-access-map', true],
  ['33-flowdesk-board', '/v3/flowdesk/board', true],
  ['34-flowdesk-backlog', '/v3/flowdesk/backlog', true],
  ['35-flowdesk-sprints', '/v3/flowdesk/sprints', true],
  ['36-flowdesk-reports', '/v3/flowdesk/reports', true],
  ['37-flowdesk-escalations', '/v3/flowdesk/escalations', true],
  ['38-v3-not-found', '/v3/404', true],
  ['39-article-not-found', '/v3/article-not-found', true],
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
  user.role = 'ADMIN';
  user.status = 'ONLINE';

  for (const [name, route, auth] of routes) {
    if (auth) await applyUser(page, user);
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(auth ? 2500 : 900);
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
