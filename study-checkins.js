(() => {
  const bar = document.querySelector('#studyCheckinBar');
  if (!bar) return;
  const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
  const keyName = 'study-squirrel-checkin-key-v1';
  const count = bar.querySelector('#studyCheckinCount'), latest = bar.querySelector('#studyCheckinLatest'), meta = bar.querySelector('#studyCheckinMeta'), openButton = bar.querySelector('#studyCheckinOpen');
  const time = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let snapshot = null, own = null, revision = 0, submitting = false, memoryKey = '', rolloverDay = '', pendingPayload = null, dialog, form, input, feedback, localSummary, list, listCount, startButton, submitButton, opener;
  function study() { return typeof window.getSquirrelStudySummary === 'function' ? window.getSquirrelStudySummary() : null; }
  function storedKey(create = false) {
    if (memoryKey) return memoryKey;
    try { const value = localStorage.getItem(keyName); if (/^[a-f0-9]{64}$/.test(value || '')) return memoryKey = value; } catch (_) { /* Session-only retry is still idempotent. */ }
    if (!create) return '';
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    memoryKey = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(keyName, memoryKey); }
    catch (_) { feedback.textContent = '此浏览器无法保存打卡凭证，刷新后不能恢复本次打卡。'; }
    return memoryKey;
  }
  async function request(path, body) {
    if (!base) throw new Error('打卡服务暂不可用，请稍后再试');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '打卡连接失败，请稍后再试');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) throw new Error('打卡连接失败，请稍后再试，填写内容会保留');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function validItem(item) {
    return item && typeof item.message === 'string' && Array.isArray(item.subjects) && Number.isSafeInteger(item.focusSeconds) && item.focusSeconds >= 0 && item.focusSeconds <= 86400 && Number.isSafeInteger(item.completedRounds) && item.completedRounds > 0 && Number.isFinite(Date.parse(item.updatedAt));
  }
  function apply(data) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.day || '') || !Number.isSafeInteger(data.count) || data.count < 0 || !Array.isArray(data.items)) throw new Error('打卡记录暂不可用，请稍后再试');
    snapshot = { day: data.day, count: data.count, items: data.items.filter(validItem).slice(0, 50) };
    count.textContent = `今日 ${snapshot.count} 位伙伴完成学习并打卡`;
    const item = snapshot.items[0];
    latest.textContent = item ? `一位伙伴：${item.message}` : '一起学一点，离上岸近一点。';
    meta.textContent = item ? `${item.subjects.join('、')} · ${Math.floor(item.focusSeconds / 60)} 分钟 · 完成 ${item.completedRounds} 轮 · ${time.format(new Date(item.updatedAt))}` : '完成专注后，留一句今天学了什么。';
    renderList();
  }
  async function load() {
    if (submitting) return;
    const ticket = ++revision;
    try {
      const data = await request('/api/study-checkins');
      if (ticket !== revision) return;
      apply(data);
      if (own?.day !== data.day) own = null;
      if (storedKey()) await loadMine(ticket);
      sync();
    } catch (error) {
      if (ticket !== revision) return;
      count.textContent = '今日打卡暂不可用';
      if (dialog?.open) feedback.textContent = error.message;
    }
  }
  async function loadMine(ticket) {
    const key = storedKey();
    if (!key) { own = null; return; }
    const data = await request('/api/study-checkins/mine', { key });
    if (ticket !== revision) return;
    own = data.item ? { day: data.day, ...data.item } : null;
    if (own && input && !input.dataset.edited) input.value = own.message;
  }
  function renderList() {
    if (!list) return;
    list.replaceChildren();
    listCount.textContent = snapshot ? `今日打卡 · ${snapshot.count} 人` : '今日打卡';
    if (!snapshot?.items.length) {
      const empty = document.createElement('p'); empty.textContent = snapshot ? '还没有伙伴打卡，完成专注后可以来留一句。' : '正在读取大家的打卡…'; list.append(empty); return;
    }
    for (const item of snapshot.items) {
      const article = document.createElement('article'); article.className = 'checkin-entry';
      const message = document.createElement('p'); message.textContent = item.message;
      const detail = document.createElement('small'); detail.textContent = `${item.subjects.join('、')} · 专注 ${Math.floor(item.focusSeconds / 60)} 分钟 · 完成 ${item.completedRounds} 轮 · ${time.format(new Date(item.updatedAt))}`;
      article.append(message, detail); list.append(article);
    }
  }
  function sync(value = study()) {
    if (!value) return;
    if (own?.day !== value.date) own = null;
    if (snapshot && snapshot.day !== value.date) {
      snapshot = null; count.textContent = '新的一天，正在读取打卡…'; latest.textContent = '一起学一点，离上岸近一点。'; meta.textContent = '完成专注后，留一句今天学了什么。';
      if (rolloverDay !== value.date) { rolloverDay = value.date; load(); }
    }
    openButton.textContent = own ? '今日已打卡' : '我要打卡';
    if (!dialog || submitting) return;
    const hidden = own?.status === 'hidden', eligible = value.completed > 0 && !hidden;
    localSummary.textContent = hidden ? '你的今日打卡已由管理员隐藏，今日不能重新提交。' : `你今天已专注 ${Math.floor(value.totalMs / 60000)} 分钟，完成 ${value.completed} 轮。${eligible ? '可以自愿留一句学习内容。' : '完成今天至少一轮专注后，就能来打卡。'}`;
    form.hidden = !eligible; startButton.hidden = value.completed > 0;
    submitButton.textContent = own ? '更新今日打卡' : '提交打卡';
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'study-checkin-dialog'; dialog.setAttribute('aria-labelledby', 'studyCheckinDialogTitle');
    dialog.innerHTML = '<div class="checkin-dialog-heading"><h2 id="studyCheckinDialogTitle">群友共学打卡</h2><button type="button" data-checkin-close>关闭</button></div><p class="checkin-summary"></p><button type="button" data-checkin-start>去完成一轮专注</button><form><label>一句话学习内容<textarea name="message" maxlength="160" rows="2" placeholder="例如：完成一组资料分析，今天的速算顺了很多。" required></textarea></label><p class="checkin-public-hint">提交后，这句话、今日时长和完成轮数会展示给大家。80 字以内；同一浏览器每天计 1 人。</p><button type="submit" class="checkin-submit">提交打卡</button></form><p role="status" aria-live="polite"></p><div class="checkin-list-heading"><h3>今日打卡</h3><button type="button" data-checkin-refresh>刷新</button></div><div class="checkin-list"></div>';
    form = dialog.querySelector('form'); input = form.querySelector('textarea'); feedback = dialog.querySelector('[role="status"]'); localSummary = dialog.querySelector('.checkin-summary'); list = dialog.querySelector('.checkin-list'); listCount = dialog.querySelector('h3'); startButton = dialog.querySelector('[data-checkin-start]'); submitButton = dialog.querySelector('.checkin-submit');
    dialog.querySelector('[data-checkin-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
    dialog.querySelector('[data-checkin-refresh]').addEventListener('click', () => { feedback.textContent = ''; load(); });
    startButton.addEventListener('click', () => {
      opener = null;
      dialog.close();
      document.querySelector('#focusCompanion')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      document.querySelector('#focusSubject')?.focus({ preventScroll: true });
    });
    input.addEventListener('input', () => { input.dataset.edited = 'true'; pendingPayload = null; });
    form.addEventListener('submit', submit);
    document.body.append(dialog); renderList();
  }
  async function open(showList, button) {
    ensureDialog(); opener = button; feedback.textContent = '';
    sync();
    if (!input.value) {
      const value = study(); input.value = own?.message || (value?.items.length ? `今天学习了${value.items.map(item => item.subject).join('、')}，继续加油！` : '');
    }
    dialog.showModal();
    await load();
    if (showList && dialog.open) dialog.querySelector('.checkin-list-heading').scrollIntoView({ block: 'nearest' });
  }
  async function submit(event) {
    event.preventDefault(); if (submitting) return;
    const value = study();
    if (!value || value.completed < 1) { sync(value); feedback.textContent = '请先完成今天的一轮专注。'; return; }
    const message = input.value.trim();
    if (!message || [...message].length > 80) { feedback.textContent = '请填写一句学习内容，最多 80 字。'; input.focus(); return; }
    const subjects = value.items.map(item => item.subject);
    // A round ending exactly at midnight may have no study seconds on the new day.
    if (!subjects.length) subjects.push(document.querySelector('#focusSubject')?.value || '未分类专注');
    submitting = true; ++revision; submitButton.disabled = true; submitButton.textContent = '正在打卡…'; feedback.textContent = '';
    try {
      if (!pendingPayload || pendingPayload.day !== value.date || pendingPayload.message !== message) pendingPayload = { key: storedKey(true), day: value.date, message, focusSeconds: Math.floor(value.totalMs / 1000), completedRounds: value.completed, subjects };
      const data = await request('/api/study-checkins', pendingPayload);
      apply(data); own = { day: data.day, ...data.item };
      pendingPayload = null; delete input.dataset.edited;
      feedback.textContent = data.duplicate ? '今日打卡已更新，人数不会重复增加。' : '打卡成功！今天的努力，大家看见啦。';
    } catch (error) { feedback.textContent = error.message; }
    finally { submitting = false; submitButton.disabled = false; sync(); }
  }
  openButton.addEventListener('click', () => open(false, openButton));
  bar.querySelector('#studyCheckinView').addEventListener('click', event => open(true, event.currentTarget));
  document.addEventListener('squirrel-study-summary', event => sync(event.detail));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  window.addEventListener('storage', event => { if (event.key === keyName || event.key === null) { memoryKey = ''; own = null; if (dialog?.open) load(); } });
  sync(); load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
