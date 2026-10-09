const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
let browser;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file)); }
  catch (_) { res.writeHead(404); res.end(); }
});
(async () => {
  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
  catch (error) { if (process.env.PLAYWRIGHT_MODULE_PATH) throw error; playwright = require('C:/Users/zhiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { if (window.__failClipboard) throw new Error('Permission denied'); window.__copied.push(value); } } });
    document.execCommand = () => false;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (window.__failStorage && key === 'study-resource-favorites-v1') throw new Error('Quota exceeded'); return original.call(this, key, value); };
  });
  const now = new Date().toISOString();
  const title = '收藏测试Alpha <img src=x onerror=alert(1)>';
  const alpha = { title, url: 'https://pan.quark.cn/s/favorites-alpha', platform: 'quark', section: '公考类', code: 'a1b2', context: '真题与解析', createdAt: now };
  const beta = { title: '收藏测试Beta', url: 'https://pan.quark.cn/s/favorites-beta', platform: 'quark', section: '公考类', code: '', context: '没有提取码', createdAt: now };
  const pwd = { title: '收藏测试百度', url: 'https://pan.baidu.com/s/favorites-pwd?pwd=z9y8', platform: 'baidu', section: '公考类', code: '', context: '链接自带提取码', createdAt: now };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.pathname === '/api/pan-links') return route.fulfill({ json: { ok: true, items: [alpha, beta, pwd] } });
    if (url.pathname === '/api/shore-letter') return route.fulfill({ json: { ok: true, letter: { active: false } } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, items: [], hiddenUrls: [], ranking: [], linkCare: [] } });
    return route.fulfill({ body: '', contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function home(target = page) {
    await target.goto(origin);
    await target.waitForFunction(() => serverPanLinksLoaded);
    await target.addStyleTag({ content: '#shoreLetterModal {display:none !important;}' });
  }
  async function search(term) {
    await page.locator('#searchInput').fill(term);
    await page.locator('#searchInput').press('Enter');
  }
  await home();
  const entry = page.locator('[data-open-favorites]');
  const favoritesDialog = page.locator('.personal-favorites-dialog');
  await entry.click();
  assert.match(await favoritesDialog.innerText(), /还没有收藏/);
  await page.keyboard.press('Escape');
  assert.equal(await entry.evaluate(node => node === document.activeElement), true);
  await search('收藏测试Alpha');
  const card = page.locator('.pan-result-item').filter({ has: page.locator('h4', { hasText: '收藏测试Alpha' }) }).first();
  assert.equal(await card.locator('[data-resource-favorite]').getAttribute('aria-pressed'), 'false');
  await card.locator('[data-resource-share]').click();
  const expected = `资料名称：${title}\n网盘链接：${alpha.url}\n提取码：a1b2`;
  assert.equal(await page.evaluate(() => window.__copied.at(-1)), expected);
  await card.locator('[data-resource-favorite]').click();
  assert.equal(await page.locator('.personal-favorites-count').innerText(), '1');
  assert.equal(await card.locator('[data-resource-favorite]').getAttribute('aria-pressed'), 'true');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('study-resource-favorites-v1')));
  assert.equal(stored.length, 1); assert.equal(stored[0].title, title); assert.equal(stored[0].code, 'a1b2');
  await search('收藏测试Alpha');
  assert.equal(await card.locator('[data-resource-favorite]').getAttribute('aria-pressed'), 'true');
  await entry.click();
  assert.equal(await favoritesDialog.locator('h3').innerText(), title);
  assert.equal(await favoritesDialog.locator('h3 img').count(), 0);
  assert.equal(await favoritesDialog.locator('.personal-favorite-open').getAttribute('href'), alpha.url);
  await favoritesDialog.locator('[data-resource-share]').click();
  assert.equal(await page.evaluate(() => window.__copied.at(-1)), expected);
  await favoritesDialog.locator('input').fill('不存在的收藏');
  assert.match(await favoritesDialog.innerText(), /没有匹配的收藏/);
  await favoritesDialog.locator('input').fill('Alpha');
  assert.equal(await favoritesDialog.locator('.personal-favorite-card').count(), 1);
  await page.screenshot({ path: path.join(root, '.tmp-resource-favorites-desktop.png') });
  await page.keyboard.press('Escape');
  await home();
  assert.equal(await page.locator('.personal-favorites-count').innerText(), '1');
  await entry.click();
  assert.equal(await favoritesDialog.locator('.personal-favorite-card').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(root, '.tmp-resource-favorites-mobile.png') });
  await favoritesDialog.locator('[data-resource-favorite]').click();
  assert.match(await favoritesDialog.innerText(), /还没有收藏/);
  assert.equal(await page.locator('.personal-favorites-count').innerText(), '0');
  await page.keyboard.press('Escape');
  await page.evaluate(() => openSectionModal('civil'));
  const categoryCard = page.locator('.catalogue-resource-card').first();
  assert(await categoryCard.locator('[data-resource-favorite]').isVisible());
  await categoryCard.locator('[data-resource-share]').click();
  assert.match(await page.evaluate(() => window.__copied.at(-1)), /^资料名称：公考类资料大合集\n资料链接：https:\/\//);
  assert(!await page.evaluate(() => window.__copied.at(-1).includes('提取码：')));
  await categoryCard.locator('[data-resource-favorite]').click();
  await page.evaluate(() => closeSectionModal());
  await page.evaluate(() => openTodayUpdateModal());
  const todayCard = page.locator('.today-update-resource-card').filter({ has: page.locator('h3', { hasText: '收藏测试百度' }) });
  await todayCard.locator('[data-resource-share]').click();
  assert.match(await page.evaluate(() => window.__copied.at(-1)), /提取码：z9y8$/);
  await todayCard.locator('[data-resource-favorite]').click();
  await page.evaluate(() => window.__failClipboard = true);
  await todayCard.locator('[data-resource-share]').click();
  const manual = page.locator('.personal-share-dialog');
  assert(await manual.isVisible());
  assert.match(await manual.locator('textarea').inputValue(), /提取码：z9y8$/);
  await page.screenshot({ path: path.join(root, '.tmp-resource-share-fallback-mobile.png') });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__failClipboard = false; closeSectionModal(); });
  await search('收藏测试Beta');
  const betaCard = page.locator('.pan-result-item').filter({ has: page.locator('h4', { hasText: '收藏测试Beta' }) }).first();
  await betaCard.locator('[data-resource-share]').click();
  assert.equal(await page.evaluate(() => window.__copied.at(-1)), `资料名称：${beta.title}\n网盘链接：${beta.url}`);
  const before = await page.locator('.personal-favorites-count').innerText();
  await page.evaluate(() => window.__failStorage = true);
  await betaCard.locator('[data-resource-favorite]').click();
  assert.equal(await betaCard.locator('[data-resource-favorite]').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.personal-favorites-count').innerText(), before);
  assert.match(await page.locator('.personal-resource-toast').innerText(), /未能保存/);
  await page.evaluate(() => window.__failStorage = false);
  const otherPage = await context.newPage();
  await home(otherPage);
  assert.equal(await otherPage.locator('.personal-favorites-count').innerText(), before);
  await betaCard.locator('[data-resource-favorite]').click();
  await otherPage.waitForFunction(count => document.querySelector('.personal-favorites-count').textContent === count, String(Number(before) + 1));
  await entry.click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => document.body.classList.remove('theme-light'));
  await page.screenshot({ path: path.join(root, '.tmp-resource-favorites-dark-mobile.png') });
  assert.deepEqual(errors, []);
  console.log('PASS: search/category/today actions, exact share text with/without code, URL code extraction, safe favorite titles, reload persistence, removal/filtering, empty state, clipboard/storage failures, cross-tab sync, keyboard focus and mobile/light/dark layout.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
});
