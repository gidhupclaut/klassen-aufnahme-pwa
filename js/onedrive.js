// Direkte OneDrive-Anbindung über Microsoft Graph (MSAL.js, PKCE, kein Server nötig).
// Zugriff ist auf den App-eigenen Ordner in OneDrive beschränkt (Files.ReadWrite.AppFolder).
const OneDrive = (() => {
  let msalInstance = null;
  let account = null;
  let readyPromise = null;

  function ensureInit() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      msalInstance = new msal.PublicClientApplication({
        auth: {
          clientId: ONEDRIVE_CONFIG.clientId,
          authority: ONEDRIVE_CONFIG.authority,
          redirectUri: ONEDRIVE_CONFIG.redirectUri,
        },
        cache: {
          cacheLocation: "localStorage",
          storeAuthStateInCookie: false,
        },
      });
      await msalInstance.initialize();

      const result = await msalInstance.handleRedirectPromise();
      if (result && result.account) {
        account = result.account;
      } else {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) account = accounts[0];
      }
    })();
    return readyPromise;
  }

  async function signIn() {
    await ensureInit();
    await msalInstance.loginRedirect({
      scopes: ONEDRIVE_CONFIG.scopes,
      redirectUri: ONEDRIVE_CONFIG.redirectUri,
    });
  }

  async function signOut() {
    await ensureInit();
    if (!account) return;
    await msalInstance.logoutRedirect({
      account,
      postLogoutRedirectUri: ONEDRIVE_CONFIG.redirectUri,
    });
  }

  function isSignedIn() {
    return !!account;
  }

  function getAccountLabel() {
    if (!account) return null;
    return account.username || account.name || "Verbunden";
  }

  async function getToken() {
    await ensureInit();
    if (!account) throw new Error("not-signed-in");
    try {
      const result = await msalInstance.acquireTokenSilent({
        scopes: ONEDRIVE_CONFIG.scopes,
        account,
      });
      return result.accessToken;
    } catch (e) {
      await msalInstance.acquireTokenRedirect({
        scopes: ONEDRIVE_CONFIG.scopes,
        account,
        redirectUri: ONEDRIVE_CONFIG.redirectUri,
      });
      throw new Error("redirecting-for-auth");
    }
  }

  function sanitizeSegment(name) {
    return name.replace(/[\\/:*?"<>|]+/g, "_");
  }

  async function uploadRecording({ blob, fileName, studentName, onProgress }) {
    const token = await getToken();
    const folder = sanitizeSegment(studentName);
    const path = `${folder}/${fileName}`;
    const encodedPath = path
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const SMALL_LIMIT = 4 * 1024 * 1024;

    if (blob.size <= SMALL_LIMIT) {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedPath}:/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": blob.type || "application/octet-stream",
          },
          body: blob,
        }
      );
      if (!res.ok) throw new Error(`Upload fehlgeschlagen (${res.status})`);
      return res.json();
    }

    const sessionRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedPath}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
      }
    );
    if (!sessionRes.ok) throw new Error(`Upload-Session fehlgeschlagen (${sessionRes.status})`);
    const session = await sessionRes.json();
    const uploadUrl = session.uploadUrl;

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB, Vielfaches von 320 KiB
    let offset = 0;
    let lastJson = null;

    while (offset < blob.size) {
      const end = Math.min(offset + CHUNK_SIZE, blob.size);
      const chunk = blob.slice(offset, end);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(end - offset),
          "Content-Range": `bytes ${offset}-${end - 1}/${blob.size}`,
        },
        body: chunk,
      });
      if (!res.ok && res.status !== 202) {
        throw new Error(`Chunk-Upload fehlgeschlagen (${res.status})`);
      }
      if (onProgress) onProgress(end / blob.size);
      lastJson = res.status !== 202 ? await res.json().catch(() => null) : null;
      offset = end;
    }

    return lastJson;
  }

  return {
    ensureInit,
    signIn,
    signOut,
    isSignedIn,
    getAccountLabel,
    uploadRecording,
  };
})();
