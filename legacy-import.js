// ── Régi, böngészőben tárolt helyi projektek elérése (csak importáláshoz) ─────
//
// A korábbi verzió a helyi mappás projekteket a böngésző IndexedDB-jében is tárolta.
// A szerkesztő mostantól csak a felhővel dolgozik, de ezek a régi projektek nem
// vesznek el: az Importálás ablakban felhő Dokumentummá alakíthatók.

const LEGACY_DB_NAME = 'kezikonyv-editor';
const LEGACY_STORE = 'projects';
const LEGACY_FILES_STORE = 'files';

function openLegacyDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(LEGACY_DB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE)) db.createObjectStore(LEGACY_STORE, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(LEGACY_FILES_STORE)) {
        db.createObjectStore(LEGACY_FILES_STORE, { keyPath: 'key' }).createIndex('project', 'project');
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

function legacyGet(db, store, fn) {
  return new Promise(resolve => {
    const req = fn(db.transaction(store, 'readonly').objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

// A régi HELYI (nem felhős) projektek listája, teljes tartalommal.
// Visszatérés: [{ name, title, config, css, logo, files: { fn: raw } }]
async function listLegacyLocalProjects() {
  let db;
  try {
    db = await openLegacyDB();
    const all = (await legacyGet(db, LEGACY_STORE, s => s.getAll())) || [];
    const out = [];
    for (const saved of all) {
      if (saved.cloudFolder) continue; // a felhős dokumentumok már a felhőben vannak
      const files = {};
      for (const fn of saved.fileOrder || []) {
        const rec = (saved.files && saved.files[fn]) || (await legacyGet(db, LEGACY_FILES_STORE, s => s.get(saved.name + '::' + fn)));
        if (rec && rec.raw) files[fn] = rec.raw;
      }
      out.push({
        name: saved.name,
        title: (saved.config && saved.config.title) || saved.name,
        config: Object.assign({}, saved.config || {}, { fileOrder: saved.fileOrder || [] }),
        css: saved.css || '',
        logo: saved.logo || '',
        files
      });
    }
    return out;
  } catch(e) {
    console.warn('Régi projektek olvasása sikertelen:', e);
    return [];
  } finally {
    if (db) db.close();
  }
}
