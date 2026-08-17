(() => {
  const apiBase = String(window.STUDY_RESOURCE_API_BASE || "").replace(/\/$/, "");
  const $ = (selector) => document.querySelector(selector);
  const storage = { get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } }, set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} } };
  const roomKey = "study-room-profile-v2";
  const focusKey = "study-room-focus-v1";
  const profile = storage.get(roomKey, { id: "", examType: "公务员", stage: "基础", region: "未选择", task: "刷题", seatId: "" });
  if (!profile.id) profile.id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!profile.seatId) profile.seatId = "";
  let duration = 25 * 60, remaining = duration, running = false, timer = 0;
  const el = { time: $("#pomodoroTime"), status: $("#pomodoroStatus"), start: $("#pomodoroStart"), reset: $("#pomodoroReset"), task: $("#studyTask"), exam: $("#examType"), stage: $("#studyStage"), region: $("#studyRegion"), connection: $("#roomConnection"), seats: $("#classroomSeats"), seatNote: $("#seatSelectionNote"), seat: $("#studySeat") };
  [[el.task, "task"], [el.exam, "examType"], [el.stage, "stage"], [el.region, "region"]].forEach(([node, key]) => { node.value = profile[key]; node.addEventListener("change", () => { profile[key] = node.value; storage.set(roomKey, profile); reportPresence(); }); });
  el.seat?.addEventListener("change", async () => { const oldSeat = profile.seatId; profile.seatId = el.seat.value || ""; storage.set(roomKey, profile); const ok = await reportPresence(); if (!ok) { profile.seatId = oldSeat; storage.set(roomKey, profile); el.seat.value = oldSeat; reportPresence(); } });
  function todayKey() { return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }); }
  function focusCount() { const data = storage.get(focusKey, {}); return Number(data[todayKey()] || 0); }
  function renderFocusCount() { $("#todayFocusCount").textContent = `今日 ${focusCount()} 次`; }
  function renderTimer() { const minutes = String(Math.floor(remaining / 60)).padStart(2, "0"), seconds = String(remaining % 60).padStart(2, "0"); el.time.textContent = `${minutes}:${seconds}`; updateText("#referenceTimerMini", `${minutes}:${seconds}`); el.status.textContent = running ? "正在专注中" : remaining === duration ? "准备开始" : "已暂停"; el.start.textContent = running ? "暂停" : (remaining === duration ? "开始专注" : "继续专注"); document.title = running ? `${minutes}:${seconds}｜上岸自习室` : "上岸自习室｜学习资源库"; }
  function finishFocus() { running = false; clearInterval(timer); const data = storage.get(focusKey, {}); data[todayKey()] = focusCount() + 1; storage.set(focusKey, data); remaining = duration; renderFocusCount(); renderTimer(); reportPresence(); window.alert("这一轮专注完成，休息一下，再继续向上岸靠近。"); }
  function toggleTimer() { running = !running; if (running) timer = window.setInterval(() => { remaining -= 1; if (remaining <= 0) finishFocus(); else renderTimer(); }, 1000); else clearInterval(timer); renderTimer(); reportPresence(); }
  el.start.addEventListener("click", toggleTimer); el.reset.addEventListener("click", () => { running = false; clearInterval(timer); remaining = duration; renderTimer(); reportPresence(); });
  document.querySelectorAll("[data-minutes]").forEach((button) => button.addEventListener("click", () => { if (running) return; duration = Number(button.dataset.minutes) * 60; remaining = duration; document.querySelectorAll("[data-minutes]").forEach((item) => item.classList.toggle("is-active", item === button)); renderTimer(); }));

  const noiseVolumeKey = "study-room-noise-volume-v1";
  const noise = { context: null, gain: null, source: null, playing: false, muted: false, volume: Math.min(100, Math.max(0, Number(storage.get(noiseVolumeKey, 28)) || 28)) };
  const noiseEl = { toggle: $("#noiseToggle"), mute: $("#noiseMute"), volume: $("#noiseVolume"), output: $("#noiseVolumeValue"), status: $("#noiseStatus") };
  function renderNoise() {
    const value = Math.round(noise.volume);
    if (noiseEl.volume) noiseEl.volume.value = String(value);
    if (noiseEl.output) noiseEl.output.textContent = `${value}%`;
    if (noiseEl.toggle) { noiseEl.toggle.textContent = noise.playing ? "Ⅱ 暂停播放" : "▶ 开始播放"; noiseEl.toggle.setAttribute("aria-pressed", String(noise.playing)); }
    if (noiseEl.status) noiseEl.status.textContent = noise.playing ? (noise.muted ? "已静音" : "播放中") : "已关闭";
    if (noiseEl.mute) { noiseEl.mute.textContent = noise.muted ? "取消静音" : "静音"; noiseEl.mute.setAttribute("aria-pressed", String(noise.muted)); }
  }
  function applyNoiseGain() { if (noise.gain) noise.gain.gain.value = noise.muted ? 0 : noise.volume / 100 * 0.28; }
  function createNoiseSource() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("当前浏览器不支持白噪音");
    noise.context = noise.context || new AudioContext();
    const sampleRate = noise.context.sampleRate, buffer = noise.context.createBuffer(1, sampleRate * 2, sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) { const edge = Math.min(1, i / (sampleRate * .03), (data.length - i) / (sampleRate * .03)); data[i] = (Math.random() * 2 - 1) * edge; }
    noise.gain = noise.context.createGain(); noise.gain.connect(noise.context.destination); applyNoiseGain();
    noise.source = noise.context.createBufferSource(); noise.source.buffer = buffer; noise.source.loop = true; noise.source.connect(noise.gain); noise.source.start();
  }
  async function toggleNoise() {
    if (noise.playing) { noise.source?.stop(); noise.source?.disconnect(); noise.gain?.disconnect(); noise.source = null; noise.gain = null; noise.playing = false; renderNoise(); return; }
    try { if (!noise.context || !noise.source) createNoiseSource(); if (noise.context.state === "suspended") await noise.context.resume(); noise.playing = true; renderNoise(); }
    catch (error) { if (noiseEl.status) noiseEl.status.textContent = error.message || "暂不支持"; if (noiseEl.toggle) noiseEl.toggle.disabled = true; }
  }
  noiseEl.toggle?.addEventListener("click", toggleNoise);
  noiseEl.mute?.addEventListener("click", () => { noise.muted = !noise.muted; applyNoiseGain(); renderNoise(); });
  noiseEl.volume?.addEventListener("input", () => { noise.volume = Number(noiseEl.volume.value); storage.set(noiseVolumeKey, noise.volume); applyNoiseGain(); renderNoise(); });
  renderNoise();
  function updateText(id, value) { const node = $(id); if (node) node.textContent = String(value); }
  const seatRows = 6, seatColumns = 6, seatTotal = seatRows * seatColumns;
  const seatPortraits = ['assets/study-room-learner-clean-green-01-crop.png', 'assets/study-room-learner-clean-green-02-crop.png', 'assets/study-room-learner-clean-girl-03-crop.png', 'assets/study-room-learner-clean-boy-04-crop.png', 'assets/study-room-learner-clean-girl-05-crop.png'];
  function seatLabel(index) { return `${String.fromCharCode(65 + Math.floor(index / seatColumns))}${(index % seatColumns) + 1}`; }
  function seatTaskLabel(task) { return task === "安静自习" ? "自习中" : `${task}中`; }  function renderSeatOptions(seats = []) {
    if (!el.seat) return;
    const occupied = new Map((Array.isArray(seats) ? seats : []).map((item) => [item.seatId, item]));
    el.seat.innerHTML = `<option value="">暂不入座</option>` + Array.from({ length: seatTotal }, (_, index) => { const id = `seat-${index + 1}`, person = occupied.get(id), mine = profile.seatId === id; return `<option value="${id}" ${person && !mine ? "disabled" : ""}>${seatLabel(index)}${person && !mine ? "（已有人）" : ""}</option>`; }).join("");
    el.seat.value = profile.seatId || "";
  }
  function renderClassroomSeats(seats = []) {
    if (!el.seats) return;
    const occupied = new Map((Array.isArray(seats) ? seats : []).map((item) => [item.seatId, item]));
    renderSeatOptions(seats);
    el.seats.innerHTML = Array.from({ length: seatTotal }, (_, index) => {
      const seatId = `seat-${index + 1}`, mine = profile.seatId === seatId, person = occupied.get(seatId) || (mine ? { visitorId: profile.id, task: profile.task } : null);
      const status = person ? (mine ? seatTaskLabel(profile.task) : seatTaskLabel(person.task)) : "空座"; const label = seatLabel(index), portrait = seatPortraits[index % seatPortraits.length], portraitClass = `portrait-${(index % seatPortraits.length) + 1}`;
      return `<button type="button" class="classroom-seat ${person ? "is-occupied" : ""} ${mine ? "is-mine" : ""}" data-seat="${seatId}" aria-label="${label} 座位，${status}" ${person && !mine ? "disabled" : ""}><span class="seat-number">${label}</span><span class="seat-person"><img class="seat-portrait ${portraitClass}" src="${portrait}" alt="" aria-hidden="true" /></span><span class="seat-task">${status}</span></button>`;
    }).join("");
    el.seats.querySelectorAll("[data-seat]").forEach((button) => button.addEventListener("click", async () => {
      const oldSeat = profile.seatId;
      profile.seatId = button.dataset.seat || "";
      storage.set(roomKey, profile);
      const ok = await reportPresence();
      if (!ok) { profile.seatId = oldSeat; storage.set(roomKey, profile); reportPresence(); }
    }));
    if (el.seatNote && !el.seatNote.classList.contains("is-error")) el.seatNote.textContent = profile.seatId ? `你已入座 ${profile.seatId.replace("seat-", "") } 号位；离开页面 2 分钟后座位会自动释放。` : "请选择一个空座入座；离开页面 2 分钟后座位会自动释放。";
  }
  function renderPresence(data) {
    updateText("#studyRoomOnline", data.onlineCount ?? "--"); updateText("#classroomOnline", data.onlineCount ?? "--"); updateText("#referenceOnline", data.onlineCount ?? "--"); updateText("#boardOnlineCount", data.onlineCount ?? "--"); updateText("#liveBrushCount", data.taskCounts?.["刷题"] ?? 0); updateText("#liveEssayCount", data.taskCounts?.["申论"] ?? 0); updateText("#boardBrushCount", data.taskCounts?.["刷题"] ?? 0); updateText("#boardEssayCount", data.taskCounts?.["申论"] ?? 0);
    updateText("#matchExam", data.match?.sameExam ?? 0); updateText("#matchStage", data.match?.sameStage ?? 0); updateText("#matchRegion", data.match?.sameRegion ?? 0);
    const hasRegion = data.match?.hasRegion; $("#matchNote").textContent = hasRegion ? "只显示人数，不展示任何同学的身份或联系方式。" : "如果愿意选择省份，还会显示同省份的匿名同学人数。";
    el.seatNote?.classList.remove("is-error"); renderClassroomSeats(data.seats); el.connection.textContent = "自习室已连接 · 仅统计活跃匿名座位";
  }
  async function reportPresence() {
    if (!apiBase || document.hidden) return false;
    const payload = { visitorId: profile.id, examType: profile.examType, stage: profile.stage, region: profile.region, task: running ? profile.task : "安静自习", seatId: profile.seatId };
    try {
      const response = await fetch(`${apiBase}/api/study-room/presence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "连接失败"); renderPresence(data); return true;
    } catch (error) {
      el.connection.textContent = "自习室暂时离线，番茄钟仍可正常使用";
      if (el.seatNote && profile.seatId) { el.seatNote.textContent = error?.message || "座位连接失败，请稍后重试。"; el.seatNote.classList.add("is-error"); }
      return false;
    }
  }
  function renderWallClock() { const now = new Date(), hour = now.getHours() % 12, minute = now.getMinutes(), second = now.getSeconds(); const hourHand = $(".clock-hour"), minuteHand = $(".clock-minute"), secondHand = $(".clock-second"); if (hourHand) hourHand.style.transform = `translateX(-50%) rotate(${hour * 30 + minute * .5}deg)`; if (minuteHand) minuteHand.style.transform = `translateX(-50%) rotate(${minute * 6 + second * .1}deg)`; if (secondHand) secondHand.style.transform = `translateX(-50%) rotate(${second * 6}deg)`; }
  renderWallClock(); window.setInterval(renderWallClock, 1000);
  function openPanel(type) { document.body.classList.remove("focus-open", "match-open"); document.body.classList.add(type === "focus" ? "focus-open" : "match-open"); $("#roomModalVeil").hidden = false; }
  function closePanel() { document.body.classList.remove("focus-open", "match-open", "tools-open"); const veil = $("#roomModalVeil"); if (veil) veil.hidden = true; }
  $("#focusToggle")?.addEventListener("click", () => openPanel("focus"));
  $("#matchToggle")?.addEventListener("click", () => openPanel("match")); $("#toolsToggle")?.addEventListener("click", () => { document.body.classList.add("tools-open"); const veil = $("#roomModalVeil"); if (veil) veil.hidden = false; });
  $("#roomModalVeil")?.addEventListener("click", closePanel);
  $("#continuePortrait")?.addEventListener("click", () => document.body.classList.add("portrait-continue"));
  $("#inviteShare")?.addEventListener("click", async () => {
    const button = $("#inviteShare"), shareUrl = `${location.origin}${location.pathname}`;
    const payload = { title: "上岸自习室", text: "一起进上岸自习室刷题、专注学习吧。", url: shareUrl };
    try { if (navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(shareUrl); button.textContent = "链接已复制，发给好友吧"; window.setTimeout(() => { button.textContent = "⌯ 邀请好友一起学习"; }, 2200); } } catch (_) {}
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePanel(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) reportPresence(); });
  window.setInterval(reportPresence, 45000); renderClassroomSeats(); renderFocusCount(); renderTimer(); reportPresence();
})();
