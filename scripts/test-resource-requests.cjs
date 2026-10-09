const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-requests-'));
let backend, browser, staticServer;
async function freePort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
(async () => {
  const port = await freePort();
  const api = 'http://127.0.0.1:' + port;
  backend = spawn(process.execPath, [path.join(root, 'server/analytics-server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_TOKEN: 'resource-request-test-token', GITHUB_TOKEN: '', LINK_HEALTH_AUTOCHECK: 'false' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Backend startup timeout')), 10000);
    backend.stdout.on('data', chunk => { if (String(chunk).includes('listening')) { clearTimeout(timeout); resolve(); } });
    backend.once('error', reject);
  });
  const post = (body, headers = {}) => fetch(api + '/api/resource-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await post({ title: ' ' })).status, 400);
  assert.equal((await post({ title: 'a'.repeat(121) })).status, 400);
  assert.equal((await post({ title: '浙江真题' }, { Origin: 'https://unknown.invalid' })).status, 403);
  const title = '2025 浙江行测真题 <script>alert(1)</script>';
  const response = await post({ title, details: '需要答案与解析', query: '浙江 行测' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert(saved.ok && saved.id);
  assert.equal((await (await post({ title, details: '需要答案与解析' })).json()).duplicate, true);
  assert.equal((await post({ title: '另一份资料' })).status, 429);
  let items = JSON.parse(fs.readFileSync(path.join(dataDir, 'resource-requests.json'), 'utf8'));
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'pending');
  assert.equal(items[0].query, '浙江 行测');
  const update = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id: saved.id, status: 'fulfilled', note: '已补充真题', filter: 'all' }) };
  assert.equal((await fetch(api + '/admin/resource-requests/update', update)).status, 403);
  assert.equal((await fetch(api + '/admin/resource-requests/update?token=resource-request-test-token', { ...update, redirect: 'manual' })).status, 303);
  const html = await (await fetch(api + '/admin?token=resource-request-test-token&requestFilter=all')).text();
  assert(html.includes('求资料登记'));
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert(!html.includes(title));
  items = JSON.parse(fs.readFileSync(path.join(dataDir, 'resource-requests.json'), 'utf8'));
  assert.equal(items[0].status, 'fulfilled');
  assert.equal(items[0].note, '已补充真题');
  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
  catch (error) {
    if (process.env.PLAYWRIGHT_MODULE_PATH) throw error;
    playwright = require('C:/Users/zhiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  }
  const { chromium } = playwright;
  staticServer = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file)); } catch (_) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let failSubmission = false;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.pathname === '/api/resource-requests') {
      if (failSubmission) return route.abort();
      const r = await post(route.request().postDataJSON(), { 'x-forwarded-for': 'ui-test' });
      return route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() });
    }
    if (url.pathname === '/api/shore-letter') return route.fulfill({ json: { ok: true, letter: { active: false } } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, items: [], hiddenUrls: [], ranking: [], linkCare: [] } });
    return route.fulfill({ body: '', contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript' });
  });
  await page.goto('http://127.0.0.1:' + staticServer.address().port);
  await page.addStyleTag({ content: '#shoreLetterModal { display:none !important; }' });
  await page.locator('#searchInput').fill('2026 浙江申论缺失测试');
  await page.locator('#heroSearchButton').click();
  const emptyButton = page.locator('.search-smart-empty [data-resource-request]');
  await emptyButton.click();
  const dialog = page.locator('.resource-request-dialog');
  assert(await dialog.isVisible());
  assert.equal(await dialog.locator('[name="title"]').inputValue(), '2026 浙江申论缺失测试');
  await dialog.locator('[name="details"]').fill('希望包含解析');
  failSubmission = true;
  await dialog.locator('[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.resource-request-status').textContent.includes('网络连接失败'));
  assert.equal(await dialog.locator('[name="details"]').inputValue(), '希望包含解析');
  failSubmission = false;
  await dialog.locator('[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.resource-request-status').textContent.includes('登记成功'));
  assert(await dialog.locator('[type="submit"]').isDisabled());
  items = JSON.parse(fs.readFileSync(path.join(dataDir, 'resource-requests.json'), 'utf8'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '2026 浙江申论缺失测试');
  assert.equal(items[0].details, '希望包含解析');
  await page.screenshot({ path: path.join(root, '.tmp-resource-requests-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.keyboard.press('Escape');
  assert.equal(await emptyButton.evaluate(button => document.activeElement === button), true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.resource-request-entry button').click();
  await page.screenshot({ path: path.join(root, '.tmp-resource-requests-desktop.png') });
  await dialog.locator('[data-request-close]').first().click();
  await page.goto(api + '/admin?token=resource-request-test-token&requestFilter=all#resource-requests');
  assert(await page.locator('#resource-requests').isVisible());
  assert.match(await page.locator('#resource-requests').innerText(), /2026 浙江申论缺失测试/);
  assert.deepEqual(errors, []);
  console.log('PASS: persistence, validation, origin checks, duplicate protection, throttling, admin authentication/status updates, HTML escaping, no-result entry, prefill, failed submission retry, mobile/desktop layout and keyboard focus.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  await new Promise(resolve => staticServer ? staticServer.close(resolve) : resolve());
  backend?.kill();
});
