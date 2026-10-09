(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'resource-request-dialog';
  dialog.setAttribute('aria-labelledby', 'resourceRequestTitle');
  dialog.innerHTML = `
    <form id="resourceRequestForm">
      <div class="resource-request-heading"><h2 id="resourceRequestTitle">登记想找的资料</h2><button type="button" data-request-close aria-label="关闭">×</button></div>
      <p>告诉我们你想找什么，方便后续整理和补充。</p>
      <label>资料名称 <span>必填</span><input name="title" required minlength="2" maxlength="120" placeholder="例如：2025 浙江省考行测真题及解析" /></label>
      <label>补充说明 <span>选填</span><textarea name="details" maxlength="500" rows="4" placeholder="可以填写地区、年份、老师、课程或是否需要解析"></textarea></label>
      <p class="resource-request-hint">需求仅供管理员查看，请勿填写手机号等个人信息。登记后会视资料情况整理，不保证补齐时间。</p>
      <p class="resource-request-status" role="status" aria-live="polite"></p>
      <div class="resource-request-actions"><button type="button" data-request-close>取消</button><button type="submit">提交需求</button></div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('[role="status"]');
  const submit = form.querySelector('[type="submit"]');
  let query = '';
  let busy = false;
  let completed = false;
  let previousFocus;
  function close() { if (!busy) dialog.close(); }
  dialog.addEventListener('close', () => previousFocus?.focus());
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-request-close]')) close();
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-resource-request]')) return;
    previousFocus = event.target.closest('[data-resource-request]');
    query = document.getElementById('searchInput')?.value.trim().slice(0, 256) || '';
    if (completed) { form.reset(); completed = false; }
    if (!form.elements.title.value) form.elements.title.value = query.slice(0, 120);
    status.textContent = '';
    submit.disabled = false;
    submit.textContent = '提交需求';
    dialog.showModal();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || completed || !form.reportValidity()) return;
    const base = String(window.STUDY_RESOURCE_API_BASE || '').replace(/\/$/, '');
    if (!base) { status.textContent = '登记服务暂未配置，请稍后再试。'; return; }
    busy = true;
    submit.disabled = true;
    submit.textContent = '正在提交…';
    status.textContent = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + '/api/resource-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ title: form.elements.title.value.trim(), details: form.elements.details.value.trim(), query })
      });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('登记服务暂不可用，请稍后再试。'); }
      if (!response.ok || !data.ok) throw new Error(data.error || '提交失败，请稍后再试。');
      completed = true;
      status.textContent = data.duplicate ? '这条需求已登记，不用重复提交。' : '登记成功！管理员可以查看你的资料需求了。';
      submit.textContent = '已登记';
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '请求超时，内容已保留，请稍后重试。' : (error instanceof TypeError ? '网络连接失败，内容已保留，请稍后重试。' : error.message);
      submit.textContent = '重新提交';
    } finally {
      clearTimeout(timeout);
      busy = false;
      submit.disabled = completed;
    }
  });
})();
