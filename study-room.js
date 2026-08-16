(() => {
  const apiBase = String(window.STUDY_RESOURCE_API_BASE || "").replace(/\/$/, "");
  const $ = (selector) => document.querySelector(selector);
  const storage = { get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } }, set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} } };
  const roomKey = "study-room-profile-v1";
  const focusKey = "study-room-focus-v1";
  const profile = storage.get(roomKey, { id: "", examType: "公务员", stage: "基础", region: "未选择", task: "刷题", seatId: "" });
  if (!profile.id) profile.id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!profile.seatId) profile.seatId = "";
  let duration = 25 * 60, remaining = duration, running = false, timer = 0;
  const el = { time: $("#pomodoroTime"), status: $("#pomodoroStatus"), start: $("#pomodoroStart"), reset: $("#pomodoroReset"), task: $("#studyTask"), exam: $("#examType"), stage: $("#studyStage"), region: $("#studyRegion"), connection: $("#roomConnection"), seats: $("#classroomSeats"), seatNote: $("#seatSelectionNote") };
  [[el.task, "task"], [el.exam, "examType"], [el.stage, "stage"], [el.region, "region"]].forEach(([node, key]) => { node.value = profile[key]; node.addEventListener("change", () => { profile[key] = node.value; storage.set(roomKey, profile); reportPresence(); }); });

  function todayKey() { return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }); }
  function focusCount() { const data = storage.get(focusKey, {}); return Number(data[todayKey()] || 0); }
  function renderFocusCount() { $("#todayFocusCount").textContent = `今日 ${focusCount()} 次`; }
  function renderTimer() { const minutes = String(Math.floor(remaining / 60)).padStart(2, "0"), seconds = String(remaining % 60).padStart(2, "0"); el.time.textContent = `${minutes}:${seconds}`; el.status.textContent = running ? "正在专注中" : remaining === duration ? "准备开始" : "已暂停"; el.start.textContent = running ? "暂停" : (remaining === duration ? "开始专注" : "继续专注"); document.title = running ? `${minutes}:${seconds}｜上岸自习室` : "上岸自习室｜学习资源库"; }
  function finishFocus() { running = false; clearInterval(timer); const data = storage.get(focusKey, {}); data[todayKey()] = focusCount() + 1; storage.set(focusKey, data); remaining = duration; renderFocusCount(); renderTimer(); reportPresence(); window.alert("这一轮专注完成，休息一下，再继续向上岸靠近。"); }
  function toggleTimer() { running = !running; if (running) timer = window.setInterval(() => { remaining -= 1; if (remaining <= 0) finishFocus(); else renderTimer(); }, 1000); else clearInterval(timer); renderTimer(); reportPresence(); }
  el.start.addEventListener("click", toggleTimer); el.reset.addEventListener("click", () => { running = false; clearInterval(timer); remaining = duration; renderTimer(); reportPresence(); });
  document.querySelectorAll("[data-minutes]").forEach((button) => button.addEventListener("click", () => { if (running) return; duration = Number(button.dataset.minutes) * 60; remaining = duration; document.querySelectorAll("[data-minutes]").forEach((item) => item.classList.toggle("is-active", item === button)); renderTimer(); }));

  function updateText(id, value) { const node = $(id); if (node) node.textContent = String(value); }
  function seatTaskLabel(task) { return task === "安静自习" ? "自习中" : `${task}中`; }
  function renderClassroomSeats(seats = []) {
    if (!el.seats) return;
    const occupied = new Map((Array.isArray(seats) ? seats : []).map((item) => [item.seatId, item]));
    el.seats.innerHTML = Array.from({ length: 36 }, (_, index) => {
      const seatId = `seat-${index + 1}`, person = occupied.get(seatId), mine = profile.seatId === seatId;
      const status = person ? (mine ? "我的座位" : seatTaskLabel(person.task)) : "空座";
      return `<button type="button" class="classroom-seat ${person ? "is-occupied" : ""} ${mine ? "is-mine" : ""}" data-seat="${seatId}" aria-label="第 ${index + 1} 号座位，${status}" ${person && !mine ? "disabled" : ""}><span class="seat-number">${index + 1}</span><span class="seat-person"></span><span class="seat-task">${status}</span></button>`;
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
    updateText("#studyRoomOnline", data.onlineCount ?? "--"); updateText("#classroomOnline", data.onlineCount ?? "--");
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
  document.addEventListener("visibilitychange", () => { if (!document.hidden) reportPresence(); });
  window.setInterval(reportPresence, 45000); renderClassroomSeats(); renderFocusCount(); renderTimer(); reportPresence();
})();


