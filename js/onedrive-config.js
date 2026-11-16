// Konfiguration für die direkte OneDrive-Anbindung (Microsoft Graph).
// clientId kommt aus der Azure-App-Registrierung (Schritt-für-Schritt-Anleitung
// im Chat) – ist eine öffentliche App-ID, kein Geheimnis.
const ONEDRIVE_CONFIG = {
  clientId: "121d4983-4b25-4e9a-b4d8-d1e20576a08c",
  // Single-Tenant-App (nur Empyreum-Organisation) -> Tenant-ID statt "common".
  authority: "https://login.microsoftonline.com/6e289efe-3546-4619-9510-6a20f8f8a1cf",
  redirectUri: "https://gidhupclaut.github.io/klassen-aufnahme-pwa/index.html",
  scopes: ["Files.ReadWrite.AppFolder"],
};
