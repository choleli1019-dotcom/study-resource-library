const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function resourceRequests(dataDir) {
  const file = path.join(dataDir, 'resource-requests.json');
  const labels = { pending: '待处理', searching: '寻找中', fulfilled: '已补充', unavailable: '暂未找到' };
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  function read() {
    try {
      const items = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(items)) throw new Error('Invalid request data');
      return items;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  function write(items) {
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(items, null, 2));
    fs.renameSync(temporary, file);
  }
  function create(raw, source) {
    const title = text(raw?.title, 120);
    if (title.length < 2) throw new Error('请至少填写 2 个字的资料名称');
    if (typeof raw.title !== 'string' || raw.title.trim().length > 120 || (raw.details && (typeof raw.details !== 'string' || raw.details.length > 500))) throw new Error('资料名称最多 120 字，说明最多 500 字');
    const items = read();
    const now = Date.now();
    const sourceKey = crypto.createHash('sha256').update(source).digest('hex');
    const details = text(raw.details, 500);
    const duplicate = items.find(item => item.sourceKey === sourceKey && item.title === title && item.details === details && now - Date.parse(item.createdAt) < 10 * 60 * 1000);
    if (duplicate) return { item: duplicate, duplicate: true };
    if (items.some(item => item.sourceKey === sourceKey && now - Date.parse(item.createdAt) < 30000)) {
      const error = new Error('提交太快了，请 30 秒后再试'); error.status = 429; throw error;
    }
    if (items.length >= 10000) throw new Error('需求登记暂满，请稍后再试');
    const item = { id: crypto.randomBytes(16).toString('hex'), title, details, query: text(raw.query, 256), status: 'pending', note: '', createdAt: new Date(now).toISOString(), updatedAt: null, sourceKey };
    items.unshift(item);
    write(items);
    return { item, duplicate: false };
  }
  function update(raw) {
    if (!Object.hasOwn(labels, raw.status)) throw new Error('未知处理状态');
    const items = read();
    const item = items.find(item => item.id === raw.id);
    if (!item) throw new Error('未找到这条资料需求');
    item.status = raw.status;
    item.note = text(raw.note, 500);
    item.updatedAt = new Date().toISOString();
    write(items);
  }
  function render(escapeHtml, filter = 'pending', saved = false) {
    const all = read();
    if (!Object.hasOwn(labels, filter) && filter !== 'all') filter = 'pending';
    const items = all.filter(item => filter === 'all' || item.status === filter);
    return `<section class="admin-section" id="resource-requests" data-section="requests">
      <div class="section-lead"><div><h2>求资料登记</h2><p>查看群友想找的资料，补充后可标记状态。待处理 ${all.filter(item => item.status === 'pending').length} 条，共 ${all.length} 条。</p></div></div>
      ${saved ? '<p role="status">处理状态已保存。</p>' : ''}
      <section class="panel"><header><h2>资料需求</h2><small>按提交时间倒序，最多显示 200 条</small></header>
      <div style="padding:16px;display:flex;gap:10px;flex-wrap:wrap">${Object.entries({ ...labels, all: '全部' }).map(([key, label]) => `<a class="btn${filter === key ? '' : ' secondary'}" href="/admin?requestFilter=${key}#resource-requests">${label}（${all.filter(item => key === 'all' || item.status === key).length}）</a>`).join('')}</div>
      <div class="list">${items.slice(0, 200).map(item => `<article class="stat-row"><div class="stat-main"><strong>${escapeHtml(item.title)}</strong><p style="white-space:pre-wrap">${escapeHtml(item.details || '没有补充说明')}</p><p>${escapeHtml(item.createdAt)} · ${escapeHtml(labels[item.status] || item.status)}${item.query ? ' · 搜索词：' + escapeHtml(item.query) : ''}</p><form method="post" action="/admin/resource-requests/update"><input type="hidden" name="id" value="${escapeHtml(item.id)}" /><label>处理状态<select name="status">${Object.entries(labels).map(([key, label]) => `<option value="${key}"${item.status === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label>处理备注<textarea name="note" maxlength="500" rows="2">${escapeHtml(item.note || '')}</textarea></label><input type="hidden" name="filter" value="${filter}" /><button type="submit">保存处理结果</button></form></div></article>`).join('') || '<div class="empty">这个状态下暂时没有资料需求</div>'}</div></section></section>`;
  }
  return { read, create, update, render };
};
