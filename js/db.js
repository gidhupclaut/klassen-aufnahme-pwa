// Lokale IndexedDB-Datenschicht: Schüler + Aufnahmen. Keine Daten verlassen das Gerät.
const DB = (() => {
  const DB_NAME = "klassen-aufnahme-db";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("students")) {
          const store = db.createObjectStore("students", { keyPath: "id", autoIncrement: true });
          store.createIndex("byName", "name");
        }

        if (!db.objectStoreNames.contains("recordings")) {
          const store = db.createObjectStore("recordings", { keyPath: "id", autoIncrement: true });
          store.createIndex("byStudent", "studentId");
          store.createIndex("byCreatedAt", "createdAt");
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeNames, mode) {
    const db = await open();
    return db.transaction(storeNames, mode);
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function addStudent(name) {
    const t = await tx(["students"], "readwrite");
    const store = t.objectStore("students");
    const student = { name: name.trim(), createdAt: Date.now() };
    const id = await wrap(store.add(student));
    return { ...student, id };
  }

  async function getStudents() {
    const t = await tx(["students"], "readonly");
    const store = t.objectStore("students");
    const all = await wrap(store.getAll());
    return all.sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  async function deleteStudent(studentId) {
    const t = await tx(["students", "recordings"], "readwrite");
    t.objectStore("students").delete(studentId);
    const recStore = t.objectStore("recordings");
    const index = recStore.index("byStudent");
    const toDelete = await wrap(index.getAllKeys(studentId));
    toDelete.forEach((key) => recStore.delete(key));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function addRecording({ studentId, studentName, blob, mimeType, durationMs }) {
    const t = await tx(["recordings"], "readwrite");
    const store = t.objectStore("recordings");
    const record = {
      studentId,
      studentName,
      blob,
      mimeType,
      durationMs,
      createdAt: Date.now(),
    };
    const id = await wrap(store.add(record));
    return { ...record, id };
  }

  async function getRecordingsByStudent(studentId) {
    const t = await tx(["recordings"], "readonly");
    const store = t.objectStore("recordings");
    const index = store.index("byStudent");
    const all = await wrap(index.getAll(studentId));
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getRecording(id) {
    const t = await tx(["recordings"], "readonly");
    return wrap(t.objectStore("recordings").get(id));
  }

  async function deleteRecording(id) {
    const t = await tx(["recordings"], "readwrite");
    t.objectStore("recordings").delete(id);
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function countRecordingsByStudent(studentId) {
    const t = await tx(["recordings"], "readonly");
    const index = t.objectStore("recordings").index("byStudent");
    return wrap(index.count(studentId));
  }

  async function getAllRecordings() {
    const t = await tx(["recordings"], "readonly");
    return wrap(t.objectStore("recordings").getAll());
  }

  return {
    addStudent,
    getStudents,
    deleteStudent,
    getAllRecordings,
    addRecording,
    getRecordingsByStudent,
    getRecording,
    deleteRecording,
    countRecordingsByStudent,
  };
})();
