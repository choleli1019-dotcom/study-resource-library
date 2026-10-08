(() => {
  const card = document.querySelector('#focusCompanion');
  if (!card) return;
  const STATE_KEY = 'study-squirrel-focus-v1';
  const LOG_KEY = 'study-squirrel-focus-log-v1';
  const presets = { 25: 5, 45: 10, 60: 10 };
  const timer = card.querySelector('#focusTimer');
  const status = card.querySelector('#focusStatus');
  const primary = card.querySelector('#focusPrimary');
  const end = card.querySelector('#focusEnd');
  const stats = card.querySelector('#focusToday');
  const hint = card.querySelector('#focusHint');
  const progress = card.querySelector('#focusProgress');
  const announcement = card.querySelector('#focusAnnouncement');
  const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  let storageAvailable = true, signature = '';
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; } }
  function idle(minutes = 25) { return { version: 1, phase: 'idle', status: 'ready', focusMinutes: minutes, breakMinutes: presets[minutes], remainingMs: minutes * 60000, endAt: null, id: '' }; }
  function restore(value) {
    if (!value || value.version !== 1 || !presets[value.focusMinutes] || !['idle', 'focus', 'break'].includes(value.phase) || !['ready', 'running', 'paused'].includes(value.status)) return idle();
    const maximum = (value.phase === 'break' ? presets[value.focusMinutes] : value.focusMinutes) * 60000;
    if (!Number.isFinite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > maximum || (value.status === 'running' && !Number.isFinite(value.endAt)) || typeof value.id !== 'string' || value.id.length > 100) return idle();
    return { ...value, breakMinutes: presets[value.focusMinutes] };
  }
  let state = restore(read(STATE_KEY));
  function persist() { write(STATE_KEY, state); }
  function entries() { const list = read(LOG_KEY); return Array.isArray(list) ? list.filter(e => e && typeof e.id === 'string' && typeof e.day === 'string' && Number.isFinite(e.minutes) && e.minutes > 0 && e.minutes <= 60) : []; }
  function credit(at) {
    const list = entries();
    if (!list.some(e => e.id === state.id)) {
      list.push({ id: state.id, day: dayFormat.format(new Date(at)), minutes: state.focusMinutes });
      write(LOG_KEY, list.slice(-500));
    }
  }
  function remaining() { return state.status === 'running' ? Math.max(0, state.endAt - Date.now()) : state.remainingMs; }
  function reconcile() {
    if (state.status !== 'running' || state.endAt > Date.now()) return;
    if (state.phase === 'focus') {
      const finishedAt = state.endAt;
      credit(finishedAt);
      state = { ...state, phase: 'break', status: 'running', remainingMs: state.breakMinutes * 60000, endAt: finishedAt + state.breakMinutes * 60000 };
      announcement.textContent = '这一轮专注完成了，松鼠陪你休息一会儿。';
    }
    if (state.phase === 'break' && state.endAt <= Date.now()) {
      state = { ...state, status: 'ready', remainingMs: 0, endAt: null };
      announcement.textContent = '休息结束。准备好了，再开始下一轮。';
    }
    persist();
  }
  function paint() {
    reconcile();
    const ms = remaining(), seconds = Math.ceil(ms / 1000);
    card.querySelector("#focusPlan").textContent = `专注 ${state.focusMinutes} 分钟 / 休息 ${state.breakMinutes} 分钟`;
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const active = state.phase !== 'idle';
    const done = state.phase === 'break' && state.status === 'ready';
    const paused = state.status === 'paused';
    const phaseLabel = state.phase === 'break' ? '休息' : '专注';
    status.textContent = !active ? '准备好，我们一起学一会儿' : done ? '休息结束，准备好再出发' : paused ? `${phaseLabel}已暂停，等你回来` : state.phase === 'focus' ? '你认真学，我陪你看书' : '伸个懒腰，喝口热茶';
    primary.textContent = !active ? '开始专注' : done ? '再学一轮' : paused ? '继续' + phaseLabel : '暂停' + phaseLabel;
    end.disabled = !active;
    card.dataset.phase = state.phase;
    card.dataset.status = state.status;
    const total = (state.phase === 'break' ? state.breakMinutes : state.focusMinutes) * 60000;
    const percent = active ? Math.round(100 * (1 - Math.min(ms, total) / total)) : 0;
    progress.style.setProperty('--focus-progress', `${percent}%`);
    progress.setAttribute('aria-valuenow', String(percent));
    progress.setAttribute('aria-label', phaseLabel + '进度');
    for (const button of card.querySelectorAll('[data-focus-minutes]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.focusMinutes) === state.focusMinutes));
      button.disabled = active && !done;
    }
    const today = entries().filter(e => e.day === dayFormat.format(new Date()));
    stats.textContent = `今天完成 ${today.length} 轮 · ${today.reduce((sum, e) => sum + e.minutes, 0)} 分钟专注`;
    card.dataset.storageUnavailable = String(!storageAvailable);
    hint.textContent = storageAvailable ? '刷新可继续计时；休息结束后由你开启下一轮。' : '此浏览器无法保存计时，离开页面后进度不会保留。';
    const nextSignature = `${state.phase}:${state.status}`;
    if (signature !== nextSignature) {
      signature = nextSignature;
      const view = !active ? 'idle' : paused ? 'paused' : state.phase;
      document.body.dataset.squirrelStudy = view;
      document.body.dataset.squirrelStudyPhase = state.phase;
      document.dispatchEvent(new CustomEvent('squirrel-study-state', { detail: { phase: state.phase, status: state.status, text: status.textContent, active } }));
    }
  }
  primary.addEventListener('click', () => {
    reconcile();
    if (state.phase === 'idle' || (state.phase === 'break' && state.status === 'ready')) {
      state = { ...idle(state.focusMinutes), phase: 'focus', status: 'running', endAt: Date.now() + state.focusMinutes * 60000, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      announcement.textContent = '专注开始，松鼠陪你看书。';
    } else if (state.status === 'running') {
      state = { ...state, status: 'paused', remainingMs: remaining(), endAt: null };
      announcement.textContent = '计时已暂停。';
    } else {
      state = { ...state, status: 'running', endAt: Date.now() + state.remainingMs };
      announcement.textContent = '计时继续。';
    }
    persist(); paint();
  });
  end.addEventListener('click', () => {
    reconcile(); state = idle(state.focusMinutes); persist();
    announcement.textContent = '本轮计时已结束。'; paint();
  });
  for (const button of card.querySelectorAll('[data-focus-minutes]')) button.addEventListener('click', () => {
    if (button.disabled) return;
    state = idle(Number(button.dataset.focusMinutes)); persist(); paint();
  });
  document.querySelector('#resourceSquirrelFocus')?.addEventListener('click', () => {
    document.querySelector('.resource-squirrel-close')?.click();
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    if (state.phase === 'idle') primary.click();
    primary.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
  window.addEventListener('pageshow', paint);
  window.addEventListener('storage', event => {
    if (event.key === STATE_KEY || event.key === null) state = restore(read(STATE_KEY));
    if ([STATE_KEY, LOG_KEY, null].includes(event.key)) paint();
  });
  paint(); setInterval(paint, 1000);
})();



