const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function resourceRequests(dataDir) {
  const file = path.join(dataDir, 'resource-requests.json');
  const labels = { pending: '待处理', searching: '寻找中', fulfilled: '已补充', unavailable: '暂未找到' };
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const timeFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const formatTime = value => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? timeFormatter.format(date) : '时间未记录';
  };
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
      <style>
        #resource-requests{scroll-margin-top:90px}
        #resource-requests .request-filters{display:flex;flex-wrap:wrap;gap:8px;padding:18px 20px;border-bottom:1px solid var(--line)}
        #resource-requests .request-filters a{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid var(--line);border-radius:12px;background:#fff;color:#526477;font-size:14px;font-weight:650;text-decoration:none;white-space:nowrap}
        #resource-requests .request-filters a[aria-current="page"]{border-color:#007aff;background:#eaf4ff;color:#0065d3}
        #resource-requests .request-filters b{font-size:12px;font-weight:700;opacity:.8}
        #resource-requests .request-list{display:grid;gap:14px;padding:20px}
        #resource-requests .request-card{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;padding:22px;border:1px solid var(--line);border-radius:18px;background:#fbfdff;align-items:start}
        #resource-requests .request-copy{min-width:0}
        #resource-requests .request-heading{display:flex;flex-wrap:wrap;align-items:start;gap:10px;margin-bottom:12px}
        #resource-requests .request-heading h3{flex:1;min-width:0;margin:0;font-size:18px;line-height:1.5;overflow-wrap:anywhere}
        #resource-requests .request-status{flex-shrink:0;border-radius:8px;padding:5px 9px;background:#eaf4ff;color:#0065d3;font-size:12px;line-height:1.5;font-weight:700;white-space:nowrap}
        #resource-requests .request-status[data-status="fulfilled"]{background:#e7f7ef;color:#047857}
        #resource-requests .request-status[data-status="unavailable"]{background:#f1f3f6;color:#66758a}
        #resource-requests .request-status[data-status="searching"]{background:#fff5e5;color:#9b6507}
        #resource-requests .request-description{margin:0;color:#405569;line-height:1.75;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}
        #resource-requests .request-description.is-empty{color:var(--muted)}
        #resource-requests .request-meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:16px;color:var(--muted);font-size:12px;line-height:1.7}
        #resource-requests .request-query{margin:8px 0 0;color:var(--muted);font-size:12px;line-height:1.7;overflow-wrap:anywhere}
        #resource-requests .request-form{display:grid;gap:12px;padding-left:24px;border-left:1px solid var(--line);min-width:0;margin:0}
        #resource-requests .request-form label{display:grid;gap:6px;color:#526477;font-size:13px;font-weight:600;min-width:0}
        #resource-requests .request-form select,#resource-requests .request-form textarea{width:100%;min-width:0;border:1px solid #cbdceb;border-radius:10px;padding:10px 12px;background:#fff;color:var(--text);font:inherit;line-height:1.5}
        #resource-requests .request-form textarea{min-height:80px;resize:vertical;font-weight:400}
        #resource-requests .request-form button{justify-self:end;min-height:42px;border:0;border-radius:10px;padding:10px 18px;background:#007aff;color:#fff;font:inherit;font-size:14px;font-weight:650;white-space:nowrap;cursor:pointer}
        #resource-requests .request-filters a:hover{border-color:#8ebaf0}
        #resource-requests .request-form button:hover{background:#0068dc}
        #resource-requests :is(a,select,textarea,button):focus-visible{outline:3px solid #7fbdff;outline-offset:3px}
        #resource-requests .request-saved{padding:12px 16px;border:1px solid #b7e6cf;border-radius:12px;background:#edf9f2;color:#047857;font-size:14px}
        @media(max-width:800px){#resource-requests .request-card{grid-template-columns:minmax(0,1fr);gap:18px}#resource-requests .request-form{padding-left:0;padding-top:18px;border-left:0;border-top:1px solid var(--line)}}
        @media(max-width:480px){#resource-requests .request-filters{padding:14px;gap:7px}#resource-requests .request-filters a{padding:8px 10px;font-size:13px}#resource-requests .request-list{padding:12px;gap:12px}#resource-requests .request-card{padding:16px}#resource-requests .request-heading h3{font-size:16px}#resource-requests .request-form select,#resource-requests .request-form textarea{font-size:16px}#resource-requests .request-form button{width:100%}}
      </style>
      <div class="section-lead"><div><h2>求资料登记</h2><p>查看群友想找的资料，补充后可标记状态。待处理 ${all.filter(item => item.status === 'pending').length} 条，共 ${all.length} 条。</p></div></div>
      ${saved ? '<p class="request-saved" role="status">处理状态已保存。</p>' : ''}
      <section class="panel"><header><h2>资料需求</h2><small>按提交时间倒序，最多显示 200 条</small></header>
      <nav class="request-filters" aria-label="资料需求状态筛选">${Object.entries({ ...labels, all: '全部' }).map(([key, label]) => `<a${filter === key ? ' aria-current="page"' : ''} href="/admin?requestFilter=${key}#resource-requests">${label}<b>${all.filter(item => key === 'all' || item.status === key).length}</b></a>`).join('')}</nav>
      <div class="request-list">${items.slice(0, 200).map(item => `<article class="request-card">
        <div class="request-copy">
          <div class="request-heading"><h3>${escapeHtml(item.title)}</h3><span class="request-status" data-status="${escapeHtml(item.status)}">${escapeHtml(labels[item.status] || item.status)}</span></div>
          <p class="request-description${item.details ? '' : ' is-empty'}">${escapeHtml(item.details || '未填写补充说明')}</p>
          <div class="request-meta"><span>提交于 ${escapeHtml(formatTime(item.createdAt))}</span>${item.updatedAt ? `<span>处理于 ${escapeHtml(formatTime(item.updatedAt))}</span>` : ''}</div>
          ${item.query ? `<p class="request-query">搜索词：${escapeHtml(item.query)}</p>` : ''}
        </div>
        <form class="request-form" method="post" action="/admin/resource-requests/update">
          <input type="hidden" name="id" value="${escapeHtml(item.id)}" />
          <label>处理状态<select name="status">${Object.entries(labels).map(([key, label]) => `<option value="${key}"${item.status === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
          <label>处理备注<textarea name="note" maxlength="500" rows="2" placeholder="例如：已补充链接，或记录还缺哪些资料">${escapeHtml(item.note || '')}</textarea></label>
          <input type="hidden" name="filter" value="${filter}" />
          <button type="submit">保存处理结果</button>
        </form>
      </article>`).join('') || '<div class="empty">这个状态下暂时没有资料需求</div>'}</div></section></section>`;
  }
  return { read, create, update, render };
};
