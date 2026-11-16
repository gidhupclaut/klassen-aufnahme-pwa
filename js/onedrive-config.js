// Konfiguration für die direkte OneDrive-Anbindung (Microsoft Graph).
// clientId kommt aus der Azure-App-Registrierung (Schritt-für-Schritt-Anleitung
// im Chat) – ist eine öffentliche App-ID, kein Geheimnis.
const ONEDRIVE_CONFIG = {
  clientId: "PASTE_CLIENT_ID_HERE",
  authority: "https://login.microsoftonline.com/common",
  redirectUri: "https://gidhupclaut.github.io/klassen-aufnahme-pwa/index.html",
  scopes: ["Files.ReadWrite.AppFolder"],
};
