const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { login, applyUser, inspect } = require('../.hallmark/verify-v3-routes.cjs');
const base = process.env.BASE_URL || 'http://localhost:4200';
const out = path.resolve('.design-qa');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { checks: [], errors: [], limitations: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => report.errors.push(e.message));
    const user = await login(page);
    await applyUser(page, user);
    const response = await page.request.get(`${base}/api/kb/articles`, { headers: { Authorization: `Bearer ${user.token}` } });
    const articles = response.ok() ? await response.json() : [];
    const article = Array.isArray(articles) ? articles.find(a => Number.isFinite(a.id)) : undefined;
    if (!article) report.limitations.push(`No accessible article for editor verification: HTTP ${response.status()}`);

    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
      if (article) {
        await page.goto(`${base}/v3/article-management/edit/${article.id}`);
        await page.locator('.article-editor-page').waitFor();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(out, `article-editor-${width}.png`) });
        const result = await inspect(page);
        assert(!result.horizontalOverflow && result.mainVisible);
        report.checks.push({ name: 'existing-article-editor', width, articleId: article.id });
      }
      await page.goto(`${base}/v3/academy/studio/course/1`);
      await page.locator('.lesson-fields').waitFor();
      await page.waitForTimeout(300);
      const clipped = await page.locator('.course-editor .lesson-fields').evaluate(root => [...root.querySelectorAll('input,select')].filter(el => {
        const r = el.getBoundingClientRect();
        const parent = root.getBoundingClientRect();
        return r.right > parent.right + 2 || r.left < parent.left - 2;
      }).length);
      assert.equal(clipped, 0, 'Lesson controls must fit their editor');
      const settingsClipped = await page.locator('.course-editor .settings-body').evaluate(root => root.scrollWidth > root.clientWidth + 2);
      assert.equal(settingsClipped, false, 'Course settings must not scroll horizontally');
      assert((await page.locator('.lesson-content textarea').boundingBox()).height >= 260, 'Lesson editor must have usable writing space');
      await page.screenshot({ path: path.join(out, `academy-editor-${width}.png`) });
      report.checks.push({ name: 'lesson-controls-contained', width });

      await page.goto(`${base}/v3/academy/course/1`);
      await page.locator('.viewer-head').waitFor();
      const header = await page.locator('.viewer-head').boundingBox();
      assert(header.height < (width === 390 ? 260 : 150), 'Course header must remain compact');
      await page.screenshot({ path: path.join(out, `academy-course-${width}.png`) });
      report.checks.push({ name: 'compact-course-header', width, height: header.height });
    }

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${base}/v3/role-access-map`);
    await page.locator('.node-card').first().waitFor();
    await page.getByRole('button', { name: 'Auto Layout', exact: true }).click();
    const overlaps = await page.locator('.role-access-page').evaluate(root => {
      const nodes = [...root.querySelectorAll('.node-card')].map(el => el.getBoundingClientRect());
      return nodes.flatMap((a, i) => nodes.slice(i + 1).filter(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)).length;
    });
    assert.equal(overlaps, 0, 'Auto layout must not overlap role or feature nodes');
    const port = await page.locator('.choice-wire').first().boundingBox();
    assert(Math.abs(port.width - port.height) < 1, 'Connection ports must remain square');
    await page.screenshot({ path: path.join(out, 'role-map-layout.png') });
    report.checks.push({ name: 'graph-auto-layout-no-save', overlaps, portSize: port.width });
    assert.equal(report.errors.length, 0);
  } finally {
    fs.writeFileSync(path.join(out, 'editor-layout-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
