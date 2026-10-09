(() => {
  const card = document.querySelector('#focusCompanion');
  if (!card) return;
  const STATE_KEY = 'study-squirrel-focus-v1';
  const LEGACY_LOG_KEY = 'study-squirrel-focus-log-v1';
  const LOG_KEY = 'study-squirrel-focus-log-v2';
  const presets = { 25: 5, 45: 10, 60: 10 };
  const subjects = { '言语理解': 25, '资料分析': 45, '数量关系': 45, '逻辑判断': 25, '申论小作文': 45, '申论大作文': 60, '常识政治': 25, '早自习': 25 };
  const legacySubject = '未分类专注';
  const subjectInput = card.querySelector('#focusSubject');
  const subjectHint = card.querySelector('#focusSubjectHint');
  const todayDetails = card.querySelector('#focusTodayDetails');
  const exportButton = card.querySelector('#focusExport');
  const timer = card.querySelector('#focusTimer');
  const status = card.querySelector('#focusStatus');
  const primary = card.querySelector('#focusPrimary');
  const end = card.querySelector('#focusEnd');
  const stats = card.querySelector('#focusToday');
  const hint = card.querySelector('#focusHint');
  const progress = card.querySelector('#focusProgress');
  const announcement = card.querySelector('#focusAnnouncement');
  const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  let storageAvailable = true, signature = '', studySignature = '';
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
  // Keep a usable in-memory copy if browser storage is unavailable.
  const memory = new Map();
  function saved(key) { return memory.has(key) ? memory.get(key) : read(key); }
  function write(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; }
  }
  function idle(minutes = 25, subject = '') { return { version: 2, phase: 'idle', status: 'ready', subject, focusMinutes: minutes, breakMinutes: presets[minutes], remainingMs: minutes * 60000, endAt: null, runningSince: null, segments: [], id: '' }; }
  function validSegments(value) {
    return Array.isArray(value) ? value.filter(s => Array.isArray(s) && s.length === 2 && Number.isSafeInteger(s[0]) && Number.isSafeInteger(s[1]) && s[0] >= 0 && s[1] <= 8640000000000000 && s[1] > s[0] && s[1] - s[0] <= 60 * 60000).map(s => [s[0], s[1]]) : [];
  }
  function restore(value) {
    if (!value || ![1, 2].includes(value.version) || !presets[value.focusMinutes] || !['idle', 'focus', 'break'].includes(value.phase) || !['ready', 'running', 'paused'].includes(value.status)) return idle();
    const maximum = (value.phase === 'break' ? presets[value.focusMinutes] : value.focusMinutes) * 60000;
    if (!Number.isFinite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > maximum || (value.status === 'running' && !Number.isFinite(value.endAt)) || typeof value.id !== 'string' || value.id.length > 100) return idle();
    const restored = { ...idle(value.focusMinutes), ...value, version: 2, breakMinutes: presets[value.focusMinutes], subject: Object.hasOwn(subjects, value.subject) || value.subject === legacySubject ? value.subject : value.phase === 'idle' ? '' : legacySubject, segments: validSegments(value.segments) };
    if (value.version === 1 && value.phase === 'focus') {
      const lastStart = value.status === 'running' ? value.endAt - value.remainingMs : Date.now();
      const elapsed = value.focusMinutes * 60000 - value.remainingMs;
      restored.segments = elapsed > 0 ? [[lastStart - elapsed, lastStart]] : [];
      restored.runningSince = value.status === 'running' ? lastStart : null;
    } else if (value.phase === 'focus' && value.status === 'running') {
      restored.runningSince = Number.isFinite(value.runningSince) && value.runningSince <= value.endAt ? Math.max(value.runningSince, value.endAt - value.remainingMs) : value.endAt - value.remainingMs;
    } else restored.runningSince = null;
    return restored;
  }
  let state = restore(read(STATE_KEY));
  if (read(STATE_KEY)?.version === 1) write(STATE_KEY, state);
  const peers = card.querySelector('#focusPresence');
  const presenceApi = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
  const existingId = typeof getVisitorId === 'function' ? getVisitorId() : '';
  const presenceId = (existingId || `focus-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '-');
  let pendingPresence = null, sendingPresence = false, presenceRevision = 0;
  async function flushPresence() {
    if (sendingPresence || !presenceApi || !peers) return;
    sendingPresence = true;
    while (pendingPresence) {
      const request = pendingPresence;
      pendingPresence = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`${presenceApi}/api/focus-presence`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.payload), cache: 'no-store', keepalive: true, signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.ok || !Number.isSafeInteger(data.focusCount) || data.focusCount < 0) throw new Error('Count unavailable');
        if (request.revision === presenceRevision) peers.textContent = `此刻 ${data.focusCount} 人一起专注`;
      } catch {
        if (request.revision === presenceRevision) peers.textContent = '陪学人数暂不可用';
      } finally { clearTimeout(timeout); }
    }
    sendingPresence = false;
  }
  function refreshPresence() {
    if (!peers) return;
    if (!presenceApi) { peers.textContent = '陪学人数暂不可用'; return; }
    const active = state.phase === 'focus' && state.status === 'running' && remaining() > 0;
    pendingPresence = { revision: ++presenceRevision, payload: { visitorId: presenceId, active, remainingMs: active ? remaining() : 0 } };
    flushPresence();
  }
  function persist() { write(STATE_KEY, state); }
  function entries() {
    const list = saved(LOG_KEY);
    return Array.isArray(list) ? list.filter(e => e && typeof e.id === 'string' && (Object.hasOwn(subjects, e.subject) || e.subject === legacySubject)).map(e => ({ ...e, segments: validSegments(e.segments) })) : [];
  }
  function closeFocus(at) {
    if (state.phase === 'focus' && Number.isFinite(state.runningSince)) {
      const finish = Math.min(at, state.endAt);
      if (finish > state.runningSince) state.segments.push([state.runningSince, finish]);
      state.runningSince = null;
    }
  }
  function record(completed = false, at = Date.now()) {
    if (!state.id || !state.segments.length) return;
    const list = entries();
    const existing = list.findIndex(e => e.id === state.id);
    const entry = { id: state.id, subject: state.subject || legacySubject, segments: state.segments.map(s => [...s]), completed: completed || Boolean(list[existing]?.completed), completedAt: completed ? at : list[existing]?.completedAt || null };
    if (existing < 0) list.push(entry); else list[existing] = entry;
    write(LOG_KEY, list);
  }
  function day(at) { return dayFormat.format(new Date(at)); }
  function nextMidnight(at) {
    const parts = Object.fromEntries(dayFormat.formatToParts(new Date(at)).map(p => [p.type, p.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1) - 8 * 3600000;
  }
  function summary(now = Date.now()) {
    const date = day(now), totals = new Map();
    let completed = 0;
    const list = entries();
    if (state.phase === 'focus' && state.id) {
      const segments = state.segments.map(s => [...s]);
      if (state.status === 'running' && Number.isFinite(state.runningSince) && now > state.runningSince) segments.push([state.runningSince, Math.min(now, state.endAt)]);
      const active = { id: state.id, subject: state.subject || legacySubject, segments, completed: false };
      const index = list.findIndex(e => e.id === state.id);
      if (index < 0) list.push(active); else list[index] = active;
    }
    for (const entry of list) {
      if (entry.completed && day(entry.completedAt) === date) completed++;
      for (const segment of entry.segments) {
        let start = segment[0];
        while (start < segment[1]) {
          const end = Math.min(segment[1], nextMidnight(start));
          if (day(start) === date) totals.set(entry.subject, (totals.get(entry.subject) || 0) + end - start);
          start = end;
        }
      }
    }
    // Older completed rounds keep their original date, without guessing a subject.
    const legacy = read(LEGACY_LOG_KEY);
    const ids = new Set(list.map(e => e.id));
    for (const e of Array.isArray(legacy) ? legacy : []) {
      if (e && typeof e.id === 'string' && !ids.has(e.id) && e.day === date && Number.isFinite(e.minutes) && e.minutes > 0 && e.minutes <= 60) {
        ids.add(e.id); completed++; totals.set(legacySubject, (totals.get(legacySubject) || 0) + e.minutes * 60000);
      }
    }
    const items = [...Object.keys(subjects), legacySubject].filter(subject => totals.has(subject)).map(subject => ({ subject, ms: totals.get(subject) }));
    return { date, generatedAt: now, completed, items, totalMs: items.reduce((sum, item) => sum + item.ms, 0), active: state.phase === 'focus' && state.status === 'running' };
  }
  function duration(ms) {
    const seconds = Math.floor(ms / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
    return [hours ? `${hours} 小时` : '', minutes ? `${minutes} 分钟` : '', seconds % 60 ? `${seconds % 60} 秒` : ''].filter(Boolean).join(' ') || '0 分钟';
  }
  function remaining() { return state.status === 'running' ? Math.max(0, state.endAt - Date.now()) : state.remainingMs; }
  function reconcile() {
    if (state.status !== 'running' || state.endAt > Date.now()) return;
    if (state.phase === 'focus') {
      const finishedAt = state.endAt;
      closeFocus(finishedAt); record(true, finishedAt);
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
    const done = state.phase === 'break' && state.status === 'ready';
    const locked = state.phase !== 'idle' && !done;
    subjectInput.value = state.subject;
    subjectInput.disabled = locked;
    subjectHint.textContent = locked ? `本轮：${state.subject} · 结束后可切换内容` : '先选学习内容，再选专注时长（分钟 / 休息）。';
    card.querySelector("#focusPlan").textContent = `专注 ${state.focusMinutes} 分钟 / 休息 ${state.breakMinutes} 分钟`;
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const active = state.phase !== 'idle';
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
    const today = summary();
    stats.textContent = `今日 ${duration(today.totalMs)} · 完成 ${today.completed} 轮`;
    const nextStudySignature = `${today.date}:${today.completed}:${Math.floor(today.totalMs / 60000)}:${today.items.map(item => item.subject).join(',')}`;
    if (studySignature !== nextStudySignature) {
      studySignature = nextStudySignature;
      document.dispatchEvent(new CustomEvent('squirrel-study-summary', { detail: today }));
    }
    const detailSignature = today.items.map(item => `${item.subject}:${duration(item.ms)}`).join('|');
    if (todayDetails.dataset.signature !== detailSignature) {
      todayDetails.dataset.signature = detailSignature;
      todayDetails.replaceChildren();
      for (const item of today.items) {
        const tag = document.createElement('span');
        tag.textContent = `${item.subject} ${duration(item.ms)}`;
        todayDetails.append(tag);
      }
    }
    card.dataset.storageUnavailable = String(!storageAvailable);
    hint.textContent = storageAvailable ? '记录保存在此浏览器；暂停、休息不计时，结束也保留已学时长。' : '此浏览器无法保存记录，请在离开页面前导出今日卡片。';
    const nextSignature = `${state.phase}:${state.status}`;
    if (signature !== nextSignature) {
      signature = nextSignature;
      refreshPresence();
      const view = !active ? 'idle' : paused ? 'paused' : state.phase;
      document.body.dataset.squirrelStudy = view;
      document.body.dataset.squirrelStudyPhase = state.phase;
      document.dispatchEvent(new CustomEvent('squirrel-study-state', { detail: { phase: state.phase, status: state.status, text: status.textContent, active } }));
    }
  }
  primary.addEventListener('click', () => {
    state = restore(saved(STATE_KEY) || state);
    reconcile();
    if (state.phase === 'idle' || (state.phase === 'break' && state.status === 'ready')) {
      if (!Object.hasOwn(subjects, state.subject)) {
        announcement.textContent = '请先选择学习内容。'; subjectInput.focus(); return;
      }
      const now = Date.now();
      state = { ...idle(state.focusMinutes, state.subject), phase: 'focus', status: 'running', runningSince: now, endAt: now + state.focusMinutes * 60000, id: `${now}-${Math.random().toString(36).slice(2)}` };
      announcement.textContent = `${state.subject}专注开始，松鼠陪你看书。`;
    } else if (state.status === 'running') {
      const ms = remaining();
      if (state.phase === 'focus') { closeFocus(Date.now()); record(); }
      state = { ...state, status: 'paused', remainingMs: ms, endAt: null };
      announcement.textContent = '计时已暂停。';
    } else {
      state = { ...state, status: 'running', runningSince: state.phase === 'focus' ? Date.now() : null, endAt: Date.now() + state.remainingMs };
      announcement.textContent = '计时继续。';
    }
    persist(); paint();
  });
  end.addEventListener('click', () => {
    state = restore(saved(STATE_KEY) || state);
    reconcile();
    if (state.phase === 'focus') { closeFocus(Date.now()); record(); }
    state = idle(state.focusMinutes, state.subject); persist();
    announcement.textContent = '本轮已结束，已学习的时长已计入今日记录。'; paint();
  });
  subjectInput.addEventListener('change', () => {
    if (subjectInput.disabled) return;
    const subject = subjectInput.value;
    state = idle(subjects[subject] || 25, subject); persist(); paint();
  });
  for (const button of card.querySelectorAll('[data-focus-minutes]')) button.addEventListener('click', () => {
    if (button.disabled) return;
    state = idle(Number(button.dataset.focusMinutes), state.subject); persist(); paint();
  });
  exportButton.addEventListener('click', async () => {
    paint();
    exportButton.disabled = true;
    exportButton.textContent = '正在生成…';
    try { await window.exportSquirrelStudyCard(summary()); }
    catch { announcement.textContent = '卡片生成失败，请重试。'; exportButton.textContent = '生成失败，点击重试'; }
    finally { exportButton.disabled = false; if (exportButton.textContent === '正在生成…') exportButton.textContent = '导出今日学习卡片'; }
  });
  document.querySelector('#resourceSquirrelFocus')?.addEventListener('click', () => {
    document.querySelector('.resource-squirrel-close')?.click();
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    if (state.phase === 'idle' && Object.hasOwn(subjects, state.subject)) primary.click();
    (state.subject ? primary : subjectInput).focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { paint(); refreshPresence(); } });
  window.addEventListener('pageshow', paint);
  window.addEventListener('storage', event => {
    if (event.key === null) memory.clear(); else memory.delete(event.key);
    if (event.key === STATE_KEY || event.key === null) state = restore(read(STATE_KEY));
    if ([STATE_KEY, LOG_KEY, LEGACY_LOG_KEY, null].includes(event.key)) paint();
  });
  window.getSquirrelStudySummary = () => { paint(); return summary(); };
  paint(); setInterval(paint, 1000);
  setInterval(() => { if (!document.hidden || (state.phase === "focus" && state.status === "running")) refreshPresence(); }, 25000);
})();




