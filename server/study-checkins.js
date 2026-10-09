const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function studyCheckins(dataDir, clock = () => Date.now()) {
  const file = path.join(dataDir, 'study-checkins.json');
  const subjects = new Set(['言语理解', '资料分析', '数量关系', '逻辑判断', '申论小作文', '申论大作文', '常识政治', '早自习', '未分类专注']);
  const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = at => dayFormatter.format(new Date(at));
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  function keyHash(key) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('打卡凭证无效，请刷新后重试');
    return hash(key);
  }
  function read() {
    try {
      const items = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(items)) throw new Error('Invalid check-in data');
      return items;
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  function write(items) {
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(items, null, 2)); fs.renameSync(temporary, file);
  }
  function normalizeNickname(value, fallback = '学习伙伴') {
    if (value === undefined) return fallback;
    if (typeof value !== 'string') throw new Error('网名需为文字，最多 12 字');
    const name = value.trim().replace(/\s+/g, ' ');
    if ([...name].length > 12) throw new Error('网名最多 12 字');
    return name || '学习伙伴';
  }
  const publicItem = item => ({ nickname: item.nickname || '学习伙伴', message: item.message, subjects: item.subjects, focusSeconds: item.focusSeconds, completedRounds: item.completedRounds, createdAt: item.createdAt, updatedAt: item.updatedAt });
  const itemRevision = item => Number.isSafeInteger(item?.revision) && item.revision >= 0 ? item.revision : 0;
  const ownItem = item => ({ ...publicItem(item), status: item.status, revision: itemRevision(item) });
  function conflict(message) { const error = new Error(message); error.status = 409; return error; }
  function checkRevision(raw, item) {
    if (raw.expectedRevision !== undefined && raw.expectedRevision !== itemRevision(item)) throw conflict('这条打卡已在其他页面更新，请刷新后再操作');
  }
  function snapshot(at = clock(), items = read()) {
    const today = items.filter(item => item.day === day(at) && item.status === 'visible');
    today.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return { day: day(at), count: today.length, items: today.slice(0, 50).map(publicItem) };
  }
  function mine(key, at = clock()) {
    const ownerHash = keyHash(key);
    const item = read().find(item => item.day === day(at) && item.ownerHash === ownerHash);
    return { day: day(at), item: item ? ownItem(item) : null };
  }
  function submit(raw, source) {
    const ownerHash = keyHash(raw?.key), now = clock(), date = day(now);
    if (raw.day !== date) throw new Error('日期已更新，请刷新今日记录后打卡');
    if (!Number.isSafeInteger(raw.completedRounds) || raw.completedRounds < 1 || raw.completedRounds > 100 || !Number.isSafeInteger(raw.focusSeconds) || raw.focusSeconds < 0 || raw.focusSeconds > 86400) throw new Error('请先完成今天的一轮专注，再来打卡');
    if (typeof raw.message !== 'string' || !raw.message.trim() || [...raw.message.trim()].length > 80) throw new Error('请填写一句学习内容，最多 80 字');
    const message = raw.message.trim().replace(/\s+/g, ' ');
    if (!Array.isArray(raw.subjects) || raw.subjects.length > 9 || !raw.subjects.length || raw.subjects.some(value => !subjects.has(value))) throw new Error('学习内容无效，请重新选择');
    const selected = [...new Set(raw.subjects)];
    const items = read(), sourceHash = hash(String(source));
    let item = items.find(item => item.day === date && item.ownerHash === ownerHash);
    const nickname = normalizeNickname(raw.nickname, item?.nickname || '学习伙伴');
    const reopened = Boolean(item && item.status !== 'visible');
    if (reopened && (raw.resubmit !== true || raw.expectedRevision !== itemRevision(item))) throw conflict(item.status === 'hidden' ? '这条打卡已隐藏，请查看当前记录后点击重新打卡' : '这条打卡已撤回，请查看当前记录后点击重新打卡');
    if (item && !reopened && (item.nickname || '学习伙伴') === nickname && item.message === message && item.focusSeconds === raw.focusSeconds && item.completedRounds === raw.completedRounds && JSON.stringify(item.subjects) === JSON.stringify(selected)) return { duplicate: true, reopened: false, ...snapshot(now, items), item: ownItem(item) };
    if (item) checkRevision(raw, item);
    if (!item && items.filter(e => e.sourceHash === sourceHash && now - Date.parse(e.createdAt) < 60000).length >= 20) { const error = new Error('打卡较多，请稍后再试'); error.status = 429; throw error; }
    const duplicate = Boolean(item);
    if (!item) {
      if (items.length >= 50000) throw new Error('打卡记录暂满，请稍后再试');
      item = { id: crypto.randomBytes(16).toString('hex'), day: date, ownerHash, sourceHash, status: 'visible', createdAt: new Date(now).toISOString() };
      items.unshift(item);
    }
    Object.assign(item, { nickname, message, subjects: selected, focusSeconds: raw.focusSeconds, completedRounds: raw.completedRounds, status: 'visible', revision: itemRevision(item) + 1, updatedAt: new Date(now).toISOString() });
    delete item.withdrawnAt;
    write(items);
    return { duplicate, reopened, ...snapshot(now, items), item: ownItem(item) };
  }
  function rename(key, value) {
    if (typeof value !== 'string') throw new Error('请填写要保存的网名');
    const ownerHash = keyHash(key), nickname = normalizeNickname(value), now = clock(), items = read();
    const item = items.find(item => item.day === day(now) && item.ownerHash === ownerHash);
    // A name edit keeps the original learning timestamp and moderation status.
    if (item && item.nickname !== nickname) { item.nickname = nickname; item.revision = itemRevision(item) + 1; write(items); }
    return { ...snapshot(now, items), item: item ? ownItem(item) : null };
  }
  function withdraw(raw) {
    const ownerHash = keyHash(raw?.key), now = clock();
    if (raw.day !== day(now)) throw conflict('日期已更新，请刷新今日记录后操作');
    const items = read(), item = items.find(item => item.day === day(now) && item.ownerHash === ownerHash);
    if (item && item.status !== 'withdrawn') {
      checkRevision(raw, item);
      item.status = 'withdrawn'; item.withdrawnAt = new Date(now).toISOString(); item.revision = itemRevision(item) + 1;
      write(items);
    }
    return { ...snapshot(now, items), item: item ? ownItem(item) : null };
  }
  function moderate(id, action) {
    if (!['hide', 'restore'].includes(action)) throw new Error('未知管理操作');
    const items = read(), item = items.find(item => item.id === id);
    if (!item) throw new Error('未找到这条打卡');
    if (item.status === 'withdrawn' && action === 'restore') throw new Error('本人已撤回，请等待本人重新提交');
    item.status = action === 'hide' ? 'hidden' : 'visible';
    item.revision = itemRevision(item) + 1;
    item.reviewedAt = new Date(clock()).toISOString(); write(items);
  }
  function render(escapeHtml) {
    const items = read(), today = day(clock()), total = snapshot(clock(), items).count;
    const sorted = [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 200);
    return `<section class="admin-section" id="study-checkins" data-section="checkins">
      <style>#study-checkins{scroll-margin-top:90px}#study-checkins .checkin-admin-list{display:grid;gap:12px;padding:20px}#study-checkins .checkin-admin-card{display:flex;justify-content:space-between;align-items:start;gap:18px;padding:18px;border:1px solid var(--line);border-radius:14px;background:#fbfdff}#study-checkins .checkin-admin-copy{min-width:0}#study-checkins h3{margin:0;font-size:16px;line-height:1.7;overflow-wrap:anywhere}#study-checkins .checkin-admin-meta{margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.7}#study-checkins .checkin-admin-card form{flex-shrink:0;margin:0}@media(max-width:640px){#study-checkins .checkin-admin-card{flex-direction:column}}</style>
      <div class="section-lead"><div><h2>群友共学打卡</h2><p>${escapeHtml(today)} 今日公开打卡 ${total} 人。同一浏览器每天计 1 人，可隐藏不合适的内容。</p></div></div>
      <section class="panel"><header><h2>打卡记录</h2><small>最近 200 条，包含历史记录</small></header><div class="checkin-admin-list">${sorted.map(item => `<article class="checkin-admin-card"><div class="checkin-admin-copy"><h3>${escapeHtml(item.nickname || '学习伙伴')}：${escapeHtml(item.message)}</h3><p class="checkin-admin-meta">${escapeHtml(item.subjects.join('、'))} · ${Math.floor(item.focusSeconds / 60)} 分钟 · 完成 ${item.completedRounds} 轮<br>${escapeHtml(timeFormatter.format(new Date(item.updatedAt)))} · ${item.status === 'hidden' ? '已隐藏' : item.status === 'withdrawn' ? '本人已撤回' : '公开'}</p></div>${item.status === 'withdrawn' ? '<small>等待本人重新打卡</small>' : `<form method="post" action="/admin/study-checkins/moderate"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><input type="hidden" name="action" value="${item.status === 'hidden' ? 'restore' : 'hide'}"><button type="submit">${item.status === 'hidden' ? '恢复公开' : '隐藏'}</button></form>`}</article>`).join('') || '<p class="hint">还没有共学打卡。</p>'}</div></section>
    </section>`;
  }
  return { snapshot, mine, submit, rename, withdraw, moderate, render };
};
