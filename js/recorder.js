// Aufnahme-Logik: Mikrofon-Auswahl, Start/Pause/Resume/Stop, Pegelanzeige.
const Recorder = (() => {
  let stream = null;
  let mediaRecorder = null;
  let chunks = [];
  let audioContext = null;
  let analyser = null;
  let levelRaf = null;
  let startTime = 0;
  let pausedAccum = 0;
  let pauseStartedAt = null;
  let selectedDeviceId = null;
  let state = "idle"; // idle | recording | paused
  let onLevelCb = null;

  function pickMimeType() {
    const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"];
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    }
    return "";
  }

  async function ensurePermissionAndList() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach((t) => t.stop());
    } catch (e) {
      // Erlaubnis verweigert oder kein Mikrofon vorhanden – trotzdem versuchen zu listen.
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }

  function setDevice(deviceId) {
    selectedDeviceId = deviceId || null;
  }

  function getDevice() {
    return selectedDeviceId;
  }

  async function start(onLevel) {
    if (state !== "idle") return;
    onLevelCb = onLevel || null;

    const constraints = {
      audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);

    setupLevelMeter(stream);

    const mimeType = pickMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.start();
    state = "recording";
    startTime = Date.now();
    pausedAccum = 0;
    pauseStartedAt = null;
  }

  function pause() {
    if (state !== "recording") return;
    mediaRecorder.pause();
    pauseStartedAt = Date.now();
    state = "paused";
  }

  function resume() {
    if (state !== "paused") return;
    mediaRecorder.resume();
    pausedAccum += Date.now() - pauseStartedAt;
    pauseStartedAt = null;
    state = "recording";
  }

  function stop() {
    return new Promise((resolve) => {
      if (!mediaRecorder || state === "idle") {
        resolve(null);
        return;
      }
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || (chunks[0] && chunks[0].type) || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });
        const endTime = Date.now();
        const extraPause = pauseStartedAt ? endTime - pauseStartedAt : 0;
        const durationMs = Math.max(0, endTime - startTime - pausedAccum - extraPause);
        cleanup();
        resolve({ blob, mimeType, durationMs });
      };
      mediaRecorder.stop();
    });
  }

  function cleanup() {
    stopLevelMeter();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    mediaRecorder = null;
    chunks = [];
    state = "idle";
    startTime = 0;
    pausedAccum = 0;
    pauseStartedAt = null;
    onLevelCb = null;
  }

  function setupLevelMeter(mediaStream) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (onLevelCb) onLevelCb(Math.min(1, rms * 4));
        levelRaf = requestAnimationFrame(tick);
      };
      levelRaf = requestAnimationFrame(tick);
    } catch (e) {
      // AudioContext nicht verfügbar – Pegelanzeige wird einfach übersprungen.
    }
  }

  function stopLevelMeter() {
    if (levelRaf) cancelAnimationFrame(levelRaf);
    levelRaf = null;
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
  }

  function getState() {
    return state;
  }

  function getElapsedMs() {
    if (state === "idle") return 0;
    const now = Date.now();
    const pauseExtra = pauseStartedAt ? now - pauseStartedAt : 0;
    return now - startTime - pausedAccum - pauseExtra;
  }

  return {
    ensurePermissionAndList,
    setDevice,
    getDevice,
    start,
    pause,
    resume,
    stop,
    getState,
    getElapsedMs,
  };
})();
