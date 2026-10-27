(() => {
  const names = { baidu: '百度网盘', quark: '夸克网盘' };
  const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const dialog = document.createElement('dialog');
  dialog.className = 'update-history-dialog';
  dialog.setAttribute('aria-labelledby', 'updateHistoryTitle');
  dialog.innerHTML = `<header><div><span class="update-history-kicker">每次更新，一次看全</span><h2 id="updateHistoryTitle">网盘更新记录</h2></div><button type="button" data-history-close aria-label="关闭更新记录">×</button></header>
    <nav class="update-history-tabs" aria-label="选择网盘"><button type="button" data-history-platform="baidu">百度网盘</button><button type="button" data-history-platform="quark">夸克网盘</button></nav>
    <p class="update-history-hint">按发布批次保存当时的全部链接，历史链接可能失效，请以网盘实际页面为准。</p>
    <div class="update-history-tools"><label>更新批次<select aria-label="更新批次"></select></label><button type="button" data-history-copy disabled>复制本批全部链接</button></div>
    <label class="update-history-filter">在本批中查找<input type="search" placeholder="输入老师或资料名称" autocomplete="off" /></label>
    <p class="update-history-status" role="status" aria-live="polite"></p><div class="update-history-list"></div>
    <div class="update-history-fallback" hidden><label>自动复制未成功，可长按或全选下方文案复制<textarea readonly aria-label="本批全部链接文案" rows="8"></textarea></label></div>`;
  document.body.append(dialog);
  const select = dialog.querySelector('select');
  const search = dialog.querySelector('input');
  const status = dialog.querySelector('[role="status"]');
  const list = dialog.querySelector('.update-history-list');
  const copy = dialog.querySelector('[data-history-copy]');
  const fallback = dialog.querySelector('.update-history-fallback');
  const local = (window.PAN_SEARCH_DATA?.updateBatches || []);
  const details = new Map();
  let platform = 'baidu', batches = [], current = null, generation = 0, previousFocus;
  let offlineNote = '';
  const dateLabel = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) : '更新时间待确认';
  };
  function safeEntries(batch) {
    return (Array.isArray(batch?.entries) ? batch.entries : []).flatMap(item => {
      try {
        const url = new URL(item.url);
        if (url.hostname !== (platform === 'baidu' ? 'pan.baidu.com' : 'pan.quark.cn') || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || !/^\/s\/[\w-]+\/?$/.test(url.pathname) || !item.title) return [];
        return [{ title: String(item.title), url: url.href, code: String(item.code || url.searchParams.get('pwd') || '') }];
      } catch (_) { return []; }
    });
  }
  function render() {
    const entries = current?.entries || [];
    const query = search.value.trim().toLocaleLowerCase('zh-CN');
    const filtered = entries.filter(item => item.title.toLocaleLowerCase('zh-CN').includes(query));
    list.innerHTML = filtered.map((item, index) => `<article><div class="update-history-item-head"><span>${index + 1}</span><h3>${escape(item.title)}</h3></div><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.url)}</a><footer><span>${item.code ? `提取码：<b>${escape(item.code)}</b>` : '无需提取码'}</span><a class="update-history-open" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">打开网盘 ↗</a></footer></article>`).join('');
    status.textContent = `${offlineNote}${entries.length ? (query ? `找到 ${filtered.length} 条，本批共 ${entries.length} 条。复制按钮始终复制本批全部链接。` : `本批共 ${entries.length} 条链接，已全部列出。`) : '暂无已发布的更新记录，发布后会在这里显示。'}`;
    copy.disabled = !entries.length;
  }
  async function request(query) {
    if (!base) throw new Error('no api');
    const response = await fetch(`${base}/api/update-batches?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'request failed');
    return data;
  }
  async function showBatch(id, token) {
    current = null; list.replaceChildren(); copy.disabled = true; fallback.hidden = true; search.value = '';
    if (!id) { render(); return; }
    status.textContent = '正在加载本批全部链接…';
    try {
      let batch = details.get(id);
      if (!batch) {
        try { batch = (await request(new URLSearchParams({ platform, id }))).batch; }
        catch (error) {
          batch = local.find(row => row.id === id && row.platform === platform);
          if (!batch) throw error;
          if (token === generation) offlineNote = '当前显示页面内保存的记录，最新记录暂时无法获取。';
        }
      }
      if (token !== generation) return;
      if (!batch || batch.id !== id || batch.platform !== platform) throw new Error('invalid batch');
      current = { ...batch, entries: safeEntries(batch) };
      details.set(id, current);
      render();
    } catch (_) {
      if (token !== generation) return;
      status.innerHTML = '本批链接加载失败。<button type="button" data-history-retry>重试</button>';
    }
  }
  async function load(nextPlatform) {
    const token = ++generation;
    platform = nextPlatform; current = null; batches = []; offlineNote = ''; select.disabled = true;
    select.replaceChildren(); list.replaceChildren(); copy.disabled = true; fallback.hidden = true;
    dialog.scrollTop = 0;
    dialog.querySelector('h2').textContent = `${names[platform]}更新记录`;
    dialog.querySelectorAll('[data-history-platform]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.historyPlatform === platform)));
    status.textContent = '正在获取更新批次…';
    try {
      let rows;
      try { rows = (await request(new URLSearchParams({ platform }))).batches; }
      catch (error) {
        rows = local.filter(row => row.platform === platform);
        if (!rows.length) throw error;
        if (token === generation) offlineNote = '当前显示页面内保存的记录，最新记录暂时无法获取。';
      }
      if (token !== generation) return;
      batches = (Array.isArray(rows) ? rows : []).filter(row => row.platform === platform && typeof row.id === 'string').sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      select.innerHTML = batches.map((batch, index) => `<option value="${escape(batch.id)}">${index === 0 ? '最近一批 · ' : ''}${escape(dateLabel(batch.publishedAt))} · ${Number(batch.count || batch.entries?.length) || 0} 条</option>`).join('');
      select.disabled = !batches.length;
      await showBatch(select.value, token);
    } catch (_) {
      if (token === generation) status.innerHTML = '更新记录暂时无法加载。<button type="button" data-history-retry>重试</button>';
    }
  }
  select.addEventListener('change', () => { offlineNote = ''; showBatch(select.value, ++generation); });
  search.addEventListener('input', () => { if (current) render(); });
  copy.addEventListener('click', async () => {
    if (!current?.entries.length) return;
    const batch = current;
    const text = `${names[platform]}更新 · ${dateLabel(batch.publishedAt)}\n共 ${batch.entries.length} 条\n\n` + batch.entries.map(item => `${item.title}\n链接：${item.url}${item.code ? `\n提取码：${item.code}` : ''}`).join('\n\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (current === batch) { fallback.hidden = true; status.textContent = `已复制本批全部 ${batch.entries.length} 条链接及提取码。`; }
    } catch (_) {
      if (current !== batch) return;
      fallback.hidden = false;
      const textarea = fallback.querySelector('textarea');
      textarea.value = text; textarea.focus(); textarea.select();
      status.textContent = '自动复制未成功，请在下方手动复制完整文案。';
    }
  });
  document.addEventListener('click', event => {
    const entry = event.target.closest('[data-update-history]');
    if (!entry || !names[entry.dataset.updateHistory]) return;
    previousFocus = entry;
    if (!dialog.open) dialog.showModal();
    load(entry.dataset.updateHistory);
  });
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-history-close]')) dialog.close();
    const tab = event.target.closest('[data-history-platform]');
    if (tab) load(tab.dataset.historyPlatform);
    if (event.target.closest('[data-history-retry]')) load(platform);
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => { ++generation; previousFocus?.focus(); });
})();
