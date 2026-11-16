// Synchronisiert Aufnahmen an einen kleinen Server im gleichen WLAN, der sie
// in den lokal synchronisierten OneDrive-Ordner auf dem PC legt. Kein
// Microsoft-Login, keine Admin-Freigabe nötig - nur normaler Datei-Upload.
const PCSync = (() => {
  const URL_KEY = "klassen-aufnahme:pcServerUrl";
  const TOKEN_KEY = "klassen-aufnahme:pcServerToken";

  function getSettings() {
    try {
      return {
        url: (localStorage.getItem(URL_KEY) || "").replace(/\/+$/, ""),
        token: localStorage.getItem(TOKEN_KEY) || "",
      };
    } catch (e) {
      return { url: "", token: "" };
    }
  }

  function saveSettings(url, token) {
    try {
      localStorage.setItem(URL_KEY, (url || "").trim().replace(/\/+$/, ""));
      localStorage.setItem(TOKEN_KEY, (token || "").trim());
    } catch (e) {
      /* localStorage evtl. nicht verfügbar */
    }
  }

  function isConfigured() {
    const { url, token } = getSettings();
    return Boolean(url && token);
  }

  async function checkHealth() {
    const { url, token } = getSettings();
    if (!url || !token) return { ok: false, error: "Nicht eingerichtet" };
    try {
      const res = await fetch(`${url}/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return { ok: false, error: `Fehler (${res.status})` };
      return await res.json();
    } catch (e) {
      return { ok: false, error: "PC nicht erreichbar" };
    }
  }

  async function uploadRecording({ blob, mimeType, studentName, fileName }) {
    const { url, token } = getSettings();
    if (!url || !token) throw new Error("not-configured");
    const endpoint = `${url}/upload?student=${encodeURIComponent(studentName)}&filename=${encodeURIComponent(fileName)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: blob,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Upload fehlgeschlagen (${res.status})`);
    return res.json();
  }

  return { getSettings, saveSettings, isConfigured, checkHealth, uploadRecording };
})();
