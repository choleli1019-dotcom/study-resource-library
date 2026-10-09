const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'study-checkins-'));
const moduleData = path.join(temporary, 'module'), apiData = path.join(temporary, 'api');
fs.mkdirSync(moduleData); fs.mkdirSync(apiData);
const release = path.join(root, '.tmp-study-checkins-release'); fs.mkdirSync(release, { recursive: true });
const createCheckins = require('../server/study-checkins');
let backend, browser, staticServer;
async function freePort() { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
(async () => {
  let now = Date.UTC(2026, 9, 9, 15, 58);
  const store = createCheckins(moduleData, () => now);
  const key = 'a'.repeat(64), secondKey = 'b'.repeat(64);
  const initial = { key, day: '2026-10-09', message: '<img src=x onerror=alert(1)> 今天完成资料分析', subjects: ['资料分析'], focusSeconds: 1500, completedRounds: 1 };
  assert.equal(store.snapshot().count, 0);
  assert.throws(() => store.submit({ ...initial, completedRounds: 0 }, 'same-ip'), /完成/);
  assert.throws(() => store.submit({ ...initial, message: '字'.repeat(81) }, 'same-ip'), /80/);
  assert.throws(() => store.submit({ ...initial, day: '2026-10-08' }, 'same-ip'), /日期/);
  assert.throws(() => store.submit({ ...initial, subjects: ['未知科目'] }, 'same-ip'), /内容/);
  assert.throws(() => store.submit({ ...initial, key: 'wrong' }, 'same-ip'), /凭证/);
  const result = store.submit(initial, 'same-ip'); assert.equal(result.count, 1); assert.equal(result.duplicate, false);
  assert.equal(store.submit(initial, 'same-ip').count, 1); // idempotent retry
  assert.throws(() => store.submit({ ...initial, message: '更新内容' }, 'same-ip'), error => error.status === 429);
  now += 31000;
  assert.equal(store.submit({ ...initial, message: '更新内容' }, 'same-ip').count, 1);
  assert.equal(store.submit({ ...initial, key: secondKey, message: '同一网络的另一个伙伴' }, 'same-ip').count, 2);
  assert.equal(store.mine('c'.repeat(64)).item, null);
  assert.equal(store.mine(key).item.message, '更新内容');
  assert.deepEqual(Object.keys(store.snapshot().items[0]).sort(), ['message', 'subjects', 'focusSeconds', 'completedRounds', 'createdAt', 'updatedAt'].sort());
  const stored = JSON.parse(fs.readFileSync(path.join(moduleData, 'study-checkins.json'), 'utf8'));
  assert(!JSON.stringify(stored).includes(key)); assert(!JSON.stringify(stored).includes('same-ip'));
  const id = stored.find(item => item.message === '更新内容').id;
  store.moderate(id, 'hide'); assert.equal(store.snapshot().count, 1);
  assert.throws(() => store.submit(initial, 'same-ip'), error => error.status === 403);
  store.moderate(id, 'restore'); assert.equal(store.snapshot().count, 2);
  now += 3 * 60000; assert.equal(store.snapshot().day, '2026-10-10'); assert.equal(store.snapshot().count, 0);
  assert.equal(store.submit({ ...initial, day: '2026-10-10' }, 'same-ip').count, 1);
  assert.equal(store.snapshot(Date.UTC(2026, 9, 9, 15, 59)).count, 2);

  const port = await freePort(), api = 'http://127.0.0.1:' + port, token = 'isolated-checkin-test-token';
  backend = spawn(process.execPath, [path.join(root, 'server/analytics-server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: apiData, ADMIN_TOKEN: token, GITHUB_TOKEN: '', LINK_HEALTH_AUTOCHECK: 'false' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Backend startup timeout')), 10000); backend.stdout.on('data', chunk => { if (String(chunk).includes('listening')) { clearTimeout(timeout); resolve(); } }); backend.once('error', reject); });
  const get = () => fetch(api + '/api/study-checkins');
  const post = (body, headers = {}) => fetch(api + '/api/study-checkins', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const response = await get(), today = (await response.json()).day;
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = { ...initial, day: today };
  assert.equal((await post(body, { Origin: 'https://unknown.invalid' })).status, 403);
  assert.equal((await post({ ...body, completedRounds: 0 })).status, 400);
  assert.equal((await post(body, { Origin: 'https://study.202510319.xyz' })).status, 201);
  assert.equal((await post(body)).status, 200);
  const publicData = await (await get()).json(); assert.equal(publicData.count, 1); assert(!JSON.stringify(publicData).includes('ownerHash'));
  const dataFile = path.join(apiData, 'study-checkins.json');
  const httpId = JSON.parse(fs.readFileSync(dataFile, 'utf8'))[0].id;
  const moderate = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id: httpId, action: 'hide' }), redirect: 'manual' };
  assert.equal((await fetch(api + '/admin/study-checkins/moderate', moderate)).status, 403);
  assert.equal((await fetch(api + '/admin/study-checkins/moderate?token=' + token, { ...moderate, headers: { ...moderate.headers, Origin: 'https://unknown.invalid' } })).status, 403);
  assert.equal((await fetch(api + '/admin/study-checkins/moderate?token=' + token, moderate)).status, 303);
  assert.equal((await (await get()).json()).count, 0);
  assert.equal((await post(body)).status, 403);
  const adminHtml = await (await fetch(api + '/admin?token=' + token)).text();
  assert(adminHtml.includes('id="study-checkins"')); assert(adminHtml.includes('&lt;img src=x onerror=alert(1)&gt;'));
  fs.writeFileSync(dataFile, '[]'); // Only this test's isolated database.

  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
  catch (error) { if (process.env.PLAYWRIGHT_MODULE_PATH) throw error; playwright = require('C:/Users/zhiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  staticServer = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); res.end(fs.readFileSync(file)); } catch (_) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + staticServer.address().port;
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1705, height: 1347 } });
  await context.addInitScript(({ base }) => {
    const RealDate = Date; window.__now = Number(sessionStorage.getItem('__testNow')) || base;
    window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [window.__now])); } static now() { return window.__now; } };
    window.__advance = ms => { window.__now += ms; sessionStorage.setItem('__testNow', String(window.__now)); window.dispatchEvent(new Event('pageshow')); };
  }, { base: Date.parse(today + 'T09:00:00+08:00') });
  let loseResponse = false;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.pathname.startsWith('/api/study-checkins')) {
      const response = await fetch(api + url.pathname, { method: route.request().method(), ...(route.request().method() === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: route.request().postData() } : {}) });
      if (loseResponse && url.pathname === '/api/study-checkins' && route.request().method() === 'POST') { loseResponse = false; return route.abort('failed'); }
      return route.fulfill({ status: response.status, body: await response.text(), contentType: 'application/json' });
    }
    if (url.pathname === '/api/shore-letter') return route.fulfill({ json: { ok: true, letter: { active: false } } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, focusCount: 0, items: [], hiddenUrls: [], ranking: [], linkCare: [] } });
    return route.fulfill({ body: '', contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript' });
  });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await page.addStyleTag({ content: '#shoreLetterModal {display:none!important;}' });
  await page.waitForFunction(() => /今日 0 位/.test(document.querySelector('#studyCheckinCount').textContent));
  await page.locator('#studyCheckinOpen').click();
  const dialog = page.locator('.study-checkin-dialog');
  assert.equal(await dialog.locator('form').isVisible(), false);
  assert.match(await dialog.locator('.checkin-summary').innerText(), /至少一轮/);
  await dialog.locator('[data-checkin-start]').click();
  assert.equal(await page.locator('#focusCompanion').getAttribute('data-phase'), 'idle');
  await page.locator('#focusSubject').selectOption('资料分析'); await page.locator('[data-focus-minutes="25"]').click(); await page.locator('#focusPrimary').click();
  await page.evaluate(() => window.__advance(25 * 60000));
  assert.equal((await (await get()).json()).count, 0, 'A completed round must not automatically post a check-in');
  await page.locator('#studyCheckinOpen').click();
  assert.equal(await dialog.locator('form').isVisible(), true);
  const message = '做完资料分析，继续努力 <img src=x onerror=alert(1)>';
  await dialog.locator('textarea').fill(message);
  loseResponse = true; await dialog.locator('.checkin-submit').click();
  await page.waitForFunction(() => /连接失败/.test(document.querySelector('.study-checkin-dialog [role="status"]').textContent));
  assert.equal(await dialog.locator('textarea').inputValue(), message);
  assert.equal((await (await get()).json()).count, 1);
  await dialog.locator('.checkin-submit').click();
  await page.waitForFunction(() => /已更新/.test(document.querySelector('.study-checkin-dialog [role="status"]').textContent));
  assert.equal((await (await get()).json()).count, 1);
  assert.equal(await dialog.locator('.checkin-entry p').innerText(), message);
  assert.equal(await dialog.locator('.checkin-entry img').count(), 0);
  assert.equal(await page.locator('#studyCheckinOpen').innerText(), '今日已打卡');
  await page.screenshot({ path: path.join(release, 'dialog-desktop.png') });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#studyCheckinOpen') === document.activeElement);
  await page.locator('#focusEnd').click();
  await page.locator('#studyCheckinBar').screenshot({ path: path.join(release, 'bar-desktop.png') });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#studyCheckinOpen').textContent === '今日已打卡');
  await page.locator('#studyCheckinOpen').click();
  assert.equal(await dialog.locator('textarea').inputValue(), message);
  const updateItems = JSON.parse(fs.readFileSync(dataFile, 'utf8')); updateItems[0].updatedAt = new Date(Date.now() - 31000).toISOString(); fs.writeFileSync(dataFile, JSON.stringify(updateItems));
  await dialog.locator('textarea').fill('今天学完一组资料分析，错题也订正了。'); await dialog.locator('.checkin-submit').click();
  await page.waitForFunction(() => /已更新/.test(document.querySelector('.study-checkin-dialog [role="status"]').textContent));
  assert.equal((await (await get()).json()).count, 1);
  await page.keyboard.press('Escape');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.locator('#studyCheckinBar').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
    await page.locator('#studyCheckinView').click();
    assert.equal(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
    await page.screenshot({ path: path.join(release, `dialog-mobile-${width}.png`) });
    await page.keyboard.press('Escape');
  }
  await page.locator('#studyCheckinBar').screenshot({ path: path.join(release, 'bar-mobile.png') });
  await page.evaluate(() => document.body.classList.remove('theme-light'));
  await page.locator('#studyCheckinBar').screenshot({ path: path.join(release, 'bar-mobile-dark.png') });
  await page.setViewportSize({ width: 1705, height: 1347 });
  await page.screenshot({ path: path.join(release, 'homepage-desktop.png'), fullPage: false });
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS: voluntary eligibility, daily deduplication/update, retry after lost response, shared-network identities, Beijing midnight, safe public fields/text, moderation/auth/origin, browser reload, real backend integration and desktop/mobile layouts.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (backend) backend.kill(); if (staticServer) staticServer.close(); });
