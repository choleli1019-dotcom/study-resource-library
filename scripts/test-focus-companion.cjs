const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const release = path.join(root, '.tmp-focus-study-release');
fs.mkdirSync(release, { recursive: true });
const stateKey = 'study-squirrel-focus-v1', logKey = 'study-squirrel-focus-log-v2', oldLogKey = 'study-squirrel-focus-log-v1';
const base = Date.UTC(2026, 9, 9, 1, 0);
let browser;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'text/html'); res.end(fs.readFileSync(file)); }
  catch (_) { res.writeHead(404); res.end(); }
});
(async () => {
  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
  catch (error) { if (process.env.PLAYWRIGHT_MODULE_PATH) throw error; playwright = require('C:/Users/zhiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
  async function create(now = base, seeds = {}) {
    const context = await browser.newContext({ viewport: { width: 1705, height: 1347 }, acceptDownloads: true });
    await context.addInitScript(({ now, seeds }) => {
      const RealDate = Date;
      // Persist the test clock across reloads; no real timer waits or OS clock edits.
      window.__now = Number(sessionStorage.getItem('__focusTestNow')) || now;
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [window.__now])); } static now() { return window.__now; } };
      window.__advance = ms => { window.__now += ms; sessionStorage.setItem('__focusTestNow', String(window.__now)); window.dispatchEvent(new Event('pageshow')); };
      if (!sessionStorage.getItem('__focusSeeded')) {
        for (const [key, value] of Object.entries(seeds)) localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem('__focusSeeded', 'yes');
      }
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (window.__failStorage && key.startsWith('study-squirrel-focus')) throw new Error('Quota exceeded'); return original.call(this, key, value); };
    }, { now, seeds });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.pathname === '/api/focus-presence') return route.fulfill({ json: { ok: true, focusCount: 1 } });
      if (url.pathname === '/api/shore-letter') return route.fulfill({ json: { ok: true, letter: { active: false } } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, items: [], hiddenUrls: [], ranking: [], linkCare: [] } });
      return route.fulfill({ body: '', contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript' });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.addStyleTag({ content: '#shoreLetterModal {display:none!important;}' });
    await page.waitForFunction(() => typeof window.exportSquirrelStudyCard === 'function');
    const advance = ms => page.evaluate(ms => window.__advance(ms), ms);
    const primary = page.locator('#focusPrimary');
    const subject = page.locator('#focusSubject');
    const end = page.locator('#focusEnd');
    const today = page.locator('#focusToday');
    const details = page.locator('#focusTodayDetails');
    return { page, context, errors, advance, primary, subject, end, today, details };
  }
  const t = await create();
  assert.deepEqual(await t.subject.locator('option:not([hidden]):not([value=""])').allTextContents(), ['言语理解', '资料分析', '数量关系', '逻辑判断', '申论小作文', '申论大作文', '常识政治', '早自习']);
  await t.primary.click();
  assert.equal(await t.subject.evaluate(e => e === document.activeElement), true);
  assert.equal(await t.page.locator('#focusCompanion').getAttribute('data-phase'), 'idle');
  for (const [subject, minutes] of Object.entries({ '言语理解': 25, '资料分析': 45, '数量关系': 45, '逻辑判断': 25, '申论小作文': 45, '申论大作文': 60, '常识政治': 25, '早自习': 25 })) {
    await t.subject.selectOption(subject);
    assert.equal(await t.page.locator('#focusTimer').innerText(), `${minutes}:00`);
  }
  const emptyDownloadPromise = t.page.waitForEvent('download');
  await t.page.locator('#focusExport').click();
  const emptyDownload = await emptyDownloadPromise;
  assert.equal(emptyDownload.suggestedFilename(), '小松鼠陪学-2026-10-09.png');
  const preview = t.page.locator('.squirrel-study-card-dialog');
  assert.match(await preview.locator('img').getAttribute('alt'), /累计专注 0 分钟/);
  await t.page.keyboard.press('Escape');
  assert.equal(await t.page.locator('#focusExport').evaluate(e => e === document.activeElement), true);

  await t.subject.selectOption('言语理解');
  assert.equal(await t.page.locator('#focusTimer').innerText(), '25:00');
  await t.primary.click(); await t.advance(5 * 60000);
  assert.equal(await t.page.locator('#focusTimer').innerText(), '20:00');
  assert.equal(await t.subject.isDisabled(), true);
  assert.equal(await t.page.locator('[data-focus-minutes="60"]').isDisabled(), true);
  assert.match(await t.today.innerText(), /5 分钟/);
  await t.primary.click(); await t.advance(10 * 60000);
  assert.match(await t.today.innerText(), /5 分钟/); // pause excluded
  await t.page.reload();
  assert.equal(await t.primary.innerText(), '继续专注');
  assert.match(await t.details.innerText(), /言语理解 5 分钟/);
  await t.primary.click(); await t.advance(2 * 60000); await t.end.click();
  assert.match(await t.details.innerText(), /言语理解 7 分钟/);
  assert.match(await t.today.innerText(), /完成 0 轮/); // partial session retained, not completed
  let logs = await t.page.evaluate(key => JSON.parse(localStorage.getItem(key)), logKey);
  assert.equal(logs.length, 1); assert.equal(logs[0].segments.length, 2);
  assert.equal(logs[0].segments.reduce((sum, s) => sum + s[1] - s[0], 0), 7 * 60000);

  await t.subject.selectOption('资料分析');
  assert.equal(await t.page.locator('#focusTimer').innerText(), '45:00');
  await t.page.locator('[data-focus-minutes="25"]').click();
  await t.primary.click(); await t.advance(25 * 60000);
  assert.equal(await t.page.locator('#focusCompanion').getAttribute('data-phase'), 'break');
  assert.match(await t.today.innerText(), /32 分钟.*完成 1 轮/);
  await t.advance(4 * 60000);
  assert.match(await t.today.innerText(), /32 分钟/); // break excluded
  await t.primary.click(); await t.advance(2 * 60000); await t.primary.click(); await t.advance(60000);
  assert.equal(await t.primary.innerText(), '再学一轮');
  await t.advance(15 * 60000); await t.page.reload();
  assert.match(await t.today.innerText(), /32 分钟.*完成 1 轮/); // no repeated credit
  await t.subject.selectOption('申论大作文');
  assert.equal(await t.page.locator('#focusTimer').innerText(), '60:00');
  await t.primary.click(); await t.advance(90 * 1000);
  const downloadPromise = t.page.waitForEvent('download');
  await t.page.locator('#focusExport').click();
  const download = await downloadPromise;
  await download.saveAs(path.join(release, 'study-card-test.png'));
  assert.match(await preview.locator('img').getAttribute('alt'), /累计专注 33 分钟 30 秒/);
  assert.match(await preview.locator('img').getAttribute('alt'), /申论大作文 1 分钟 30 秒/);
  assert.match(await preview.locator('[role="status"]').innerText(), /长按图片保存/);
  const png = fs.readFileSync(path.join(release, 'study-card-test.png'));
  assert.equal(png.readUInt32BE(16), 1080); assert.ok(png.readUInt32BE(20) >= 1000);
  assert.equal(await preview.locator('img').evaluate(e => e.complete && e.naturalWidth === 1080), true);
  await t.page.screenshot({ path: path.join(release, 'preview-desktop.png') });
  await t.page.keyboard.press('Escape');
  await t.page.locator('#focusCompanion').screenshot({ path: path.join(release, 'companion-desktop.png') });
  await t.page.setViewportSize({ width: 390, height: 844 });
  await t.page.locator('#focusCompanion').scrollIntoViewIfNeeded();
  assert.equal(await t.page.locator('#focusCompanion').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
  await t.page.locator('#focusCompanion').screenshot({ path: path.join(release, 'companion-mobile.png') });
  const mobileDownloadPromise = t.page.waitForEvent('download');
  await t.page.locator('#focusExport').click(); await mobileDownloadPromise;
  assert.equal(await preview.evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
  await t.page.screenshot({ path: path.join(release, 'preview-mobile.png') });
  await t.page.keyboard.press('Escape');
  await t.page.evaluate(() => document.body.classList.remove('theme-light'));
  await t.page.locator('#focusCompanion').screenshot({ path: path.join(release, 'companion-mobile-dark.png') });
  await t.page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await t.page.locator('#focusCompanion').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
  await t.page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await t.page.locator('#focusCompanion').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
  // A second tab observes the same timer and session log, without double counting.
  const second = await t.context.newPage(); await second.goto(origin);
  const current = await t.page.evaluate(() => window.__now);
  await second.evaluate(now => { window.__now = now; window.dispatchEvent(new Event('pageshow')); }, current);
  assert.match(await second.locator('#focusToday').innerText(), /33 分钟 30 秒.*完成 1 轮/);
  await t.end.click();
  await second.waitForFunction(() => document.querySelector('#focusCompanion').dataset.phase === 'idle');
  assert.match(await second.locator('#focusToday').innerText(), /33 分钟 30 秒.*完成 1 轮/);
  await second.close();
  const allDownloadPromise = t.page.waitForEvent('download');
  await t.page.evaluate(() => {
    const names = ['言语理解', '资料分析', '数量关系', '逻辑判断', '申论小作文', '申论大作文', '常识政治', '早自习', '未分类专注'];
    const items = names.map((subject, index) => ({ subject, ms: (25 + index * 5) * 60000 }));
    return window.exportSquirrelStudyCard({ date: '2026-10-09', generatedAt: window.__now, completed: 9, items, totalMs: items.reduce((sum, item) => sum + item.ms, 0), active: false });
  });
  const allDownload = await allDownloadPromise;
  await allDownload.saveAs(path.join(release, 'study-card-all-subjects.png'));
  assert.match(await preview.locator('img').getAttribute('alt'), /早自习/);
  await t.page.keyboard.press('Escape');
  assert.deepEqual(t.errors, []);

  const midnight = await create(Date.UTC(2026, 9, 9, 15, 50)); // 23:50 Beijing
  await midnight.subject.selectOption('早自习'); await midnight.primary.click(); await midnight.advance(15 * 60000);
  assert.match(await midnight.today.innerText(), /5 分钟/); // split at midnight
  await midnight.advance(10 * 60000);
  assert.match(await midnight.today.innerText(), /15 分钟.*完成 1 轮/);
  await midnight.page.reload(); assert.match(await midnight.today.innerText(), /15 分钟.*完成 1 轮/);
  assert.deepEqual(midnight.errors, []);

  const old = await create(base, {
    [stateKey]: { version: 1, phase: 'focus', status: 'running', focusMinutes: 60, breakMinutes: 10, remainingMs: 60 * 60000, endAt: base + 58 * 60000, id: 'legacy-running' },
    [oldLogKey]: [{ id: 'old-complete', day: '2026-10-09', minutes: 45 }]
  });
  assert.equal(await old.page.locator('#focusTimer').innerText(), '58:00');
  assert.match(await old.details.innerText(), /未分类专注 47 分钟/);
  await old.end.click(); await old.page.reload();
  assert.match(await old.details.innerText(), /未分类专注 47 分钟/);
  assert.match(await old.today.innerText(), /完成 1 轮/);
  assert.deepEqual(old.errors, []);

  const unavailable = await create();
  await unavailable.page.evaluate(() => window.__failStorage = true);
  await unavailable.subject.selectOption('常识政治'); await unavailable.primary.click(); await unavailable.advance(2 * 60000); await unavailable.end.click();
  assert.match(await unavailable.today.innerText(), /2 分钟/);
  assert.match(await unavailable.page.locator('#focusHint').innerText(), /无法保存记录/);
  assert.deepEqual(unavailable.errors, []);
  for (const test of [t, midnight, old, unavailable]) await test.context.close();
  console.log('PASS: all 8 subjects, timing choices, pause/resume/reload, partial sessions, break exclusion, midnight allocation, legacy records, PNG content/download and desktop/mobile layouts.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
