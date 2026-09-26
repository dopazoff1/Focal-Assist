const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:4200';
const out = path.resolve('.design-qa');
fs.mkdirSync(out, { recursive: true });

async function signIn(page) {
  await page.locator('#login-email').fill('test@test.com');
  await page.locator('#login-password').fill('1234');
  const start = Date.now();
  await page.locator('.login-btn').click();
  await page.waitForURL('**/v3/**');
  return Date.now() - start;
}

async function profile(page) {
  return page.evaluate(() => {
    const animations = document.getAnimations().filter(a => a.playState === 'running');
    return {
      canvases: document.querySelectorAll('canvas').length,
      elements: document.querySelectorAll('*').length,
      animations: animations.length,
      offscreen: animations.filter(a => {
        const r = a.effect?.target?.getBoundingClientRect();
        return r && (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth);
      }).length,
      canvas: [...document.querySelectorAll('canvas')].map(c => ({ active: c.dataset.animationActive, ready: c.dataset.ready, calls: c.dataset.drawCalls, width: c.width, height: c.height })),
    };
  });
}

async function inspectPixels(page, canvas) {
  const png = (await canvas.screenshot()).toString('base64');
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const sample = document.createElement('canvas');
    sample.width = 128;
    sample.height = 128;
    const ctx = sample.getContext('2d');
    ctx.drawImage(bitmap, bitmap.width * 0.1, bitmap.height * 0.2, bitmap.width * 0.8, bitmap.height * 0.5, 0, 0, 128, 128);
    const pixels = ctx.getImageData(0, 0, 128, 128).data;
    const colors = new Set();
    let min = 255, max = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
      const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }
    bitmap.close();
    return { colors: colors.size, luminanceRange: max - min };
  }, png);
}

async function inspectLoaderGate(page, root) {
  // Synthetic loader exercises dynamic registration without starting a real request.
  await page.locator(root).evaluate(el => {
    const loader = document.createElement('span');
    loader.className = 'spinner';
    loader.id = 'qa-visibility-loader';
    loader.style.cssText = 'position:fixed;top:-100px;left:300px;width:20px;height:20px;animation:focal-busy 900ms linear infinite';
    el.append(loader);
  });
  const loader = page.locator('#qa-visibility-loader');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#qa-visibility-loader')).animationPlayState === 'paused');
  await loader.evaluate(el => el.style.top = '150px');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#qa-visibility-loader')).animationPlayState === 'running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await loader.evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    document.querySelector('#qa-visibility-loader').remove();
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const result = { errors: [], samples: [], checks: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(20000);
    const cdp = await page.context().newCDPSession(page);
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    page.on('pageerror', e => result.errors.push(e.message));
    await page.goto(`${base}/login`);
    const canvas = page.locator('focal-login-scene canvas');
    await page.waitForFunction(() => document.querySelector('focal-login-scene canvas')?.dataset.ready === 'true');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, 'login-desktop.png') });
    const before = await canvas.screenshot();
    await page.mouse.move(1200, 120);
    await page.waitForTimeout(100);
    result.samples.push({ name: 'pointer-moving', ...await profile(page) });
    await page.waitForTimeout(1200);
    const after = await canvas.screenshot();
    assert(!before.equals(after), 'Scene should respond to pointer');
    await page.waitForFunction(() => document.querySelector('focal-login-scene canvas')?.dataset.animationActive === 'false');
    result.samples.push({ name: 'pointer-settled', ...await profile(page) });
    const pixels = await inspectPixels(page, canvas);
    assert(pixels.colors > 8 && pixels.luminanceRange > 20, 'Desktop scene must have visible rendered geometry');
    result.samples.push({ name: 'desktop-canvas-pixels', ...pixels });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(800, 300);
    await page.waitForTimeout(200);
    assert.equal(await canvas.getAttribute('data-animation-active'), 'false');
    result.samples.push({ name: 'reduced-motion', ...await profile(page) });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await inspectLoaderGate(page, '.auth-page');
    result.checks.push('login-loader-visibility-synthetic');

    // Real backend authentication, with no role or token replacement.
    result.loginMs = await signIn(page);
    assert(result.loginMs < 4500, 'No artificial five-second login hold');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('focal-login-scene').count(), 0);
    await inspectLoaderGate(page, '.v3-layout');
    result.checks.push('workspace-loader-visibility-synthetic');
    await page.screenshot({ path: path.join(out, 'home-desktop.png') });
    await page.locator('.v3-collapse').click();
    await page.screenshot({ path: path.join(out, 'home-collapsed.png') });
    assert(await page.locator('.v3-layout').evaluate(el => el.classList.contains('sidebar-collapsed')));
    await page.locator('.v3-collapse').click();
    await page.locator('.v3-avatar-btn').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, 'profile-dialog.png') });
    await page.locator('.v3-avatar-modal .close').focus();
    await page.keyboard.press('Shift+Tab');
    assert(await page.locator('.v3-avatar-modal').evaluate(el => el.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.v3-avatar-modal').count(), 0);
    assert(await page.locator('.v3-avatar-btn').evaluate(el => el === document.activeElement));
    result.checks.push('login', 'desktop-collapse', 'profile-focus-trap', 'escape-focus-return', 'pointer-depth', 'reduced-motion');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.v3-burger').click();
    await page.screenshot({ path: path.join(out, 'mobile-navigation.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, 'home-mobile.png') });
    result.checks.push('mobile-drawer');

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${base}/v3/calendar`);
    await page.locator('.orbit-range').waitFor();
    const initialRange = await page.locator('.orbit-range').textContent();
    await page.getByRole('button', { name: 'Next period', exact: true }).click();
    assert.notEqual(await page.locator('.orbit-range').textContent(), initialRange);
    await page.getByRole('button', { name: 'Previous period', exact: true }).click();
    assert.equal(await page.locator('.orbit-range').textContent(), initialRange);
    await page.locator('.orbit-view-switch button').filter({ hasText: /^\s*month\s*$/ }).click();
    const dateButton = page.locator('.orbit-month-cell:not(.outside) .orbit-day-select').first();
    await dateButton.focus();
    await page.keyboard.press('Enter');
    assert(await dateButton.evaluate(el => el.closest('.orbit-month-cell').classList.contains('selected')));
    assert.equal(await page.locator('button button').count(), 0);
    await page.screenshot({ path: path.join(out, 'calendar-desktop.png') });
    result.checks.push('calendar-period-navigation', 'calendar-keyboard-date-selection');

    await page.goto(`${base}/v3/settings`);
    const notifications = page.getByRole('switch', { name: 'Desktop notifications' });
    await notifications.waitFor();
    const enabled = await notifications.isChecked();
    await notifications.focus();
    await page.keyboard.press('Space');
    assert.equal(await notifications.isChecked(), !enabled);
    await page.keyboard.press('Space');
    assert.equal(await notifications.isChecked(), enabled);
    await page.screenshot({ path: path.join(out, 'settings-desktop.png') });
    result.checks.push('settings-keyboard-toggle-no-save');
    await page.goto(`${base}/v3/home`);
    for (let i = 0; i < 3; i++) {
      await page.locator('.v3-logout').click();
      await page.waitForURL('**/login');
      await page.waitForTimeout(500);
      result.samples.push({ name: `login-cycle-${i}`, ...await profile(page), forcedGcHeapBytes: await heap() });
      await signIn(page);
      await page.waitForTimeout(300);
      result.samples.push({ name: `workspace-cycle-${i}`, ...await profile(page), forcedGcHeapBytes: await heap() });
      assert.equal(await page.locator('focal-login-scene canvas').count(), 0);
    }
    const workspaceHeap = result.samples.filter(s => s.name.startsWith('workspace-cycle-')).map(s => s.forcedGcHeapBytes);
    assert(workspaceHeap[2] < workspaceHeap[0] + 3 * 1024 * 1024, 'Repeated sign-in should not accumulate large retained heaps');
    result.checks.push('bounded-retained-heap-three-cycles');
    await page.locator('.v3-logout').click();
    await page.waitForURL('**/login');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, 'login-mobile.png') });
    await page.waitForTimeout(400);
    assert.equal(await canvas.getAttribute('data-animation-active'), 'false');
    await page.locator('.auth-trust').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('focal-login-scene canvas')?.dataset.ready === 'true');
    await page.screenshot({ path: path.join(out, 'login-mobile-scene.png') });
    const mobilePixels = await inspectPixels(page, canvas);
    assert(mobilePixels.colors > 8 && mobilePixels.luminanceRange > 20, 'Mobile scene must have visible rendered geometry');
    result.samples.push({ name: 'mobile-canvas-pixels', ...mobilePixels });
    result.checks.push('offscreen-paused', 'route-cleanup');

    await canvas.evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForTimeout(250);
    assert.equal(await canvas.getAttribute('data-animation-active'), 'false');
    await page.locator('#login-email').fill('test@test.com');
    await page.locator('#login-password').fill('1234');
    assert(await page.locator('.login-btn').isEnabled());
    result.checks.push('webgl-context-loss-fallback');

    const disabled = await browser.newPage();
    await disabled.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
        if (/webgl/.test(kind)) return null;
        return original.call(this, kind, ...args);
      };
    });
    await disabled.goto(`${base}/login`);
    await disabled.locator('#login-email').fill('test@test.com');
    await disabled.locator('#login-password').fill('1234');
    assert(await disabled.locator('.login-btn').isEnabled());
    result.checks.push('webgl-disabled-fallback');
    await disabled.close();
    assert.equal(result.errors.length, 0);
  } finally {
    fs.writeFileSync(path.join(out, 'interaction-report.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
