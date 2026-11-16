// Konfiguration für die direkte OneDrive-Anbindung (Microsoft Graph).
// clientId kommt aus der Azure-App-Registrierung (Schritt-für-Schritt-Anleitung
// im Chat) – ist eine öffentliche App-ID, kein Geheimnis.
const ONEDRIVE_CONFIG = {
  clientId: "121d4983-4b25-4e9a-b4d8-d1e20576a08c",
  // Multi-Tenant-App (beliebige Arbeits-/Schulkonten jeder Organisation).
  authority: "https://login.microsoftonline.com/organizations",
  redirectUri: "https://gidhupclaut.github.io/klassen-aufnahme-pwa/index.html",
  scopes: ["Files.ReadWrite.AppFolder"],
};
