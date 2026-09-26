const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { login, applyUser, inspect } = require('../.hallmark/verify-v3-routes.cjs');
const base = process.env.BASE_URL || 'http://localhost:4200';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    const user = await login(page);
    await applyUser(page, user);
    for (const [width, height] of [[390,844],[768,1024],[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/v3/adherence-dashboard`);
      await page.locator('.adherence-page .error').waitFor();
      const heading = await page.locator('.adherence-hero').boundingBox();
      const error = await page.locator('.adherence-page .error').boundingBox();
      const result = await inspect(page);
      assert(heading.y < 150, 'Header must stay at the top of the workspace');
      assert(error.height < 100, 'Error notice must not stretch into a panel');
      assert(!result.horizontalOverflow && result.mainVisible);
      if (width === 1366 || width === 390) await page.screenshot({ path: `.design-qa/adherence-${width}.png` });
      results.push({ width, height, headerTop: heading.y, noticeHeight: error.height });
    }
  } finally {
    fs.writeFileSync('.design-qa/adherence-layout-report.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
