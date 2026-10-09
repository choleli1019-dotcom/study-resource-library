(() => {
  const storageKey = 'study-resource-favorites-v1';
  const registry = new Map();
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function normalize(raw) {
    try {
      if (!raw || typeof raw.url !== 'string' || typeof raw.title !== 'string') return null;
      const url = new URL(raw.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      const pan = /(^|\.)(pan\.baidu\.com|pan\.quark\.cn)$/.test(url.hostname);
      const code = typeof raw.code === 'string' ? raw.code.trim().slice(0, 32) : '';
      return { title: raw.title.trim().replace(/\s+/g, ' ').slice(0, 200) || '未命名资料', url: url.href, code: code || (url.hostname === 'pan.baidu.com' ? (url.searchParams.get('pwd') || '').slice(0, 32) : ''), source: String(raw.source || (raw.platform === 'baidu' ? '百度网盘' : raw.platform === 'quark' ? '夸克网盘' : '')).slice(0, 60), description: String(raw.description || raw.context || '').slice(0, 200), pan, savedAt: Number(raw.savedAt) || Date.now() };
    } catch (_) { return null; }
  }
  function keyFor(item) {
    const url = new URL(item.url);
    if (url.hostname === 'pan.baidu.com') url.searchParams.delete('pwd');
    return url.href;
  }
  function readFavorites() {
    try {
      const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(items)) return [];
      const unique = new Map();
      items.forEach(raw => { const item = normalize(raw); if (item && !unique.has(keyFor(item))) unique.set(keyFor(item), item); });
      return [...unique.values()];
    } catch (_) { return []; }
  }
  let favorites = readFavorites();
  (window.PAN_SEARCH_DATA?.items || []).forEach(raw => { const item = normalize(raw); if (item) registry.set(keyFor(item), item); });
  function isFavorite(key) { return favorites.some(item => keyFor(item) === key); }
  function favoriteLabel(key, collection) { return collection ? '取消收藏' : isFavorite(key) ? '★ 已收藏' : '☆ 收藏'; }
  window.renderPersonalResourceActions = (raw, collection = false) => {
    const item = normalize(raw);
    if (!item) return '';
    const key = keyFor(item);
    const known = registry.get(key);
    if (!item.code && known?.code) item.code = known.code;
    registry.set(key, item);
    return `<div class="personal-resource-actions"><button type="button" data-resource-favorite="${escapeHtml(key)}"${collection ? ' data-favorite-remove' : ''} aria-pressed="${isFavorite(key)}">${favoriteLabel(key, collection)}</button><button type="button" data-resource-share="${escapeHtml(key)}" title="复制资料名称、链接和已有提取码">复制分享文案</button></div>`;
  };
  const dialog = document.createElement('dialog');
  dialog.className = 'personal-favorites-dialog';
  dialog.setAttribute('aria-labelledby', 'personalFavoritesTitle');
  dialog.innerHTML = `<div class="personal-favorites-heading"><h2 id="personalFavoritesTitle">我的收藏 <span></span></h2><button type="button" data-favorites-close aria-label="关闭我的收藏">×</button></div><p class="personal-favorites-hint">收藏保存在当前浏览器，下次访问可以直接打开。</p><label class="personal-favorites-filter">查找已收藏的资料<input type="search" autocomplete="off" placeholder="搜索资料名称或来源" /></label><p class="personal-favorites-message" role="status" aria-live="polite"></p><div class="personal-favorites-list"></div>`;
  document.body.append(dialog);
  const filter = dialog.querySelector('input');
  const list = dialog.querySelector('.personal-favorites-list');
  const message = dialog.querySelector('[role="status"]');
  const toast = document.createElement('div');
  toast.className = 'personal-resource-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  document.body.append(toast);
  let toastTimer;
  let previousFocus;
  function notify(value) {
    if (dialog.open) { message.textContent = value; return; }
    toast.textContent = value; toast.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }
  function refreshButtons() {
    document.querySelectorAll('[data-resource-favorite]').forEach(button => {
      const key = button.dataset.resourceFavorite;
      button.setAttribute('aria-pressed', String(isFavorite(key)));
      button.textContent = favoriteLabel(key, button.hasAttribute('data-favorite-remove'));
    });
    document.querySelectorAll('.personal-favorites-count').forEach(count => { count.textContent = favorites.length; });
  }
  function renderFavorites() {
    const query = filter.value.trim().toLocaleLowerCase('zh-CN');
    const selected = favorites.map(saved => ({ ...saved, ...(registry.get(keyFor(saved)) || {}), savedAt: saved.savedAt })).filter(item => `${item.title} ${item.source} ${item.description}`.toLocaleLowerCase('zh-CN').includes(query));
    dialog.querySelector('h2 span').textContent = `${favorites.length} 项`;
    list.innerHTML = selected.length ? selected.map(item => `<article class="personal-favorite-card"><div class="personal-favorite-copy"><span class="personal-favorite-source">${escapeHtml(item.source || '资料入口')}</span><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${item.code ? `<p class="personal-favorite-code">提取码：${escapeHtml(item.code)}</p>` : ''}</div><a class="personal-favorite-open" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${item.pan ? '打开网盘' : '打开资料'}</a>${window.renderPersonalResourceActions(item, true)}</article>`).join('') : `<p class="personal-favorites-empty">${favorites.length ? '没有匹配的收藏，换个关键词试试。' : '还没有收藏。找到需要的资料时，点击旁边的“收藏”。'}</p>`;
  }
  filter.addEventListener('input', renderFavorites);
  dialog.addEventListener('close', () => { if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-favorites-close]')) dialog.close();
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  function toggleFavorite(button) {
    const key = button.dataset.resourceFavorite;
    const item = registry.get(key);
    if (!item) return;
    const removed = isFavorite(key);
    const next = removed ? favorites.filter(saved => keyFor(saved) !== key) : [{ ...item, savedAt: Date.now() }, ...favorites];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch (_) { notify('收藏未能保存，请检查浏览器是否允许本地存储。'); return; }
    favorites = next;
    if (dialog.open) {
      const index = Array.from(list.querySelectorAll('[data-resource-favorite]')).indexOf(button);
      renderFavorites();
      const buttons = list.querySelectorAll('[data-resource-favorite]');
      (buttons[Math.min(Math.max(index, 0), buttons.length - 1)] || filter).focus();
    }
    refreshButtons();
    notify(removed ? '已取消收藏' : '已收藏，可从首页“我的收藏”打开');
  }
  function shareText(item) {
    return [`资料名称：${item.title}`, `${item.pan ? '网盘链接' : '资料链接'}：${item.url}`, item.code ? `提取码：${item.code}` : ''].filter(Boolean).join('\n');
  }
  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(value); return true; }
    } catch (_) {}
    const active = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = value; textarea.readOnly = true; textarea.style.position = 'fixed'; textarea.style.left = '-9999px';
    (document.querySelector('dialog[open]') || document.body).append(textarea);
    let copied = false;
    try { textarea.select(); copied = document.execCommand('copy'); } catch (_) {}
    textarea.remove(); active?.focus();
    return copied;
  }
  const shareDialog = document.createElement('dialog');
  shareDialog.className = 'personal-share-dialog';
  shareDialog.setAttribute('aria-labelledby', 'personalShareTitle');
  shareDialog.innerHTML = `<div class="personal-favorites-heading"><h2 id="personalShareTitle">复制分享文案</h2><button type="button" data-share-close aria-label="关闭分享文案">×</button></div><p>自动复制未成功，可选中下面内容复制后发到群里。</p><textarea readonly rows="7" aria-label="资料分享文案"></textarea>`;
  document.body.append(shareDialog);
  let shareFocus;
  shareDialog.addEventListener('click', event => { if (event.target.closest('[data-share-close]')) shareDialog.close(); });
  shareDialog.addEventListener('close', () => { if (shareFocus?.isConnected) shareFocus.focus(); });
  document.addEventListener('click', async event => {
    const open = event.target.closest('[data-open-favorites]');
    if (open) {
      previousFocus = open; favorites = readFavorites(); filter.value = ''; message.textContent = '';
      renderFavorites(); refreshButtons(); dialog.showModal(); return;
    }
    const favorite = event.target.closest('[data-resource-favorite]');
    if (favorite) { toggleFavorite(favorite); return; }
    const share = event.target.closest('[data-resource-share]');
    if (!share || share.disabled) return;
    const item = registry.get(share.dataset.resourceShare);
    if (!item) return;
    const value = shareText(item);
    share.disabled = true;
    share.textContent = '复制分享文案';
    try {
      if (await copyText(value)) {
        share.textContent = '已复制分享文案'; notify('已复制，可直接粘贴到群里');
        setTimeout(() => { if (share.isConnected) share.textContent = '复制分享文案'; }, 1600);
      } else {
        shareFocus = share; shareDialog.querySelector('textarea').value = value; shareDialog.showModal(); shareDialog.querySelector('textarea').select();
      }
    } finally { share.disabled = false; }
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    favorites = readFavorites(); refreshButtons(); if (dialog.open) renderFavorites();
  });
  refreshButtons();
})();
