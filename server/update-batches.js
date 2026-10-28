const crypto = require('node:crypto');

const platforms = { baidu: '百度网盘', quark: '夸克网盘' };
function normalizeEntry(raw, platform) {
  try {
    const url = new URL(raw.url || raw.newUrl);
    const hostname = platform === 'baidu' ? 'pan.baidu.com' : 'pan.quark.cn';
    if (!platforms[platform] || !['https:', 'http:'].includes(url.protocol) || url.hostname !== hostname || url.username || url.password || !/^\/s\/[\w-]+\/?$/.test(url.pathname)) return null;
    const title = String(raw.title || '').trim().slice(0, 300);
    if (!title) return null;
    const code = String(raw.code || raw.newCode || url.searchParams.get('pwd') || '').trim().slice(0, 32);
    return { title, url: url.href, code };
  } catch (_) { return null; }
}
function normalizeEntries(records, platform) {
  const unique = new Map();
  for (const raw of Array.isArray(records) ? records : []) {
    const item = normalizeEntry(raw, platform);
    if (item) unique.set(JSON.stringify(item), item);
  }
  return [...unique.values()];
}
function publicBatches(data) {
  return (Array.isArray(data?.updateBatches) ? data.updateBatches : []).flatMap(raw => {
    if (!platforms[raw?.platform] || !/^\w[\w-]{1,100}$/.test(raw.id || '') || !Number.isFinite(Date.parse(raw.publishedAt))) return [];
    const entries = normalizeEntries(raw.entries, raw.platform);
    return entries.length ? [{ id: raw.id, platform: raw.platform, publishedAt: raw.publishedAt, count: entries.length, entries }] : [];
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
function appendBatch(data, platform, records, options = {}) {
  if (!platforms[platform]) throw new Error('不支持的网盘类型');
  const entries = normalizeEntries(records, platform);
  if (!entries.length) throw new Error('更新记录没有可公开的网盘链接');
  const fingerprint = entries.map(item => JSON.stringify(item)).sort().join('\n');
  const id = `${platform}-${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
  if (!Array.isArray(data.updateBatches)) data.updateBatches = [];
  const existing = data.updateBatches.find(batch => batch.id === id);
  if (existing) return existing;
  const publishedAt = options.publishedAt || new Date().toISOString();
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error('无效的发布时间');
  const batch = { id, platform, publishedAt, entries };
  data.updateBatches.unshift(batch);
  return batch;
}
module.exports = { appendBatch, publicBatches, normalizeEntries };
