// Dokumentenscan-Logik: Rückkamera als Live-Vorschau, einzelne Seiten als
// Foto einfangen (kein automatisches Kanten-Erkennen/Zuschneiden - das ist
// ohne native iOS-API wie VisionKit im Web nicht verfügbar - dafür mehrere
// Seiten nacheinander, die am Ende zu einem PDF zusammengefügt werden).
const Scanner = (() => {
  let stream = null;
  let videoEl = null;

  async function start(video) {
    videoEl = video;
    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play();
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    videoEl = null;
  }

  function capture() {
    if (!videoEl) return Promise.resolve(null);
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) return Promise.resolve(null);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, w, h);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          // canvas wird mitgeliefert, damit der Zuschnitt (Cropper/Warp) das
          // Originalfoto in voller Aufloesung verarbeiten kann, ohne es aus
          // dem Blob erneut dekodieren zu muessen.
          resolve({ blob, width: w, height: h, canvas });
        },
        "image/jpeg",
        0.85
      );
    });
  }

  return { start, stop, capture };
})();
