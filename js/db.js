// Lokale IndexedDB-Datenschicht: Schüler + Aufnahmen. Keine Daten verlassen das Gerät.
const DB = (() => {
  const DB_NAME = "klassen-aufnahme-db";
  const DB_VERSION = 2;
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

        if (!db.objectStoreNames.contains("documents")) {
          const store = db.createObjectStore("documents", { keyPath: "id", autoIncrement: true });
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

  async function updateStudent(id, name) {
    const trimmed = name.trim();
    const t = await tx(["students", "recordings", "documents"], "readwrite");
    const studentStore = t.objectStore("students");
    const student = await wrap(studentStore.get(id));
    if (!student) return;
    student.name = trimmed;
    studentStore.put(student);

    // Denormalisierten Namen auch bei vorhandenen Aufnahmen/Dokumenten
    // aktualisieren, damit Sync-Zielordner und Anzeige konsistent bleiben.
    const recStore = t.objectStore("recordings");
    const recordings = await wrap(recStore.index("byStudent").getAll(id));
    for (const rec of recordings) {
      rec.studentName = trimmed;
      recStore.put(rec);
    }

    const docStore = t.objectStore("documents");
    const documents = await wrap(docStore.index("byStudent").getAll(id));
    for (const doc of documents) {
      doc.studentName = trimmed;
      docStore.put(doc);
    }

    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function deleteStudent(studentId) {
    const t = await tx(["students", "recordings", "documents"], "readwrite");
    t.objectStore("students").delete(studentId);
    const recStore = t.objectStore("recordings");
    const recIndex = recStore.index("byStudent");
    const recToDelete = await wrap(recIndex.getAllKeys(studentId));
    recToDelete.forEach((key) => recStore.delete(key));
    const docStore = t.objectStore("documents");
    const docIndex = docStore.index("byStudent");
    const docToDelete = await wrap(docIndex.getAllKeys(studentId));
    docToDelete.forEach((key) => docStore.delete(key));
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

  async function addDocument({ studentId, studentName, blob, pageCount }) {
    const t = await tx(["documents"], "readwrite");
    const store = t.objectStore("documents");
    const record = {
      studentId,
      studentName,
      blob,
      pageCount,
      createdAt: Date.now(),
    };
    const id = await wrap(store.add(record));
    return { ...record, id };
  }

  async function getDocumentsByStudent(studentId) {
    const t = await tx(["documents"], "readonly");
    const store = t.objectStore("documents");
    const index = store.index("byStudent");
    const all = await wrap(index.getAll(studentId));
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function deleteDocument(id) {
    const t = await tx(["documents"], "readwrite");
    t.objectStore("documents").delete(id);
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function countDocumentsByStudent(studentId) {
    const t = await tx(["documents"], "readonly");
    const index = t.objectStore("documents").index("byStudent");
    return wrap(index.count(studentId));
  }

  async function getAllDocuments() {
    const t = await tx(["documents"], "readonly");
    return wrap(t.objectStore("documents").getAll());
  }

  return {
    addStudent,
    getStudents,
    updateStudent,
    deleteStudent,
    getAllRecordings,
    addRecording,
    getRecordingsByStudent,
    getRecording,
    deleteRecording,
    countRecordingsByStudent,
    addDocument,
    getDocumentsByStudent,
    deleteDocument,
    countDocumentsByStudent,
    getAllDocuments,
  };
})();
