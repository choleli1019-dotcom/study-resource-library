/* Woodland scenes follow Beijing time, including while the page stays open. */
(() => {
  const base = document.querySelector('.site-static-background');
  if (!base) return;
  const scenes = [
    { key: 'night', from: 0, file: 'forest-night-v1.webp' },
    { key: 'dawn', from: 5, file: 'forest-dawn-v1.webp' },
    { key: 'morning', from: 8, file: 'forest-morning-v1.webp' },
    { key: 'noon', from: 11, file: 'forest-noon-v1.webp' },
    { key: 'afternoon', from: 14, file: 'forest-afternoon-v1.webp' },
    { key: 'evening', from: 18, file: 'forest-evening-v1.webp' },
    { key: 'night', from: 23, file: 'forest-night-v1.webp' }
  ];
  const hourFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23'
  });
  const overlay = document.createElement('div');
  overlay.className = 'site-static-background-transition';
  overlay.setAttribute('aria-hidden', 'true');
  base.after(overlay);
  let currentKey = '', pendingKey = '', revision = 0, timer = 0;
  const loaded = new Map();
  function selectScene() {
    const hour = Number(hourFormat.format(new Date()));
    return scenes.reduce((selected, scene) => hour >= scene.from ? scene : selected, scenes[0]);
  }
  function loadScene(url) {
    if (loaded.has(url)) return loaded.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Background unavailable'));
      image.src = url;
    });
    loaded.set(url, promise);
    promise.catch(() => loaded.delete(url));
    return promise;
  }
  async function refreshScene() {
    const scene = selectScene();
    if (scene.key === pendingKey || (scene.key === currentKey && !pendingKey)) return;
    const request = ++revision;
    pendingKey = scene.key;
    const url = `assets/${scene.file}?v=20261008-cycle`;
    try {
      await loadScene(url);
      if (request !== revision) return;
      const duration = !currentKey || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
      if (duration) {
        overlay.style.transition = 'none';
        overlay.style.opacity = '0';
        overlay.style.backgroundImage = `url("${url}")`;
        void overlay.offsetWidth;
        overlay.style.transition = `opacity ${duration}ms ease`;
        overlay.style.opacity = '1';
        await new Promise(resolve => setTimeout(resolve, duration));
        if (request !== revision) return;
      }
      base.style.backgroundImage = `url("${url}")`;
      base.dataset.backgroundScene = scene.key;
      overlay.style.transition = 'none';
      overlay.style.opacity = '0';
      currentKey = scene.key;
      pendingKey = '';
    } catch {
      // Keep the previous scene and retry on the next visible minute.
      if (request === revision) pendingKey = '';
    }
  }
  function checkTime() {
    clearTimeout(timer);
    if (!document.hidden) refreshScene();
    timer = setTimeout(checkTime, 60000 - Date.now() % 60000 + 25);
  }
  document.addEventListener('visibilitychange', checkTime);
  window.addEventListener('pageshow', checkTime);
  checkTime();
})();
