(() => {
  const bar = document.querySelector('#studyCheckinBar');
  if (!bar) return;
  const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
  const keyName = 'study-squirrel-checkin-key-v1';
  const nicknameKey = 'study-squirrel-checkin-nickname-v1';
  const count = bar.querySelector('#studyCheckinCount'), latest = bar.querySelector('#studyCheckinLatest'), meta = bar.querySelector('#studyCheckinMeta'), openButton = bar.querySelector('#studyCheckinOpen');
  const time = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let snapshot = null, own = null, revision = 0, submitting = false, savingName = false, withdrawing = false, memoryKey = '', memoryNickname = '', rolloverDay = '', pendingPayload = null, dialog, form, input, feedback, localSummary, list, listCount, startButton, submitButton, withdrawButton, opener, nicknameInput, nicknameForm, nicknameFeedback, nicknameSave;
  function normalizeNickname(value) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if ([...name].length > 12) throw new Error('网名最多 12 字。');
    return name || '学习伙伴';
  }
  function readNickname() {
    if (memoryNickname) return memoryNickname;
    try { const value = localStorage.getItem(nicknameKey); if (value) memoryNickname = normalizeNickname(value); } catch (_) { /* Keep a usable default when storage is unavailable. */ }
    return memoryNickname;
  }
  function rememberNickname(name) {
    memoryNickname = name;
    try { localStorage.setItem(nicknameKey, name); return true; } catch (_) { return false; }
  }
  function nameBusy() {
    nicknameSave.disabled = nicknameInput.disabled = submitButton.disabled = withdrawButton.disabled = input.disabled = submitting || savingName || withdrawing;
  }
  function study() { return typeof window.getSquirrelStudySummary === 'function' ? window.getSquirrelStudySummary() : null; }
  function submissionStudy(value = study()) {
    if (value?.completed > 0) return value;
    if (value && own?.day === value.date && own.completedRounds > 0) return { ...value, totalMs: own.focusSeconds * 1000, completed: own.completedRounds, items: own.subjects.map(subject => ({ subject, ms: 0 })) };
    return value;
  }
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
      if (!response.ok || !data.ok) { const error = new Error(data.error || '打卡连接失败，请稍后再试'); error.status = response.status; throw error; }
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
    latest.textContent = item ? `${item.nickname || '学习伙伴'}：${item.message}` : '一起学一点，离上岸近一点。';
    meta.textContent = item ? `${item.subjects.join('、')} · ${Math.floor(item.focusSeconds / 60)} 分钟 · 完成 ${item.completedRounds} 轮 · ${time.format(new Date(item.updatedAt))}` : '完成专注后，留一句今天学了什么。';
    renderList();
  }
  async function load() {
    if (submitting || savingName || withdrawing) return;
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
    if (!readNickname() && own?.nickname) rememberNickname(normalizeNickname(own.nickname));
    if (nicknameInput && !nicknameInput.dataset.edited) nicknameInput.value = readNickname();
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
      const author = document.createElement('strong'); author.className = 'checkin-entry-author'; author.textContent = item.nickname || '学习伙伴';
      const message = document.createElement('p'); message.textContent = item.message;
      const detail = document.createElement('small'); detail.textContent = `${item.subjects.join('、')} · 专注 ${Math.floor(item.focusSeconds / 60)} 分钟 · 完成 ${item.completedRounds} 轮 · ${time.format(new Date(item.updatedAt))}`;
      article.append(author, message, detail); list.append(article);
    }
  }
  function sync(value = study()) {
    if (!value) return;
    if (own?.day !== value.date) own = null;
    if (snapshot && snapshot.day !== value.date) {
      snapshot = null; count.textContent = '新的一天，正在读取打卡…'; latest.textContent = '一起学一点，离上岸近一点。'; meta.textContent = '完成专注后，留一句今天学了什么。';
      if (rolloverDay !== value.date) { rolloverDay = value.date; load(); }
    }
    openButton.textContent = own?.status === 'visible' ? '更新打卡' : own ? '重新打卡' : '我要打卡';
    if (!dialog || submitting || savingName || withdrawing) return;
    const current = submissionStudy(value), eligible = current.completed > 0;
    const notice = own?.status === 'hidden' ? '此前打卡已隐藏，可修改后重新提交。' : own?.status === 'withdrawn' ? '此前打卡已撤回，可继续编辑并重新提交。' : '';
    localSummary.textContent = `${notice}今天已记录 ${Math.floor(current.totalMs / 60000)} 分钟专注，完成 ${current.completed} 轮。${eligible ? '可以多次更新，不重复计人数。' : '完成今天至少一轮专注后，就能来打卡。'}`;
    form.hidden = !eligible; startButton.hidden = eligible;
    submitButton.textContent = own?.status === 'visible' ? '保存更新' : own ? '重新打卡' : '提交打卡';
    withdrawButton.hidden = own?.status !== 'visible';
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'study-checkin-dialog'; dialog.setAttribute('aria-labelledby', 'studyCheckinDialogTitle');
    dialog.innerHTML = '<div class="checkin-dialog-heading"><h2 id="studyCheckinDialogTitle">群友共学打卡</h2><button type="button" data-checkin-close>关闭</button></div><form class="checkin-nickname-form"><label>你的网名<input name="nickname" maxlength="24" placeholder="例如：早日上岸的小松鼠" autocomplete="nickname" aria-describedby="checkinNicknameHint"></label><button type="submit" class="checkin-nickname-save">保存网名</button><small id="checkinNicknameHint">最多 12 字，留空显示“学习伙伴”。保存后每天自动带入，可随时修改。</small><p class="checkin-nickname-feedback" role="status" aria-live="polite"></p></form><p class="checkin-summary"></p><button type="button" data-checkin-start>去完成一轮专注</button><form class="checkin-study-form"><label>一句话学习内容<textarea name="message" maxlength="160" rows="2" placeholder="例如：完成一组资料分析，今天的速算顺了很多。" required></textarea></label><p class="checkin-public-hint">网名、这句话、今日时长和完成轮数会展示给大家。80 字以内；可多次更新、撤回后重新提交，每天最多计 1 人。</p><div class="checkin-actions"><button type="submit" class="checkin-submit">提交打卡</button><button type="button" class="checkin-withdraw" hidden>撤回打卡</button></div></form><p class="checkin-submit-feedback" role="status" aria-live="polite"></p><div class="checkin-list-heading"><h3>今日打卡</h3><button type="button" data-checkin-refresh>刷新</button></div><div class="checkin-list"></div>';
    form = dialog.querySelector('.checkin-study-form'); input = form.querySelector('textarea'); feedback = dialog.querySelector('.checkin-submit-feedback'); localSummary = dialog.querySelector('.checkin-summary'); list = dialog.querySelector('.checkin-list'); listCount = dialog.querySelector('h3'); startButton = dialog.querySelector('[data-checkin-start]'); submitButton = dialog.querySelector('.checkin-submit');
    nicknameForm = dialog.querySelector('.checkin-nickname-form'); nicknameInput = nicknameForm.querySelector('input'); nicknameFeedback = dialog.querySelector('.checkin-nickname-feedback'); nicknameSave = dialog.querySelector('.checkin-nickname-save');
    withdrawButton = dialog.querySelector('.checkin-withdraw'); withdrawButton.addEventListener('click', withdraw);
    nicknameInput.value = readNickname();
    nicknameInput.addEventListener('input', () => { nicknameInput.dataset.edited = 'true'; pendingPayload = null; });
    nicknameForm.addEventListener('submit', saveNickname);
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
  async function saveNickname(event) {
    event.preventDefault(); if (submitting || savingName || withdrawing) return;
    let name;
    try { name = normalizeNickname(nicknameInput.value); }
    catch (error) { nicknameFeedback.textContent = error.message; nicknameInput.focus(); return; }
    const persisted = rememberNickname(name);
    nicknameInput.value = name; delete nicknameInput.dataset.edited; pendingPayload = null;
    nicknameFeedback.textContent = persisted ? '网名已保存，以后每天自动带入。' : '此浏览器无法保存网名，本次打开期间仍可使用。';
    const key = storedKey();
    if (!key) return;
    savingName = true; ++revision; nameBusy();
    try {
      const data = await request('/api/study-checkins/profile', { key, nickname: name });
      apply(data); own = data.item ? { day: data.day, ...data.item } : null;
      if (persisted && own) nicknameFeedback.textContent = '网名已保存，今日打卡也已更新；以后每天自动带入。';
    } catch (error) { nicknameFeedback.textContent = `${persisted ? '网名已在本机保存' : '网名仅在本次打开期间保留'}，暂无法确认今日展示，请重试保存。${error.message}`; }
    finally { savingName = false; nameBusy(); sync(); }
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
  async function refreshConflict(error) {
    if (error.status !== 409) return;
    pendingPayload = null;
    try { const ticket = ++revision; apply(await request('/api/study-checkins')); await loadMine(ticket); } catch (_) { /* Keep the original error and the user's text for retry. */ }
  }
  async function withdraw() {
    if (submitting || savingName || withdrawing || !own) return;
    withdrawing = true; ++revision; pendingPayload = null; nameBusy(); withdrawButton.textContent = '正在撤回…'; feedback.textContent = '';
    try {
      const data = await request('/api/study-checkins/withdraw', { key: storedKey(), day: own.day, expectedRevision: own.revision || 0 });
      apply(data); own = data.item ? { day: data.day, ...data.item } : null;
      feedback.textContent = '已撤回，不再计入今日人数。内容和网名已保留，学完后可重新打卡。';
    } catch (error) { feedback.textContent = error.message; await refreshConflict(error); }
    finally { withdrawing = false; withdrawButton.textContent = '撤回打卡'; nameBusy(); sync(); }
  }
  async function submit(event) {
    event.preventDefault(); if (submitting || savingName || withdrawing) return;
    const value = submissionStudy();
    if (!value || value.completed < 1) { sync(value); feedback.textContent = '请先完成今天的一轮专注。'; return; }
    const message = input.value.trim();
    if (!message || [...message].length > 80) { feedback.textContent = '请填写一句学习内容，最多 80 字。'; input.focus(); return; }
    let nickname;
    try { nickname = normalizeNickname(nicknameInput.value); }
    catch (error) { nicknameFeedback.textContent = error.message; nicknameInput.focus(); return; }
    const nicknamePersisted = rememberNickname(nickname);
    nicknameInput.value = nickname; delete nicknameInput.dataset.edited;
    if (!nicknamePersisted) nicknameFeedback.textContent = '此浏览器无法保存网名，本次打开期间仍可使用。';
    const subjects = value.items.map(item => item.subject);
    // A round ending exactly at midnight may have no study seconds on the new day.
    if (!subjects.length) subjects.push(document.querySelector('#focusSubject')?.value || '未分类专注');
    submitting = true; ++revision; nameBusy(); submitButton.textContent = '正在打卡…'; feedback.textContent = '';
    try {
      if (!pendingPayload || pendingPayload.day !== value.date || pendingPayload.message !== message || pendingPayload.nickname !== nickname) pendingPayload = { key: storedKey(true), nickname, day: value.date, message, focusSeconds: Math.floor(value.totalMs / 1000), completedRounds: value.completed, subjects, expectedRevision: own?.revision || 0, resubmit: Boolean(own && own.status !== 'visible') };
      const data = await request('/api/study-checkins', pendingPayload);
      apply(data); own = { day: data.day, ...data.item };
      pendingPayload = null; delete input.dataset.edited;
      feedback.textContent = data.reopened ? '重新打卡成功，今日仍只计 1 人。' : data.duplicate ? '今日打卡已更新，人数不会重复增加。' : '打卡成功！今天的努力，大家看见啦。';
    } catch (error) { feedback.textContent = error.message; await refreshConflict(error); }
    finally { submitting = false; nameBusy(); sync(); }
  }
  openButton.addEventListener('click', () => open(false, openButton));
  bar.querySelector('#studyCheckinView').addEventListener('click', event => open(true, event.currentTarget));
  document.addEventListener('squirrel-study-summary', event => sync(event.detail));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  window.addEventListener('storage', event => {
    if (event.key === nicknameKey || event.key === null) {
      memoryNickname = '';
      if (nicknameInput && !nicknameInput.dataset.edited) nicknameInput.value = readNickname();
      pendingPayload = null;
    }
    if (event.key === keyName || event.key === null) { memoryKey = ''; own = null; if (dialog?.open) load(); }
  });
  sync(); load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
