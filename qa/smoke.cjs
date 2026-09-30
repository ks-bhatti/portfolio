/* Run with node qa/smoke.cjs. Uses the bundled Playwright runtime, no install step. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/kamra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const out = __dirname;
const results = [];
const errors = [];
const browserMessages = [];
let browser;

async function check(name, action) {
  try { const detail = await action(); results.push({ name, pass: true, detail }); console.log(`PASS ${name}${detail ? ': ' + JSON.stringify(detail) : ''}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
function watch(page, label) {
  page.on('pageerror', error => errors.push({ label, kind: 'pageerror', text: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') errors.push({ label, kind: 'console', text: message.text() });
    if (message.type() === 'warning') browserMessages.push({ label, text: message.text() });
  });
  page.on('response', response => { if (response.status() >= 400) errors.push({ label, kind: 'http', status: response.status(), url: response.url() }); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push({ label, kind: 'requestfailed', url: request.url(), text: request.failure()?.errorText }); });
}
async function open(options = {}, label = 'page', init) {
  const context = await browser.newContext(options);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  watch(page, label);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { page, context };
}
async function revealAll(page) {
  await page.evaluate(async () => {
    const prior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { window.scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 55)); }
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = prior;
  });
  await page.waitForTimeout(650);
}
async function photoVisible(page) {
  return page.locator('.portrait-fallback').evaluate(el => {
    const style = getComputedStyle(el); const img = el.querySelector('img');
    return style.display !== 'none' && style.visibility !== 'hidden' && +style.opacity > 0 && img.complete && img.naturalWidth > 0;
  });
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const desktop = await open({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 3 }, 'desktop');
  const page = desktop.page;
  await check('WebGL renders, advances frames, and caps DPR at 2', async () => {
    await page.waitForFunction(() => window.portfolioScene?.status === 'ready');
    const before = await page.evaluate(() => window.portfolioScene.frames);
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => { const c = document.querySelector('canvas.hero-webgl'); return { ...window.portfolioScene, dpr: c.width / c.clientWidth }; });
    assert(metrics.running && metrics.frames > before);
    assert(metrics.dpr <= 2.005, `DPR was ${metrics.dpr}`);
    return metrics;
  });
  await check('Scene pauses offscreen and resumes when visible', async () => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.portfolioScene && !window.portfolioScene.running);
    const before = await page.evaluate(() => window.portfolioScene.frames);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.portfolioScene.frames), before);
    await page.locator('#hero-scene').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.portfolioScene.running);
  });
  await check('Visibility change pauses and resumes rendering', async () => {
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const before = await page.evaluate(() => window.portfolioScene.frames);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.portfolioScene.frames), before);
    assert.equal(await page.evaluate(() => window.portfolioScene.running), false);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => window.portfolioScene.running);
  });
  await check('Theme toggles and persists after reload', async () => {
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.locator('.theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.waitForFunction(() => window.portfolioScene.status === 'ready');
    await revealAll(page);
    await page.screenshot({ path: path.join(out, 'dark.png'), fullPage: true, scale: 'css' });
    await page.locator('.theme-toggle').click();
  });
  const projects = { bis: ['BIS Connect', '250+', 'August 2026'], virtuo: ['VirtuoMate', '18 of 18', '11 modules'], metro: ['MetroGo', 'QR ticketing'], commerce: ['E-Commerce Platform', 'Inventory'], cloud: ['Cloud Cost Anomaly Detection', '91%'], medialert: ['MediAlert', 'Cognito'] };
  for (const [key, content] of Object.entries(projects)) {
    await check(`Project ${key}: keyboard open, content, focus containment, Escape and button close`, async () => {
      const opener = page.locator(`.project-detail-link[data-open-project="${key}"]`);
      await opener.scrollIntoViewIfNeeded(); await opener.focus(); await page.keyboard.press('Enter');
      const dialog = page.locator('#project-dialog');
      assert.equal(await dialog.evaluate(el => el.open), true);
      assert.equal(await page.locator('#dialog-title').textContent(), content[0]);
      const text = await dialog.textContent();
      for (const fragment of content.slice(1)) assert(text.includes(fragment), `Missing ${fragment}`);
      assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Focus did not move into dialog');
      for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); assert(await dialog.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body), 'Focus escaped modal'); }
      const mail = await dialog.locator('a[href^="mailto:"]').getAttribute('href');
      assert.equal(new URL(mail).pathname, 'kamransaleem384@gmail.com');
      assert(decodeURIComponent(mail).includes(content[0]));
      await page.keyboard.press('Escape');
      assert.equal(await dialog.evaluate(el => el.open), false);
      await page.waitForFunction(selector => document.activeElement?.matches(selector), `.project-detail-link[data-open-project="${key}"]`);
      await opener.click(); await page.locator('.dialog-close').click();
      assert.equal(await dialog.evaluate(el => el.open), false);
      await page.waitForFunction(selector => document.activeElement?.matches(selector), `.project-detail-link[data-open-project="${key}"]`);
    });
  }
  await check('Links have valid section targets, email recipients and secure external attributes', async () => {
    const issues = await page.locator('a').evaluateAll(links => links.flatMap(link => {
      const href = link.getAttribute('href');
      if (!href) return ['Empty href'];
      if (href.startsWith('#') && !document.getElementById(href.slice(1))) return [`Missing section ${href}`];
      if (href.startsWith('http') && (link.target !== '_blank' || !link.rel.includes('noopener') || !link.rel.includes('noreferrer'))) return [`Unsafe external link ${href}`];
      if (href.startsWith('mailto:') && new URL(href).pathname !== 'kamransaleem384@gmail.com') return [`Unexpected recipient ${href}`];
      return [];
    }));
    assert.deepEqual(issues, []);
    assert.equal(await page.locator('.cv-link span').textContent(), 'Request CV');
    assert(await page.locator('#cv-note').textContent().then(text => text.includes('not been added')));
    assert.equal(await page.locator('body').textContent().then(text => text.includes('\u2014')), false, 'Content includes em dash');
  });
  await revealAll(page);
  await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true, scale: 'css' });
  await desktop.context.close();

  for (const width of [320, 375, 390, 768, 1440]) {
    const { page, context } = await open({ viewport: { width, height: 900 }, isMobile: width < 651, hasTouch: width < 651 }, `width-${width}`);
    await check(`Responsive layout ${width}px, no horizontal overflow`, async () => {
      await revealAll(page);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert(dimensions.document <= width + 1 && dimensions.body <= width + 1, JSON.stringify(dimensions));
      return dimensions;
    });
    if (width < 651) await check(`Mobile navigation ${width}px opens, follows links, closes and supports Escape`, async () => {
      const toggle = page.locator('.menu-toggle');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert(await page.locator('#mobile-nav').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert(await toggle.evaluate(el => el === document.activeElement));
      await toggle.click(); await page.locator('#mobile-nav a[href="#contact"]').click();
      await page.waitForFunction(() => location.hash === '#contact');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#mobile-nav').isVisible(), false);
    });
    if (width === 390) { await revealAll(page); await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true, scale: 'css' }); }
    await context.close();
  }
  await check('Reduced motion shows photo without loading Three.js or canvas', async () => {
    const { page, context } = await open({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' }, 'reduced-motion');
    assert.equal(await page.evaluate(() => window.portfolioScene.status), 'static');
    assert.equal(await page.locator('canvas.hero-webgl').count(), 0);
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('three.module'))), false);
    assert(await photoVisible(page));
    await revealAll(page);
    assert.equal(await page.locator('.reveal-pending:not(.is-visible)').count(), 0);
    await context.close();
  });
  await check('WebGL unavailable leaves photo visible and supports CSS tilt', async () => {
    const { page, context } = await open({ viewport: { width: 1440, height: 1000 } }, 'webgl-disabled', () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return String(type).includes('webgl') ? null : getContext.call(this, type, ...args); };
    });
    await page.waitForFunction(() => window.portfolioScene.status === 'fallback');
    assert(await photoVisible(page));
    const box = await page.locator('#hero-scene').boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3);
    assert(await page.locator('.portrait-fallback').evaluate(el => el.style.transform.includes('rotateY')));
    await context.close();
  });
  await check('No page exceptions, failed asset requests or console errors', async () => { assert.deepEqual(errors, []); });
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, results, errors, browserMessages }, null, 2));
  console.log(`${results.filter(item => item.pass).length}/${results.length} checks passed. Results: ${path.join(out, 'results.json')}`);
  process.exitCode = results.some(item => !item.pass) ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
