// Teilen über das native Share-Sheet (iOS: OneDrive, Outlook, Mail, ...).
// Fallback auf Download, falls die Web Share API mit Dateien nicht verfügbar ist.
const ShareUtil = (() => {
  async function shareRecording({ blob, mimeType, fileName }) {
    const file = new File([blob], fileName, { type: mimeType });

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
