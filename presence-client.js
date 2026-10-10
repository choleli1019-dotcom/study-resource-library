(() => {
  const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
  const visitorKey = 'study-resource-visitor-id', cacheKey = 'study-resource-presence-snapshot-v1';
  const heartbeatMs = 25000, timeoutMs = 15000, snapshotMaxAge = 150000;
  const retryDelays = [2500, 7000, 15000, 25000];
  let visitorId = '', focusProvider = null, started = false, sending = false, queued = false, forceQueued = false;
  let revision = 0, timer = 0, retryIndex = 0, controller = null, lastSnapshot = null, receivedAt = 0;
  function getVisitorId() {
    if (visitorId) return visitorId;
    try { const saved = localStorage.getItem(visitorKey); if (/^[a-zA-Z0-9_-]{8,100}$/.test(saved || '')) return visitorId = saved; } catch (_) { /* Presence still works without browser storage. */ }
    visitorId = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    visitorId = visitorId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
    try { localStorage.setItem(visitorKey, visitorId); } catch (_) { /* Keep the same id in memory for this page. */ }
    return visitorId;
  }
  function validSnapshot(data) {
    return data?.ok === true && Number.isSafeInteger(data.onlineCount) && data.onlineCount >= 0 && Number.isSafeInteger(data.focusCount) && data.focusCount >= 0 && Number.isFinite(Date.parse(data.updatedAt));
  }
  function focusState() {
    if (!focusProvider) return null;
    try {
      const value = focusProvider();
      const active = value?.active === true && Number.isFinite(value.remainingMs) && value.remainingMs > 0;
      return { active, remainingMs: active ? Math.min(3600000, Math.ceil(value.remainingMs)) : 0 };
    } catch (_) { return null; }
  }
  function render(fresh = false) {
    const site = document.querySelector('#siteGlobalOnline'), peers = document.querySelector('#focusPresence');
    const known = lastSnapshot && Date.now() - receivedAt >= 0 && Date.now() - receivedAt <= snapshotMaxAge;
    const state = fresh && known ? 'fresh' : 'reconnecting';
    if (site) site.textContent = known ? `${lastSnapshot.onlineCount} 人在线${fresh ? '' : ' · 更新中'}` : '人数正在连接…';
    if (peers) peers.textContent = known ? fresh ? `此刻 ${lastSnapshot.focusCount} 人一起专注` : `上次 ${lastSnapshot.focusCount} 人专注 · 重连中` : '陪学人数正在连接…';
    for (const element of [site, peers].filter(Boolean)) {
      element.dataset.presenceState = state;
      element.title = known ? `${fresh ? '最近更新' : '正在重连，显示上次结果'}：${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(lastSnapshot.updatedAt))}` : '网络恢复后会自动更新人数';
    }
  }
  function schedule(delay) { clearTimeout(timer); timer = setTimeout(() => refresh(), delay); }
  async function flush() {
    if (!started || sending || !base) return;
    sending = true;
    while (queued) {
      queued = false;
      const force = forceQueued; forceQueued = false;
      const focus = focusState();
      if (navigator.onLine === false || (document.hidden && !focus?.active && !force)) {
        render(false); schedule(heartbeatMs); break;
      }
      const ticket = revision;
      const payload = { visitorId: getVisitorId(), ...(focus || {}) };
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let nextDelay = heartbeatMs;
      try {
        // A simple text/plain POST avoids an extra CORS preflight round trip.
        // Heartbeats do not use keepalive: browsers share a small keepalive quota.
        const response = await fetch(`${base}/api/presence`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !validSnapshot(data)) throw new Error('Invalid presence response');
        if (ticket === revision) {
          lastSnapshot = data; receivedAt = Date.now(); retryIndex = 0;
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ data, receivedAt })); } catch (_) { /* The live result remains usable in memory. */ }
          render(true);
        }
      } catch (_) {
        if (ticket === revision) { render(false); nextDelay = retryDelays[Math.min(retryIndex++, retryDelays.length - 1)]; }
      } finally { clearTimeout(timeout); controller = null; }
      if (!queued) schedule(nextDelay);
    }
    sending = false;
  }
  function refresh(force = false) {
    clearTimeout(timer); queued = true; forceQueued ||= force; revision++;
    if (started) flush();
  }
  function start() {
    if (started) return;
    started = true;
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (validSnapshot(cached?.data) && Number.isFinite(cached.receivedAt) && Date.now() - cached.receivedAt >= 0 && Date.now() - cached.receivedAt <= snapshotMaxAge) { lastSnapshot = cached.data; receivedAt = cached.receivedAt; }
    } catch (_) { /* A first visit starts without a guessed count. */ }
    render(false); refresh(true);
  }
  window.STUDY_PRESENCE = {
    getVisitorId,
    start,
    refresh: () => refresh(true),
    setFocusProvider(provider) { focusProvider = typeof provider === 'function' ? provider : null; start(); refresh(true); }
  };
  window.addEventListener('online', () => refresh(true));
  window.addEventListener('offline', () => { controller?.abort(); render(false); schedule(heartbeatMs); });
  window.addEventListener('pageshow', () => { if (started) refresh(true); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  start();
})();
