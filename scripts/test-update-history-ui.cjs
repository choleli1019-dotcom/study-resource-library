const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { appendBatch, publicBatches } = require('../server/update-batches');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp-update-history-release');
fs.mkdirSync(output, { recursive: true });
const data = { updateBatches: [] };
appendBatch(data, 'baidu', [{ title: '上一批资料', url: 'https://pan.baidu.com/s/previous?pwd=prev' }], { publishedAt: '2026-10-26T08:00:00Z' });
appendBatch(data, 'baidu', Array.from({ length: 229 }, (_, i) => ({ title: i === 0 ? '资料 <img src=x onerror=alert(1)>' : `资料课程 ${i + 1}`, url: `https://pan.baidu.com/s/course-${i + 1}?pwd=abcd`, code: 'abcd' })), { publishedAt: '2026-10-27T08:00:00Z' });
appendBatch(data, 'quark', [{ title: '夸克资料', url: 'https://pan.quark.cn/s/quark-alpha' }], { publishedAt: '2026-10-27T09:00:00Z' });
let records = publicBatches(data), apiFailure = false, baiduDelay = 0, browser;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); res.end(fs.readFileSync(file)); }
  catch (_) { res.writeHead(404); res.end(); }
});
(async () => {
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zhiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/EdgeCore/155.0.4283.62/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.addInitScript(() => {
    window.__copiedHistory = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { if (window.__clipboardFail) throw Error('denied'); window.__copiedHistory.push(text); } } });
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/update-batches') {
      const platform = url.searchParams.get('platform'), id = url.searchParams.get('id');
      if (platform === 'baidu' && baiduDelay) await new Promise(resolve => setTimeout(resolve, baiduDelay));
      if (apiFailure) return route.fulfill({ status: 503, json: { ok: false } });
      const batches = records.filter(row => row.platform === platform);
      return route.fulfill({ json: id ? { ok: true, batch: batches.find(row => row.id === id) } : { ok: true, batches: batches.map(({ entries, ...meta }) => meta) } });
    }
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.pathname === '/api/shore-letter') return route.fulfill({ json: { ok: true, letter: { active: false } } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, items: [], hiddenUrls: [], ranking: [], linkCare: [] } });
    return route.fulfill({ body: '', contentType: 'text/javascript' });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.addStyleTag({ content: '#shoreLetterModal {display:none!important}' });
  const entry = page.locator('[data-update-history="baidu"]');
  const dialog = page.locator('.update-history-dialog');
  await entry.click();
  await page.waitForFunction(() => document.querySelectorAll('.update-history-list article').length === 229);
  assert.equal(await dialog.locator('img').count(), 0);
  assert.match(await dialog.locator('h3').first().innerText(), /<img/);
  await dialog.locator('input').fill('课程 229');
  assert.equal(await dialog.locator('article').count(), 1);
  await dialog.locator('[data-history-copy]').click();
  let copied = await page.evaluate(() => window.__copiedHistory.at(-1));
  assert.equal((copied.match(/链接：https:/g) || []).length, 229);
  assert.equal((copied.match(/提取码：abcd/g) || []).length, 229);
  await dialog.locator('select').selectOption({ index: 1 });
  await page.waitForFunction(() => document.querySelector('.update-history-list h3')?.textContent === '上一批资料');
  await dialog.locator('[data-history-platform="quark"]').click();
  await page.waitForFunction(() => document.querySelector('.update-history-list h3')?.textContent === '夸克资料');
  await dialog.locator('[data-history-copy]').click();
  copied = await page.evaluate(() => window.__copiedHistory.at(-1)); assert(!copied.includes('提取码')); assert(copied.includes('quark-alpha'));
  await page.keyboard.press('Escape');
  assert.equal(await entry.evaluate(el => el === document.activeElement), true);
  baiduDelay = 300;
  await entry.click();
  await dialog.locator('[data-history-platform="quark"]').click();
  await page.waitForFunction(() => document.querySelector('.update-history-list h3')?.textContent === '夸克资料');
  await page.waitForTimeout(500); assert.equal(await dialog.locator('h2').innerText(), '夸克网盘更新记录'); assert.equal(await dialog.locator('article').count(), 1); baiduDelay = 0;
  await dialog.locator('[data-history-platform="baidu"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.update-history-list article').length === 229);
  await page.evaluate(() => { window.__clipboardFail = true; });
  await dialog.locator('[data-history-copy]').click();
  assert.equal((await dialog.locator('textarea').inputValue()).match(/链接：https:/g).length, 229);
  await page.evaluate(() => { document.body.classList.remove('theme-light'); document.querySelector('.update-history-dialog').scrollTop = 0; });
  await page.screenshot({ path: path.join(output, 'desktop-dark.png') });
  await page.evaluate(() => { document.body.classList.add('theme-light'); });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.locator('[data-history-platform="quark"]').click();
  await page.waitForFunction(() => document.querySelector('.update-history-list h3')?.textContent === '夸克资料');
  assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
  await page.screenshot({ path: path.join(output, 'mobile-light.png') });
  records = records.filter(row => row.platform !== 'quark');
  await dialog.locator('[data-history-platform="quark"]').click();
  await page.waitForFunction(() => document.querySelector('.update-history-status').textContent.includes('暂无已发布'));
  assert(await dialog.locator('[data-history-copy]').isDisabled());
  apiFailure = true;
  await dialog.locator('[data-history-platform="quark"]').click();
  await dialog.locator('[data-history-retry]').waitFor();
  apiFailure = false;
  await dialog.locator('[data-history-retry]').click();
  await page.waitForFunction(() => document.querySelector('.update-history-status').textContent.includes('暂无已发布'));
  assert.deepEqual(errors, []);
  console.log('PASS: 229 visible links, complete copy while filtered, separate platform/history selection, clipboard fallback, empty/retry, race protection, escaping, focus restoration and mobile light/dark layouts.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });
