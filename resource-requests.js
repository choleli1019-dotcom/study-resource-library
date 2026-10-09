(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'resource-request-dialog';
  dialog.setAttribute('aria-labelledby', 'resourceRequestTitle');
  dialog.innerHTML = `
    <form id="resourceRequestForm">
      <div class="resource-request-heading"><h2 id="resourceRequestTitle">登记想找的资料</h2><button type="button" data-request-close aria-label="关闭">×</button></div>
      <p>告诉我们你想找什么，方便后续整理和补充。</p>
      <label>资料名称 <span>必填</span><input name="title" required minlength="2" maxlength="120" placeholder="例如：2025 浙江省考行测真题及解析" /></label>
      <label>补充说明 <span>选填</span><textarea name="details" maxlength="500" rows="4" placeholder="可以填写地区、年份、老师、课程或是否需要解析"></textarea></label>
      <p class="resource-request-hint">登记后可凭查询码查看进度。请勿填写手机号等个人信息，资料会视情况整理。</p>
      <p class="resource-request-status" role="status" aria-live="polite"></p>
      <section class="resource-request-receipt" hidden><label>你的查询码<input readonly aria-label="你的查询码" /></label><p class="receipt-storage-note"></p><div class="receipt-actions"><button type="button" data-copy-receipt>复制查询码</button><button type="button" data-receipt-progress>查看进度</button></div></section>
      <div class="resource-request-actions"><button type="button" data-request-close>取消</button><button type="submit">提交需求</button></div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('[role="status"]');
  const submit = form.querySelector('[type="submit"]');
  let query = '';
  let busy = false;
  let completed = false;
  let lookupCode = '';
  let previousFocus;
  function close() { if (!busy) dialog.close(); }
  dialog.addEventListener('close', () => { if (!progressDialog.open) previousFocus?.focus(); });
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-request-close]')) close();
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-resource-request]')) return;
    previousFocus = event.target.closest('[data-resource-request]');
    query = document.getElementById('searchInput')?.value.trim().slice(0, 256) || '';
    if (completed) { form.reset(); completed = false; lookupCode = ''; dialog.querySelector('.resource-request-receipt').hidden = true; dialog.querySelector('[data-copy-receipt]').textContent = '复制查询码'; }
    if (!form.elements.title.value) form.elements.title.value = query.slice(0, 120);
    status.textContent = '';
    submit.disabled = false;
    submit.textContent = '提交需求';
    dialog.showModal();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || completed || !form.reportValidity()) return;
    const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
    if (!base) { status.textContent = '登记服务暂未配置，请稍后再试。'; return; }
    busy = true;
    submit.disabled = true;
    submit.textContent = '正在提交…';
    status.textContent = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      if (!lookupCode) lookupCode = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      const response = await fetch(base + '/api/resource-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ title: form.elements.title.value.trim(), details: form.elements.details.value.trim(), query, lookupCode })
      });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('登记服务暂不可用，请稍后再试。'); }
      if (!response.ok || !data.ok) throw new Error(data.error || '提交失败，请稍后再试。');
      completed = true;
      status.textContent = data.duplicate ? '这条需求已登记，不用重复提交。' : '登记成功！管理员可以查看你的资料需求了。';
      submit.textContent = '已登记';
      if (/^[a-f0-9]{32}$/.test(data.lookupCode || '')) {
        lookupCode = data.lookupCode;
        const stored = saveReceipt({ code: lookupCode, title: form.elements.title.value.trim(), createdAt: data.createdAt || new Date().toISOString() });
        dialog.querySelector('.resource-request-receipt').hidden = false;
        dialog.querySelector('.resource-request-receipt input').value = lookupCode;
        dialog.querySelector('.receipt-storage-note').textContent = stored ? '已保存到当前浏览器，可从“查询求资料进度”查看。换设备时请使用查询码。' : '请复制并保存查询码，稍后可用它查看进度。';
      }
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '请求超时，内容已保留，请稍后重试。' : (error instanceof TypeError ? '网络连接失败，内容已保留，请稍后重试。' : error.message);
      submit.textContent = '重新提交';
    } finally {
      clearTimeout(timeout);
      busy = false;
      submit.disabled = completed;
    }
  });

  const receiptKey = 'study-resource-request-receipts-v1';
  function readReceipts() {
    try {
      const items = JSON.parse(localStorage.getItem(receiptKey) || '[]');
      return Array.isArray(items) ? items.filter(item => /^[a-f0-9]{32}$/.test(item?.code) && typeof item.title === 'string').slice(0, 50) : [];
    } catch (_) { return []; }
  }
  function saveReceipt(item) {
    try { localStorage.setItem(receiptKey, JSON.stringify([item, ...readReceipts().filter(previous => previous.code !== item.code)].slice(0, 50))); return true; }
    catch (_) { return false; }
  }
  const progressDialog = document.createElement('dialog');
  progressDialog.className = 'resource-request-dialog resource-progress-dialog';
  progressDialog.setAttribute('aria-labelledby', 'resourceProgressTitle');
  progressDialog.innerHTML = `
    <div class="resource-request-heading"><h2 id="resourceProgressTitle">求资料进度</h2><button type="button" data-progress-close aria-label="关闭进度查询">×</button></div>
    <p>本机登记的需求会保存在下方，也可以粘贴查询码查看。</p>
    <div class="resource-progress-history" aria-label="本机登记的需求"></div>
    <form id="resourceProgressForm"><label>查询码<input name="code" required maxlength="80" autocomplete="off" spellcheck="false" placeholder="粘贴登记成功时的查询码" /></label><button type="submit">查询 / 刷新进度</button></form>
    <p class="resource-progress-message" role="status" aria-live="polite"></p>
    <section class="resource-progress-result" hidden aria-label="需求处理结果"></section>`;
  document.body.append(progressDialog);
  const progressForm = progressDialog.querySelector('form');
  const progressMessage = progressDialog.querySelector('[role="status"]');
  const progressResult = progressDialog.querySelector('.resource-progress-result');
  const progressSubmit = progressForm.querySelector('[type="submit"]');
  const labels = { pending: '待处理', searching: '寻找中', fulfilled: '已补充', unavailable: '暂未找到' };
  let progressFocus;
  let queryController;
  let querySequence = 0;
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }
  function formatTime(value) {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }
  function renderProgress(item) {
    progressResult.replaceChildren();
    const heading = element('div', 'resource-progress-heading');
    heading.append(element('h3', '', item.title));
    const badge = element('span', 'resource-progress-badge', labels[item.status] || '待处理');
    badge.dataset.status = item.status;
    heading.append(badge);
    progressResult.append(heading);
    const defaults = { pending: '需求已登记，等待管理员处理。', searching: '正在寻找和整理相关资料。', fulfilled: '资料已补充，可以打开下方链接领取。', unavailable: '暂时还没有找到合适的资料，后续可再查看。' };
    progressResult.append(element('p', 'resource-progress-reply', item.reply || defaults[item.status] || defaults.pending));
    const times = [item.createdAt ? '登记：' + formatTime(item.createdAt) : '', item.updatedAt ? '更新：' + formatTime(item.updatedAt) : ''].filter(Boolean);
    progressResult.append(element('p', 'resource-progress-time', times.join(' · ')));
    if (item.status === 'fulfilled' && item.resourceUrl) {
      try {
        const url = new URL(item.resourceUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        const link = element('a', 'resource-progress-link', '打开资料领取');
        link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        progressResult.append(link);
        if (item.resourceCode) {
          const codeRow = element('div', 'resource-progress-code');
          codeRow.append(element('span', '', '提取码：' + item.resourceCode));
          const button = element('button', '', '复制提取码'); button.type = 'button';
          button.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(item.resourceCode); button.textContent = '已复制'; }
            catch (_) { progressMessage.textContent = '请长按或选中提取码复制。'; }
          });
          codeRow.append(button); progressResult.append(codeRow);
        }
        if (window.renderPersonalResourceActions) {
          const actions = document.createElement('div');
          actions.innerHTML = window.renderPersonalResourceActions({ title: item.title, url: url.href, code: item.resourceCode || '', description: item.reply || '' });
          progressResult.append(...actions.children);
        }
      } catch (_) { progressResult.append(element('p', '', '领取链接暂不可用，请稍后查看。')); }
    } else if (item.status === 'fulfilled') progressResult.append(element('p', '', '管理员正在补充领取链接，请稍后查看。'));
    progressResult.hidden = false;
  }
  async function queryProgress() {
    queryController?.abort();
    const sequence = ++querySequence;
    progressSubmit.disabled = false;
    const code = progressForm.elements.code.value.replace(/[\s-]/g, '').toLowerCase();
    progressForm.elements.code.value = code;
    if (!/^[a-f0-9]{32}$/.test(code)) { progressResult.hidden = true; progressMessage.textContent = '请输入完整的 32 位查询码。'; return; }
    const controller = new AbortController();
    queryController = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    progressSubmit.disabled = true;
    progressResult.hidden = true;
    progressMessage.textContent = '正在查询最新进度…';
    try {
      const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
      if (!base) throw new Error('查询服务暂未配置，请稍后再试。');
      const response = await fetch(base + '/api/resource-request-progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: controller.signal });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('查询服务暂不可用，请稍后再试。'); }
      if (!response.ok || !data.ok || !data.item) throw new Error(data.error || '进度查询失败，请稍后重试。');
      if (sequence !== querySequence) return;
      renderProgress(data.item);
      progressMessage.textContent = '已获取最新进度';
    } catch (error) {
      if (sequence === querySequence) progressMessage.textContent = error.name === 'AbortError' ? '查询超时，请稍后重试。' : (error instanceof TypeError ? '网络连接失败，请稍后重试。' : error.message);
    } finally { clearTimeout(timeout); if (sequence === querySequence) progressSubmit.disabled = false; }
  }
  function openProgress(code = '', focus = document.activeElement) {
    progressFocus = focus;
    const history = progressDialog.querySelector('.resource-progress-history');
    history.replaceChildren();
    const receipts = readReceipts();
    receipts.forEach(item => {
      const button = element('button', 'resource-progress-history-item'); button.type = 'button';
      button.append(element('strong', '', item.title), element('small', '', formatTime(item.createdAt)));
      button.addEventListener('click', () => { progressForm.elements.code.value = item.code; queryProgress(); });
      history.append(button);
    });
    if (!receipts.length) history.append(element('p', '', '本机暂无登记记录，可粘贴查询码查看。'));
    progressResult.hidden = true;
    progressMessage.textContent = '';
    progressSubmit.disabled = false;
    progressForm.elements.code.value = code || receipts[0]?.code || '';
    progressDialog.showModal();
    if (progressForm.elements.code.value) queryProgress();
  }
  progressDialog.addEventListener('close', () => { querySequence++; queryController?.abort(); progressFocus?.focus(); });
  progressDialog.addEventListener('click', event => { if (event.target.closest('[data-progress-close]')) progressDialog.close(); });
  progressForm.addEventListener('submit', event => { event.preventDefault(); queryProgress(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-request-progress]');
    if (button) openProgress('', button);
  });
  dialog.querySelector('[data-receipt-progress]').addEventListener('click', () => { dialog.close(); openProgress(lookupCode, previousFocus); });
  dialog.querySelector('[data-copy-receipt]').addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(lookupCode); event.target.textContent = '已复制'; }
    catch (_) { dialog.querySelector('.resource-request-receipt input').select(); status.textContent = '请复制已选中的查询码。'; }
  });
})();
