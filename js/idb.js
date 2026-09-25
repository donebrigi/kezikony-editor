// ── IndexedDB perzisztencia (böngészőn belüli helyi másolat) ──────────────────
// v2: a fejezetek tartalma (raw markdown, benne a base64 képekkel) külön
// 'files' store-ba kerül, projektenkénti kulccsal. Így a gépelés közbeni
// automentés csak az ÉPPEN szerkesztett fejezetet írja ki, nem az egész projektet.
const DB_NAME = 'kezikonyv-editor';
const DB_VERSION = 2;
const STORE = 'projects';
const FILES_STORE = 'files';

function fileKey(projectName, fn) { return projectName + '::' + fn; }

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const fs = db.createObjectStore(FILES_STORE, { keyPath: 'key' });
        fs.createIndex('project', 'project');
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

// Egy tranzakció lefuttatása: a callback megkapja a store-okat, a függvény a
// tranzakció befejezésekor tér vissza. Minden hibát elnyel és konzolra ír.
async function idbTx(storeNames, mode, fn) {
  let db;
  try {
    db = await openDB();
    const tx = db.transaction(storeNames, mode);
    const result = fn(tx);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
    return result;
  } catch(e) {
    console.warn('IndexedDB hiba:', e);
    return undefined;
  } finally {
    if (db) db.close();
  }
}

function projectMetaRecord(proj, currentFile) {
  return {
    name: proj.name,
    config: proj.config,
    css: proj.css,
    logo: proj.logo,
    fileOrder: proj.fileOrder,
    currentFile: currentFile || null,
    cloudFolder: proj.cloudFolder || null,
    topProjectId: proj.topProjectId || null,
    docId: proj.docId || null,
    // Induláskor ez alapján választjuk ki az utoljára használt projektet (korábban
    // a kulcs szerinti utolsó — azaz ábécében utolsó — projekt töltődött vissza).
    updatedAt: Date.now()
  };
}

// Teljes mentés: projekt metaadatok + MINDEN fejezet.
async function persistProject(proj) {
  if (!proj) return;
  const currentFile = proj.name === state.currentProject ? state.currentFile : null;
  await idbTx([STORE, FILES_STORE], 'readwrite', tx => {
    tx.objectStore(STORE).put(projectMetaRecord(proj, currentFile));
    const filesStore = tx.objectStore(FILES_STORE);
    for (const fn of proj.fileOrder) {
      const f = proj.files[fn];
      if (!f) continue;
      filesStore.put({ key: fileKey(proj.name, fn), project: proj.name, fn, meta: f.meta, content: f.content, raw: f.raw });
    }
  });
}

// Az aktuális projekt teljes mentése (a régi kód ezt hívta mindenhol).
async function persistState() {
  if (!state.currentProject) return;
  await persistProject(state.projects[state.currentProject]);
}

// Könnyű mentés: csak a projekt metaadatai (config, css, logó, sorrend) — fejezetek nélkül.
async function persistProjectMeta(proj) {
  if (!proj) return;
  const currentFile = proj.name === state.currentProject ? state.currentFile : null;
  await idbTx(STORE, 'readwrite', tx => { tx.objectStore(STORE).put(projectMetaRecord(proj, currentFile)); });
}

// Könnyű automentés gépelés közben: meta + csak az aktuális fejezet.
async function persistCurrentFile() {
  if (!state.currentProject || !state.currentFile) return;
  const proj = state.projects[state.currentProject];
  const f = proj && proj.files[state.currentFile];
  if (!f) return;
  await idbTx([STORE, FILES_STORE], 'readwrite', tx => {
    tx.objectStore(STORE).put(projectMetaRecord(proj, state.currentFile));
    tx.objectStore(FILES_STORE).put({
      key: fileKey(proj.name, state.currentFile), project: proj.name, fn: state.currentFile,
      meta: f.meta, content: f.content, raw: f.raw
    });
  });
}

async function deleteFileRecord(projectName, fn) {
  await idbTx(FILES_STORE, 'readwrite', tx => { tx.objectStore(FILES_STORE).delete(fileKey(projectName, fn)); });
}

async function deleteAllFileRecordsForProject(projectName) {
  await idbTx(FILES_STORE, 'readwrite', tx => {
    const req = tx.objectStore(FILES_STORE).index('project').openCursor(IDBKeyRange.only(projectName));
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  });
}

// Projekt teljes eltávolítása az IndexedDB-ből (meta + fejezetek).
// Korábban ez a kódrészlet négy helyen is szó szerint ismétlődött.
async function deleteProjectRecords(projectName) {
  await idbTx(STORE, 'readwrite', tx => { tx.objectStore(STORE).delete(projectName); });
  await deleteAllFileRecordsForProject(projectName);
}

function idbRequest(storeName, makeReq) {
  return new Promise(async (resolve) => {
    let db;
    try {
      db = await openDB();
      const req = makeReq(db.transaction(storeName, 'readonly').objectStore(storeName));
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { resolve(null); db.close(); };
    } catch(e) { if (db) db.close(); resolve(null); }
  });
}

function getFileRecord(projectName, fn) {
  return idbRequest(FILES_STORE, s => s.get(fileKey(projectName, fn)));
}

// Az összes mentett projekt beolvasása a state.projects-be. NEM navigál — az
// indításkori döntést (melyik nézet nyíljon meg) az app.js initApp() hozza meg.
// Visszatérési érték: az utoljára használt projekt mentett meta rekordja, vagy null.
async function loadPersistedProjects() {
  const all = (await idbRequest(STORE, s => s.getAll())) || [];
  if (!all.length) return null;

  for (const saved of all) {
    const project = {
      name: saved.name,
      config: saved.config || {},
      css: saved.css || getDefaultCSS(),
      logo: saved.logo || '',
      fileOrder: saved.fileOrder || [],
      files: {}
    };
    if (saved.cloudFolder) project.cloudFolder = saved.cloudFolder;
    if (saved.topProjectId) project.topProjectId = saved.topProjectId;
    if (saved.docId) project.docId = saved.docId;
    for (const fn of project.fileOrder) {
      // v1 (régi) rekordoknál a fájltartalom még a projekt meta rekordba volt ágyazva.
      const sf = (saved.files && saved.files[fn]) || (await getFileRecord(saved.name, fn)) || {};
      project.files[fn] = makeFileEntry(sf.raw || '', { meta: sf.meta, content: sf.content });
    }
    registerProject(project);
  }

  return all.reduce((a, b) => ((b.updatedAt || 0) >= (a.updatedAt || 0) ? b : a));
}
