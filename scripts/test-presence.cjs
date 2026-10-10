const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..'), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-presence-'));
const release = path.join(root, '.tmp-presence-release'); fs.mkdirSync(release, { recursive: true });
let backend, browser, staticServer, proxy;
const clockFile = path.join(dataDir, 'clock.txt'), hook = path.join(dataDir, 'clock-hook.cjs');
fs.writeFileSync(clockFile, '0');
fs.writeFileSync(hook, `const fs = require('node:fs'); const original = Date.now; Date.now = () => original() + Number(fs.readFileSync(${JSON.stringify(clockFile)}, 'utf8'));`);
async function freePort() { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
(async () => {
  const backendPort = await freePort(), staticPort = await freePort(), proxyPort = await freePort();
  const api = 'http://127.0.0.1:' + backendPort, origin = 'http://127.0.0.1:' + staticPort, proxyBase = 'http://127.0.0.1:' + proxyPort;
  backend = spawn(process.execPath, ['-r', hook, path.join(root, 'server/analytics-server.js')], { env: { ...process.env, PORT: String(backendPort), DATA_DIR: dataDir, ADMIN_TOKEN: 'isolated-presence-test-token', GITHUB_TOKEN: '', LINK_HEALTH_AUTOCHECK: 'false', ALLOWED_ORIGINS: origin + ',https://study.202510319.xyz' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Backend startup timeout')), 10000); backend.stdout.on('data', chunk => { if (String(chunk).includes('listening')) { clearTimeout(timeout); resolve(); } }); backend.once('error', reject); });
  const post = (body, headers = {}) => fetch(api + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...headers }, body: JSON.stringify(body) });
  const snapshot = async () => (await (await fetch(api + '/api/presence')).json());
  const payload = { visitorId: 'test-presence-person-1', active: true, remainingMs: 600000 };
  assert.equal((await post(payload, { Origin: 'https://unknown.invalid' })).status, 403);
  assert.equal((await post({ visitorId: 'id.with.dots', active: true, remainingMs: 100 })).status, 400);
  assert.equal((await post({ ...payload, active: 'true' })).status, 400); assert.equal((await snapshot()).onlineCount, 0);
  const first = await post(payload, { Origin: origin }); assert.equal(first.status, 200); assert.equal(first.headers.get('access-control-allow-origin'), origin); assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.equal((await first.json()).focusCount, 1);
  assert.equal((await (await post(payload)).json()).onlineCount, 1);
  assert.equal((await (await post({ visitorId: payload.visitorId })).json()).focusCount, 1, 'A site heartbeat without focus state must not remove an existing focus lease');
  assert.equal((await (await post({ ...payload, visitorId: 'test-presence-person-2', active: false })).json()).onlineCount, 2);
  assert.equal((await (await post({ ...payload, active: false })).json()).focusCount, 0);
  await post(payload);
  fs.writeFileSync(clockFile, '100000'); assert.equal((await snapshot()).focusCount, 1, 'A short heartbeat gap must not remove active people');
  fs.writeFileSync(clockFile, '151000'); assert.equal((await snapshot()).onlineCount, 0); assert.equal((await snapshot()).focusCount, 0);
  fs.writeFileSync(clockFile, '0');

  let failRequests = 0, alwaysFail = false, holdNext = false, hungNext = false, malformedNext = false, pendingRelease = null;
  let concurrent = 0, maxConcurrent = 0;
  const requests = [], methods = [];
  proxy = http.createServer((req, res) => {
    if (req.url.split('?')[0] !== '/api/presence') { res.writeHead(404); res.end(); return; }
    methods.push(req.method); concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    let finished = false; const finish = () => { if (!finished) { finished = true; concurrent--; } }; res.on('close', finish); res.on('finish', finish);
    const chunks = []; req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const bytes = Buffer.concat(chunks); requests.push({ method: req.method, type: req.headers['content-type'], body: bytes.length ? JSON.parse(bytes) : null });
      const cors = { 'Access-Control-Allow-Origin': origin, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
      if (alwaysFail || failRequests > 0) { failRequests = Math.max(0, failRequests - 1); res.writeHead(503, cors); res.end(JSON.stringify({ ok: false, error: 'isolated network failure' })); return; }
      if (hungNext) { hungNext = false; return; }
      if (malformedNext) { malformedNext = false; res.writeHead(200, cors); res.end(JSON.stringify({ ok: true, onlineCount: 'unknown', focusCount: -1, updatedAt: new Date().toISOString() })); return; }
      const forward = () => { const upstream = http.request(api + req.url, { method: req.method, headers: { ...req.headers, host: '127.0.0.1:' + backendPort } }, result => { res.writeHead(result.statusCode, result.headers); result.pipe(res); }); upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, cors); res.end('{}'); }); upstream.end(bytes); };
      if (holdNext) { holdNext = false; pendingRelease = forward; } else forward();
    });
  });
  await new Promise(resolve => proxy.listen(proxyPort, '127.0.0.1', resolve));
  staticServer = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname), file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      const content = fs.readFileSync(file); res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
      res.end(file.endsWith('index.html') ? content.toString('utf8').replaceAll('https://study-resource-api.gjsx.uno', proxyBase) : content);
    } catch (_) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => staticServer.listen(staticPort, '127.0.0.1', resolve));
  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); } catch (error) { if (process.env.PLAYWRIGHT_MODULE_PATH) throw error; playwright = require('C:/Users/zhiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
  async function create(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(options => {
      if (options.legacyId) localStorage.setItem('study-resource-visitor-id', '1700000000000-0.123456');
      if (options.noUuid) Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
      if (options.noStorage) {
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        Storage.prototype.getItem = function(key) { if (['study-resource-visitor-id', 'study-resource-presence-snapshot-v1'].includes(key)) throw new DOMException('Storage denied', 'SecurityError'); return get.call(this, key); };
        Storage.prototype.setItem = function(key, value) { if (['study-resource-visitor-id', 'study-resource-presence-snapshot-v1'].includes(key)) throw new DOMException('Storage denied', 'SecurityError'); return set.call(this, key, value); };
      }
    }, options);
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === proxyBase && url.pathname === '/api/presence') return route.continue();
      if (url.origin === origin) return route.continue();
      if (url.pathname === '/api/shore-letter') return route.fulfill({ json: { ok: true, letter: { active: false } } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, items: [], hiddenUrls: [], ranking: [], linkCare: [], notice: { active: false } } });
      return route.fulfill({ body: '', contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript' });
    });
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin); await page.addStyleTag({ content: '#shoreLetterModal{display:none!important;}' });
    return { context, page, errors };
  }
  const test = await create({ noStorage: true, noUuid: true }), page = test.page;
  const fresh = () => page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'fresh' && document.querySelector('#focusPresence').dataset.presenceState === 'fresh');
  await fresh(); assert.match(await page.locator('#siteGlobalOnline').innerText(), /1 人在线/); assert.match(await page.locator('#focusPresence').innerText(), /0 人一起专注/);
  const id = await page.evaluate(() => getVisitorId()); assert.match(id, /^[a-zA-Z0-9_-]{8,100}$/); assert.equal(await page.evaluate(() => getVisitorId()), id);
  assert(requests.every(request => request.method === 'POST' && request.type.startsWith('text/plain'))); assert.equal(methods.includes('OPTIONS'), false, 'The actual cross-origin browser heartbeat must avoid a preflight');
  await page.locator('#focusSubject').selectOption('资料分析'); await page.locator('#focusPrimary').click();
  await page.waitForFunction(() => /此刻 1 人一起专注/.test(document.querySelector('#focusPresence').textContent));
  failRequests = 1; await page.evaluate(() => window.STUDY_PRESENCE.refresh());
  await page.waitForFunction(() => document.querySelector('#focusPresence').dataset.presenceState === 'reconnecting');
  assert.match(await page.locator('#siteGlobalOnline').innerText(), /1 人在线.*更新中/); assert.match(await page.locator('#focusPresence').innerText(), /上次 1 人专注/);
  await fresh(); // Automatic retry; no manual refresh.
  malformedNext = true; await page.evaluate(() => window.STUDY_PRESENCE.refresh());
  await page.waitForFunction(() => document.querySelector('#focusPresence').dataset.presenceState === 'reconnecting'); assert.match(await page.locator('#focusPresence').innerText(), /上次 1 人专注/); await fresh();
  await page.locator('#focusPrimary').click(); await page.waitForFunction(() => /此刻 0 人一起专注/.test(document.querySelector('#focusPresence').textContent));
  holdNext = true; await page.locator('#focusPrimary').click();
  await new Promise(resolve => { const poll = setInterval(() => { if (pendingRelease) { clearInterval(poll); resolve(); } }, 10); });
  await page.locator('#focusPrimary').click(); // Pause while a delayed "active" request is still in flight.
  pendingRelease(); pendingRelease = null;
  await page.waitForFunction(() => /此刻 0 人一起专注/.test(document.querySelector('#focusPresence').textContent) && document.querySelector('#siteGlobalOnline').dataset.presenceState === 'fresh');
  assert.equal(maxConcurrent, 1, 'One serialized heartbeat serves both counters');
  await test.context.setOffline(true); await page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'reconnecting');
  await test.context.setOffline(false); await fresh();
  hungNext = true; await page.evaluate(() => window.STUDY_PRESENCE.refresh());
  await page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'reconnecting', { timeout: 18000 }); await fresh();
  await page.setViewportSize({ width: 390, height: 844 });
  failRequests = 1; await page.evaluate(() => window.STUDY_PRESENCE.refresh());
  await page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'reconnecting');
  assert.equal(await page.locator('.hero-live-panel').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
  assert.equal(await page.locator('#focusCompanion').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
  await page.locator('.hero-live-panel').screenshot({ path: path.join(release, 'reconnecting-site-mobile.png') });
  await page.locator('#focusCompanion').screenshot({ path: path.join(release, 'reconnecting-focus-mobile.png') });
  await fresh(); assert.deepEqual(test.errors, []); await test.context.close();
  fs.writeFileSync(clockFile, '151000'); await snapshot(); fs.writeFileSync(clockFile, '0');
  const legacy = await create({ legacyId: true, noUuid: true });
  await legacy.page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'fresh');
  assert.match(await legacy.page.evaluate(() => getVisitorId()), /^[a-zA-Z0-9_-]{8,100}$/); assert(!await legacy.page.evaluate(() => getVisitorId().includes('.')));
  alwaysFail = true; await legacy.page.reload();
  await legacy.page.waitForFunction(() => /更新中/.test(document.querySelector('#siteGlobalOnline').textContent));
  assert.match(await legacy.page.locator('#siteGlobalOnline').innerText(), /1 人在线/);
  await legacy.page.evaluate(() => { const key = 'study-resource-presence-snapshot-v1', cached = JSON.parse(sessionStorage.getItem(key)); cached.receivedAt = Date.now() - 151000; sessionStorage.setItem(key, JSON.stringify(cached)); });
  await legacy.page.reload(); assert(!/\d+ 人/.test(await legacy.page.locator('#siteGlobalOnline').innerText()), 'An expired cached count must not be presented as current');
  alwaysFail = false; await legacy.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await legacy.page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'fresh');
  assert.deepEqual(legacy.errors, []); await legacy.context.close();
  fs.writeFileSync(clockFile, '151000'); await snapshot(); fs.writeFileSync(clockFile, '0');
  alwaysFail = true;
  const initialFailure = await create();
  await initialFailure.page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'reconnecting');
  assert(!/\d+ 人/.test(await initialFailure.page.locator('#siteGlobalOnline').innerText()), 'A failed first read must not invent a zero or other count');
  alwaysFail = false; await initialFailure.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await initialFailure.page.waitForFunction(() => document.querySelector('#siteGlobalOnline').dataset.presenceState === 'fresh');
  assert.deepEqual(initialFailure.errors, []); await initialFailure.context.close();
  console.log('PASS: real shared API, browser CORS without OPTIONS, blocked storage/old IDs, instant focus pause/resume, serialized stale-request recovery, retries, malformed response, timeout, offline/online, truthful cached labels, TTL expiry and mobile layout.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (backend) backend.kill(); if (staticServer) staticServer.close(); if (proxy) proxy.closeAllConnections?.(); if (proxy) proxy.close(); });
