(() => {
  "use strict";

  // ---------- DOM refs ----------
  const screenStudents = document.getElementById("screen-students");
  const screenRecording = document.getElementById("screen-recording");

  const studentList = document.getElementById("student-list");
  const studentEmpty = document.getElementById("student-empty");
  const btnAddStudent = document.getElementById("btn-add-student");
  const btnAddStudentEmpty = document.getElementById("btn-add-student-empty");

  const modalAddStudent = document.getElementById("modal-add-student");
  const inputStudentName = document.getElementById("input-student-name");
  const btnCancelAddStudent = document.getElementById("btn-cancel-add-student");
  const btnConfirmAddStudent = document.getElementById("btn-confirm-add-student");

  const btnBack = document.getElementById("btn-back");
  const recordingStudentName = document.getElementById("recording-student-name");
  const btnMicSettings = document.getElementById("btn-mic-settings");

  const stateLabel = document.getElementById("recorder-state-label");
  const timerEl = document.getElementById("recorder-timer");
  const levelBar = document.getElementById("level-bar");
  const recorderHint = document.getElementById("recorder-hint");

  const btnPause = document.getElementById("btn-pause");
  const btnRecord = document.getElementById("btn-record");

  const recordingListEl = document.getElementById("recording-list");
  const recordingEmpty = document.getElementById("recording-empty");

  const modalMic = document.getElementById("modal-mic");
  const selectMic = document.getElementById("select-mic");
  const btnCloseMic = document.getElementById("btn-close-mic");

  const modalConfirm = document.getElementById("modal-confirm");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmText = document.getElementById("confirm-text");
  const btnConfirmCancel = document.getElementById("btn-confirm-cancel");
  const btnConfirmOk = document.getElementById("btn-confirm-ok");

  const modalStudentActions = document.getElementById("modal-student-actions");
  const studentActionsTitle = document.getElementById("student-actions-title");
  const btnActionRename = document.getElementById("btn-action-rename");
  const btnActionDelete = document.getElementById("btn-action-delete");
  const btnActionCancel = document.getElementById("btn-action-cancel");

  const modalRenameStudent = document.getElementById("modal-rename-student");
  const inputRenameStudent = document.getElementById("input-rename-student");
  const btnCancelRenameStudent = document.getElementById("btn-cancel-rename-student");
  const btnConfirmRenameStudent = document.getElementById("btn-confirm-rename-student");

  const btnPcSync = document.getElementById("btn-pc-sync");
  const modalPcSync = document.getElementById("modal-pc-sync");
  const inputPcUrl = document.getElementById("input-pc-url");
  const inputPcToken = document.getElementById("input-pc-token");
  const pcSyncStatus = document.getElementById("pc-sync-status");
  const btnPcSyncTest = document.getElementById("btn-pc-sync-test");
  const btnPcSyncSave = document.getElementById("btn-pc-sync-save");
  const btnPcSyncNow = document.getElementById("btn-pc-sync-now");
  const btnClosePcSync = document.getElementById("btn-close-pc-sync");

  const toastEl = document.getElementById("toast");

  // ---------- State ----------
  let currentStudent = null;
  let currentRecordings = [];
  let timerInterval = null;
  let playingAudio = null;
  let playingId = null;
  let pendingConfirm = null;
  let actionStudentId = null;
  const PAUSE_ICON =
    '<svg viewBox="0 0 24 24" width="26" height="26"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';
  const RESUME_ICON =
    '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>';

  // ---------- Helpers ----------
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2600);
  }

  function showScreen(screen) {
    [screenStudents, screenRecording].forEach((s) => s.classList.remove("screen--active"));
    screen.classList.add("screen--active");
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
  }
  function closeModal(modal) {
    modal.classList.add("hidden");
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatTimer(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad(m)}:${pad(s)}`;
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${date} · ${time} Uhr`;
  }

  function extensionFor(mimeType) {
    if (!mimeType) return "audio";
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("aac")) return "aac";
    if (mimeType.includes("ogg")) return "ogg";
    return "audio";
  }

  function fileNameFor(studentName, createdAt, mimeType) {
    const d = new Date(createdAt);
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const safeName = studentName.replace(/[^\p{L}\p{N}_-]+/gu, "_");
    return `${safeName}_${stamp}.${extensionFor(mimeType)}`;
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const AVATAR_COLORS = ["#0ea5e9", "#6366f1", "#14b8a6", "#f59e0b", "#e11d48", "#8b5cf6", "#0d9488", "#ca8a04"];
  function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  function confirmDialog(title, text, onConfirm) {
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    pendingConfirm = onConfirm;
    openModal(modalConfirm);
  }

  // ---------- Students ----------
  async function renderStudents() {
    const students = await DB.getStudents();
    studentList.innerHTML = "";
    studentEmpty.classList.toggle("hidden", students.length > 0);

    for (const student of students) {
      const count = await DB.countRecordingsByStudent(student.id);
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="student-row">
          <button class="student-row__main" data-id="${student.id}" action-summary="Öffnet die Aufnahmeansicht für ${escapeHtml(student.name)}">
            <span class="student-row__avatar" style="background:${avatarColor(student.name)}">${escapeHtml(initials(student.name))}</span>
            <span class="student-row__text">
              <span class="student-row__name">${escapeHtml(student.name)}</span>
              <span class="student-row__meta">${count} Aufnahme${count === 1 ? "" : "n"}</span>
            </span>
          </button>
          <button class="student-row__menu" data-menu-id="${student.id}" aria-label="Optionen für ${escapeHtml(student.name)}" action-summary="Öffnet Umbenennen/Löschen für ${escapeHtml(student.name)}">
            <svg viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="5.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor"/></svg>
          </button>
        </span>
      `;
      studentList.appendChild(li);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  studentList.addEventListener("click", async (e) => {
    const menuBtn = e.target.closest("[data-menu-id]");
    if (menuBtn) {
      actionStudentId = Number(menuBtn.dataset.menuId);
      const students = await DB.getStudents();
      const student = students.find((s) => s.id === actionStudentId);
      if (student) {
        studentActionsTitle.textContent = student.name;
        openModal(modalStudentActions);
      }
      return;
    }
    const tile = e.target.closest(".student-row__main");
    if (tile) {
      const id = Number(tile.dataset.id);
      const students = await DB.getStudents();
      const student = students.find((s) => s.id === id);
      if (student) openRecordingScreen(student);
    }
  });

  // ---------- Schüler-Aktionen (Umbenennen/Löschen) ----------
  btnActionCancel.addEventListener("click", () => closeModal(modalStudentActions));

  btnActionDelete.addEventListener("click", async () => {
    closeModal(modalStudentActions);
    const id = actionStudentId;
    const students = await DB.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) return;
    confirmDialog(
      "Schüler löschen?",
      `${student.name} und alle zugehörigen Aufnahmen werden dauerhaft gelöscht.`,
      async () => {
        await DB.deleteStudent(id);
        await renderStudents();
        toast("Schüler gelöscht");
      }
    );
  });

  btnActionRename.addEventListener("click", async () => {
    closeModal(modalStudentActions);
    const students = await DB.getStudents();
    const student = students.find((s) => s.id === actionStudentId);
    if (!student) return;
    inputRenameStudent.value = student.name;
    openModal(modalRenameStudent);
    setTimeout(() => inputRenameStudent.focus(), 50);
  });

  btnCancelRenameStudent.addEventListener("click", () => closeModal(modalRenameStudent));

  async function confirmRenameStudent() {
    const name = inputRenameStudent.value.trim();
    if (!name) {
      inputRenameStudent.focus();
      return;
    }
    await DB.updateStudent(actionStudentId, name);
    if (currentStudent && currentStudent.id === actionStudentId) {
      currentStudent.name = name;
      recordingStudentName.textContent = name;
    }
    closeModal(modalRenameStudent);
    await renderStudents();
  }

  btnConfirmRenameStudent.addEventListener("click", confirmRenameStudent);
  inputRenameStudent.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmRenameStudent();
  });

  btnAddStudent.addEventListener("click", () => openAddStudentModal());
  btnAddStudentEmpty.addEventListener("click", () => openAddStudentModal());

  function openAddStudentModal() {
    inputStudentName.value = "";
    openModal(modalAddStudent);
    setTimeout(() => inputStudentName.focus(), 50);
  }

  btnCancelAddStudent.addEventListener("click", () => closeModal(modalAddStudent));

  async function confirmAddStudent() {
    const name = inputStudentName.value.trim();
    if (!name) {
      inputStudentName.focus();
      return;
    }
    await DB.addStudent(name);
    closeModal(modalAddStudent);
    await renderStudents();
  }

  btnConfirmAddStudent.addEventListener("click", confirmAddStudent);
  inputStudentName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmAddStudent();
  });

  // ---------- Recording screen ----------
  async function openRecordingScreen(student) {
    currentStudent = student;
    recordingStudentName.textContent = student.name;
    resetRecorderUI();
    showScreen(screenRecording);
    await renderRecordings();
  }

  btnBack.addEventListener("click", async () => {
    if (Recorder.getState() !== "idle") {
      toast("Bitte zuerst die Aufnahme stoppen");
      return;
    }
    stopPlayback();
    showScreen(screenStudents);
    await renderStudents();
  });

  function resetRecorderUI() {
    stateLabel.textContent = "Bereit";
    timerEl.textContent = "00:00";
    recorderHint.textContent = "Zum Starten tippen";
    levelBar.style.width = "0%";
    btnPause.classList.add("hidden");
    btnRecord.classList.remove("is-recording");
    btnRecord.setAttribute("aria-label", "Aufnahme starten");
    btnPause.innerHTML = PAUSE_ICON;
    btnPause.dataset.mode = "pause";
  }

  function startTimerLoop() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerEl.textContent = formatTimer(Recorder.getElapsedMs());
    }, 250);
  }
  function stopTimerLoop() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  btnRecord.addEventListener("click", async () => {
    const state = Recorder.getState();
    if (state === "idle") {
      try {
        await Recorder.start((level) => {
          levelBar.style.width = `${Math.round(level * 100)}%`;
        });
      } catch (err) {
        console.error(err);
        toast("Mikrofonzugriff nicht möglich. Bitte Berechtigung prüfen.");
        return;
      }
      btnRecord.classList.add("is-recording");
      btnRecord.setAttribute("aria-label", "Stoppen und speichern");
      btnPause.classList.remove("hidden");
      stateLabel.textContent = "Aufnahme";
      recorderHint.textContent = "Aufnahme läuft …";
      startTimerLoop();
      return;
    }

    // Läuft bereits (aufnehmend oder pausiert) -> stoppen und speichern.
    stopTimerLoop();
    const result = await Recorder.stop();
    resetRecorderUI();
    levelBar.style.width = "0%";

    if (!result || result.durationMs < 300) {
      toast("Aufnahme zu kurz, nicht gespeichert");
      return;
    }

    await DB.addRecording({
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      blob: result.blob,
      mimeType: result.mimeType,
      durationMs: result.durationMs,
    });
    toast("Aufnahme gespeichert");
    await renderRecordings();
    syncPendingRecordings({ silent: true });
  });

  btnPause.addEventListener("click", () => {
    const state = Recorder.getState();
    if (state === "recording") {
      Recorder.pause();
      btnPause.innerHTML = RESUME_ICON;
      btnPause.dataset.mode = "resume";
      stateLabel.textContent = "Pause";
      recorderHint.textContent = "Aufnahme pausiert";
      btnRecord.classList.remove("is-recording");
    } else if (state === "paused") {
      Recorder.resume();
      btnPause.innerHTML = PAUSE_ICON;
      btnPause.dataset.mode = "pause";
      stateLabel.textContent = "Aufnahme";
      recorderHint.textContent = "Aufnahme läuft …";
      btnRecord.classList.add("is-recording");
    }
  });

  // ---------- Recordings list ----------
  async function renderRecordings() {
    stopPlayback();
    currentRecordings = await DB.getRecordingsByStudent(currentStudent.id);
    recordingListEl.innerHTML = "";
    recordingEmpty.classList.toggle("hidden", currentRecordings.length > 0);

    for (const rec of currentRecordings) {
      const li = document.createElement("li");
      li.className = "recording-item";
      li.dataset.id = rec.id;
      li.innerHTML = `
        <button class="recording-item__play" data-play-id="${rec.id}" aria-label="Abspielen" action-summary="Spielt die Aufnahme ab">
          <svg class="play-icon" viewBox="0 0 24 24" width="18" height="18"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>
        </button>
        <span class="recording-item__info">
          <span class="recording-item__title">${escapeHtml(formatDateTime(rec.createdAt))}</span>
          <span class="recording-item__meta">${formatTimer(rec.durationMs)} min</span>
        </span>
        <span class="recording-item__actions">
          <button class="recording-item__btn" data-share-id="${rec.id}" aria-label="Teilen" action-summary="Öffnet das Teilen-Menü für diese Aufnahme">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 15V3m0 0 4 4m-4-4-4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="recording-item__btn" data-delete-rec-id="${rec.id}" aria-label="Löschen" action-summary="Löscht diese Aufnahme">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>
          </button>
        </span>
      `;
      recordingListEl.appendChild(li);
    }
  }

  function stopPlayback() {
    if (playingAudio) {
      playingAudio.pause();
      if (playingAudio._url) URL.revokeObjectURL(playingAudio._url);
      playingAudio = null;
    }
    if (playingId) {
      const btn = recordingListEl.querySelector(`[data-play-id="${playingId}"] .play-icon`);
      if (btn) setPlayIcon(btn, false);
    }
    playingId = null;
  }

  function setPlayIcon(svgEl, isPlaying) {
    svgEl.innerHTML = isPlaying
      ? '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'
      : '<path d="M7 5v14l12-7z" fill="currentColor"/>';
  }

  recordingListEl.addEventListener("click", async (e) => {
    const playBtn = e.target.closest("[data-play-id]");
    if (playBtn) {
      const id = Number(playBtn.dataset.playId);
      const icon = playBtn.querySelector(".play-icon");

      if (playingId === id) {
        stopPlayback();
        return;
      }
      stopPlayback();

      const rec = currentRecordings.find((r) => r.id === id);
      if (!rec) return;
      const url = URL.createObjectURL(rec.blob);
      const audio = new Audio(url);
      audio._url = url;
      audio.addEventListener("ended", () => {
        setPlayIcon(icon, false);
        if (playingId === id) playingId = null;
        URL.revokeObjectURL(url);
      });
      playingAudio = audio;
      playingId = id;
      setPlayIcon(icon, true);
      audio.play().catch(() => toast("Wiedergabe nicht möglich"));
      return;
    }

    const shareBtn = e.target.closest("[data-share-id]");
    if (shareBtn) {
      const id = Number(shareBtn.dataset.shareId);
      const rec = currentRecordings.find((r) => r.id === id);
      if (!rec) return;
      try {
        const result = await ShareUtil.shareRecording({
          blob: rec.blob,
          mimeType: rec.mimeType,
          fileName: fileNameFor(rec.studentName, rec.createdAt, rec.mimeType),
        });
        if (result === "downloaded") toast("Herunterladen gestartet");
      } catch (err) {
        console.error(err);
        toast("Teilen nicht möglich");
      }
      return;
    }

    const delBtn = e.target.closest("[data-delete-rec-id]");
    if (delBtn) {
      const id = Number(delBtn.dataset.deleteRecId);
      confirmDialog("Aufnahme löschen?", "Diese Aufnahme wird dauerhaft gelöscht.", async () => {
        stopPlayback();
        await DB.deleteRecording(id);
        await renderRecordings();
        await renderStudents();
      });
    }
  });

  // ---------- Mic settings modal ----------
  btnMicSettings.addEventListener("click", async () => {
    selectMic.innerHTML = "<option>Lade Mikrofone …</option>";
    openModal(modalMic);
    try {
      const devices = await Recorder.ensurePermissionAndList();
      selectMic.innerHTML = "";
      if (devices.length === 0) {
        selectMic.innerHTML = "<option value=''>Kein Mikrofon gefunden</option>";
        return;
      }
      devices.forEach((d, i) => {
        const opt = document.createElement("option");
        opt.value = d.deviceId;
        opt.textContent = d.label || `Mikrofon ${i + 1}`;
        selectMic.appendChild(opt);
      });
      const current = Recorder.getDevice();
      if (current) selectMic.value = current;
    } catch (err) {
      console.error(err);
      selectMic.innerHTML = "<option value=''>Mikrofone konnten nicht geladen werden</option>";
    }
  });

  btnCloseMic.addEventListener("click", () => {
    Recorder.setDevice(selectMic.value || null);
    try {
      localStorage.setItem("klassen-aufnahme:mic", selectMic.value || "");
    } catch (e) {
      /* localStorage evtl. nicht verfügbar */
    }
    closeModal(modalMic);
  });

  // ---------- Confirm modal ----------
  btnConfirmCancel.addEventListener("click", () => {
    pendingConfirm = null;
    closeModal(modalConfirm);
  });
  btnConfirmOk.addEventListener("click", async () => {
    const action = pendingConfirm;
    pendingConfirm = null;
    closeModal(modalConfirm);
    if (action) await action();
  });

  // ---------- PC-Sync-Modal ----------
  function openPcSyncModal() {
    const { url, token } = PCSync.getSettings();
    inputPcUrl.value = url;
    inputPcToken.value = token;
    pcSyncStatus.textContent = "";
    openModal(modalPcSync);
  }

  btnPcSync.addEventListener("click", openPcSyncModal);
  btnClosePcSync.addEventListener("click", () => closeModal(modalPcSync));

  btnPcSyncSave.addEventListener("click", () => {
    PCSync.saveSettings(inputPcUrl.value, inputPcToken.value);
    pcSyncStatus.textContent = "Gespeichert.";
  });

  btnPcSyncTest.addEventListener("click", async () => {
    PCSync.saveSettings(inputPcUrl.value, inputPcToken.value);
    pcSyncStatus.textContent = "Teste Verbindung …";
    const result = await PCSync.checkHealth();
    pcSyncStatus.textContent = result.ok ? "PC erreichbar ✓" : `Nicht erreichbar: ${result.error || "unbekannter Fehler"}`;
  });

  btnPcSyncNow.addEventListener("click", async () => {
    await syncPendingRecordings({ silent: false });
  });

  // Überlagerungen: Klick außerhalb schließt (außer während Aufnahme nicht relevant hier)
  [modalAddStudent, modalMic, modalConfirm, modalPcSync, modalStudentActions, modalRenameStudent].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // ---------- PC-Synchronisierung im Hintergrund ----------
  async function syncPendingRecordings({ silent }) {
    if (!PCSync.isConfigured()) {
      if (!silent) toast("Bitte zuerst PC-Server einrichten");
      return;
    }

    const health = await PCSync.checkHealth();
    if (!health.ok) {
      if (!silent) toast(`PC nicht erreichbar (${health.error || "unbekannt"})`);
      return;
    }

    const pending = await DB.getAllRecordings();
    if (pending.length === 0) {
      if (!silent) toast("Nichts zu synchronisieren");
      return;
    }

    let successCount = 0;
    for (const rec of pending) {
      try {
        const fileName = fileNameFor(rec.studentName, rec.createdAt, rec.mimeType);
        await PCSync.uploadRecording({
          blob: rec.blob,
          mimeType: rec.mimeType,
          studentName: rec.studentName,
          fileName,
        });
        // Nach erfolgreichem Sync lokal löschen - liegt jetzt im OneDrive-Ordner.
        if (playingId === rec.id) stopPlayback();
        await DB.deleteRecording(rec.id);
        successCount++;
      } catch (err) {
        console.warn("PC-Sync fehlgeschlagen für Aufnahme", rec.id, err);
      }
    }

    if (successCount > 0) {
      toast(`${successCount} Aufnahme${successCount === 1 ? "" : "n"} an PC gesendet und lokal gelöscht`);
      if (currentStudent) await renderRecordings();
      await renderStudents();
    } else if (!silent) {
      toast("Synchronisierung fehlgeschlagen");
    }
  }

  // ---------- Init ----------
  async function init() {
    try {
      const savedMic = localStorage.getItem("klassen-aufnahme:mic");
      if (savedMic) Recorder.setDevice(savedMic);
    } catch (e) {
      /* ignore */
    }

    if ("serviceWorker" in navigator) {
      // Selbst-Update: erzwingt eine echte Netzwerk-Prüfung auf eine neue
      // Version und lädt die Seite einmalig automatisch neu, sobald eine
      // neue Version übernommen hat - kein manuelles Cache-Löschen mehr nötig.
      navigator.serviceWorker
        .register("service-worker.js")
        .then((reg) => {
          reg.update().catch(() => {});
          setInterval(() => reg.update().catch(() => {}), 60 * 1000);
        })
        .catch((err) => {
          console.warn("Service Worker Registrierung fehlgeschlagen:", err);
        });

      let reloadedForUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloadedForUpdate) return;
        reloadedForUpdate = true;
        window.location.reload();
      });
    }

    await renderStudents();

    syncPendingRecordings({ silent: true });

    // Erneuter Versuch, sobald die App wieder sichtbar wird (z.B. aus dem
    // Hintergrund geholt) oder die Netzwerkverbindung zurückkommt - nicht nur
    // beim allerersten Laden. So reicht es, die App kurz zu öffnen, sobald
    // man wieder in Reichweite des PCs ist, ohne manuell etwas anzustoßen.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        syncPendingRecordings({ silent: true });
      }
    });
    window.addEventListener("online", () => {
      syncPendingRecordings({ silent: true });
    });
    setInterval(() => {
      if (document.visibilityState === "visible") {
        syncPendingRecordings({ silent: true });
      }
    }, 2 * 60 * 1000);
  }

  init();
})();
