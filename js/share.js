// Teilen über das native Share-Sheet (iOS: OneDrive, Outlook, Mail, ...).
// Fallback auf Download, falls die Web Share API mit Dateien nicht verfügbar ist.
const ShareUtil = (() => {
  function shareMimeType(mimeType, fileName) {
    // iOS/WebKit ordnet Web-Share-Dateien ihren UTI-Typ eher über bekannte
    // MIME-Strings zu. "audio/mp4" (von MediaRecorder) wird von manchen
    // Share-Extensions (z.B. OneDrive) nicht als Audio erkannt, "audio/x-m4a"
    // dagegen ist der klassische Apple-MIME-Typ für .m4a-Dateien.
    if (fileName.toLowerCase().endsWith(".m4a")) return "audio/x-m4a";
    return mimeType;
  }

  async function shareRecording({ blob, mimeType, fileName }) {
    const file = new File([blob], fileName, { type: shareMimeType(mimeType, fileName) });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return "shared";
      } catch (e) {
        if (e && e.name === "AbortError") return "cancelled";
        throw e;
      }
    }

    downloadBlob(blob, fileName);
    return "downloaded";
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { shareRecording, downloadBlob };
})();
