// ── Supabase Cloud (közös tárhely + bejelentkezés) ─────────────────────────────
// Ezek a projekten belül "felhő projektnek" (proj.cloudFolder) nevezett projektek
// forrása és célja: nem a helyi mappába/IndexedDB-be, hanem a Supabase Storage
// "kezikonyv" bucket-jébe olvasnak/írnak, így minden bejelentkezett kolléga
// ugyanazt a tartalmat látja és szerkesztheti.
const SUPABASE_URL = 'https://xnycxkbegnbaxkhtpcev.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_caGEy-9KlDt1vKsICEHv7w_LbUQZADL';
const CLOUD_BUCKET = 'kezikonyv';
// HIBAJAVÍTÁS (CSS visszaállás): a Supabase Storage a feltöltött fájlokat alapból
// "Cache-Control: max-age=3600" fejléccel szolgálja ki, ezért a böngésző egy órán át
// a RÉGI (pl. a dokumentum létrehozásakor feltöltött alapértelmezett) style.css-t adta
// vissza a HTTP gyorsítótárából, hiába volt már felülírva. Minden GET kérést
// gyorsítótár nélkül küldünk, és a feltöltésnél is max-age=0-t kérünk.
//
// HIBAJAVÍTÁS (hamis "ütközés"): a Supabase a fájlokat CDN-ről is kiszolgálhatja, és egy
// felülírás után még akár ~60 másodpercig a RÉGI változatot adhatja vissza. Emiatt a
// mentés előtti ellenőrzés a saját, pár másodperccel korábbi változatunkat "másik
// változatnak" láthatta. Minden letöltés URL-jéhez egyedi paramétert fűzünk, így a CDN
// sosem ad régi, gyorsítótárazott példányt.
function noStoreFetch(input, init) {
  const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  if (method === 'GET') {
    init = Object.assign({}, init, { cache: 'no-store' });
    if (typeof input === 'string' && input.includes('/storage/v1/object/')) {
      input += (input.includes('?') ? '&' : '?') + 'cacheNonce=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
  }
  return fetch(input, init);
}
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: noStoreFetch }
});
function cloudBucket() { return supabaseClient.storage.from(CLOUD_BUCKET); }
async function cloudList(path, limit = 200, sortByName = false) {
  const opts = { limit };
  if (sortByName) opts.sortBy = { column: 'name', order: 'asc' };
  const { data, error } = await cloudBucket().list(path, opts);
  if (error) { console.warn('Cloud list failed:', path, error); return null; }
  return data || [];
}
// Supabase Storage listában a mappák id-je null, a fájloké nem.
const isCloudFolder = e => e.id === null;
const isCloudFile = e => e.id !== null;
// A "⬇ Letöltés" felhős mentése minden alkalommal ide is felkerül, ettől függetlenül,
// hogy a proj.config.output (helyi mappa módban használt, a felhasználó által is
// átnevezhető) fájlnévvel is elmenti — ez egy fix nevű, mindig a legutóbbi build-et
// tartalmazó másolat, amire a megosztható link és a gyors letöltés gomb épül.
const PUBLISH_HTML_NAME = 'published.html';


// ── Storage segédfüggvények ──
async function cloudDownloadText(path) {
  const { data, error } = await cloudBucket().download(path);
  if (error || !data) return null;
  return await data.text();
}
async function cloudDownloadBlob(path) {
  const { data, error } = await cloudBucket().download(path);
  if (error || !data) return null;
  return data;
}
// content: szöveg vagy Blob (képekhez).
async function cloudUpload(path, content, contentType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
  const { error } = await cloudBucket().upload(path, blob, { upsert: true, contentType, cacheControl: '0' });
  if (error) {
    console.warn('Cloud upload failed:', path, error);
    toast('⚠ Felhő mentés sikertelen: ' + path, 'err', 4000);
    return false;
  }
  return true;
}
// Mindegyik true-t ad vissza, ha sikerült (vagy nem felhő projekt → nincs teendő).
async function cloudSaveSectionFile(proj, fn) {
  if (!proj.cloudFolder) return true;
  const f = proj.files[fn];
  if (!f) return true;
  return cloudUpload(proj.cloudFolder + '/sections/' + fn, f.raw, 'text/markdown');
}
async function cloudSaveConfig(proj) {
  if (!proj.cloudFolder) return true;
  return cloudUpload(proj.cloudFolder + '/config.json', serializeConfig(proj), 'application/json');
}
async function cloudSaveCss(proj) {
  if (!proj.cloudFolder) return true;
  return cloudUpload(proj.cloudFolder + '/style.css', proj.css || getDefaultCSS(), 'text/css');
}
async function cloudSaveLogo(proj) {
  if (!proj.cloudFolder) return true;
  return cloudUpload(proj.cloudFolder + '/logo.txt', proj.logo || '', 'text/plain');
}
async function cloudSaveOutput(proj, outputName, html) {
  if (!proj.cloudFolder) return true;
  return cloudUpload(proj.cloudFolder + '/' + outputName, html, 'text/html');
}

// ── Felhő: Projekt (top-szint) és Dokumentum (Projekten belüli kézikönyv) hierarchia ──
// Tárolási szerkezet a Supabase Storage bucket-ben:
//   {projektId}/_project.json              — Projekt metaadat (név, leírás, szín, ikon)
//   {projektId}/{dokumentumId}/config.json — cím, menü, fejezetsorrend
//   {projektId}/{dokumentumId}/style.css, logo.txt, sections/*.md, published.html
// Egy megnyitott Dokumentumnál proj.cloudFolder = "{projektId}/{dokumentumId}".

const PROJECT_COLORS = ['#7c6af7', '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#f472b6', '#fb923c', '#94a3b8'];
const PROJECT_ICONS = ['📁', '📘', '🛠️', '🚀', '🔐', '💻', '📋', '🧯', '⭐', '📦', '🟣', '🟢', '🟡', '🔴', '🔵', '🟠'];

function defaultProjectMeta(id) {
  return { id, name: id, description: '', color: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] };
}

async function cloudGetProjectMeta(projectId) {
  const text = await cloudDownloadText(projectId + '/_project.json');
  if (!text) return null;
  try {
    const m = JSON.parse(text);
    return {
      id: projectId,
      name: m.name || projectId,
      description: m.description || '',
      color: m.color || PROJECT_COLORS[0],
      icon: m.icon || PROJECT_ICONS[0]
    };
  } catch(e) { return null; }
}

// A bucket gyökerében lévő mappák = Projektek azonosítói.
async function cloudListProjectIds() {
  const data = await cloudList('', 200, true);
  return (data || []).filter(isCloudFolder).map(e => e.name);
}

async function cloudListTopProjects() {
  const projects = [];
  for (const id of await cloudListProjectIds()) {
    const meta = (await cloudGetProjectMeta(id)) || defaultProjectMeta(id);
    // A dokumentumszám ugyanabból a cloudListDocuments()-ből jön, amit a Projekt nézet
    // mutat — így csak a valódi (config.json-nal rendelkező) Dokumentum-mappák számítanak.
    meta.docCount = (await cloudListDocuments(id)).length;
    projects.push(meta);
  }
  return projects;
}

const isChapterFile = name => name.endsWith('.md') && name !== 'README.md';

async function cloudListDocuments(projectId) {
  const data = await cloudList(projectId, 200, true);
  // "sections" fenntartott név: a régi, "lapos" felhő projekteknél ez közvetlenül a
  // projekt gyökerében volt — ne jelenjen meg áldokumentumként.
  const docIds = (data || []).filter(e => isCloudFolder(e) && e.name !== 'sections').map(e => e.name);
  const docs = [];
  for (const docId of docIds) {
    const folder = projectId + '/' + docId;
    const configText = await cloudDownloadText(folder + '/config.json');
    if (!configText) continue; // nincs config.json → nem valódi Dokumentum-mappa
    const meta = { id: docId, title: docId, chapterCount: 0, updatedAt: null };
    try { meta.title = JSON.parse(configText).title || docId; } catch(e) {}
    const entries = await cloudList(folder, 20);
    const cfgEntry = (entries || []).find(e => e.name === 'config.json');
    if (cfgEntry && cfgEntry.updated_at) meta.updatedAt = cfgEntry.updated_at;
    // A fejezetszám a sections/ tényleges .md fájljaiból jön, nem a config.json fileOrder-ből.
    const sectionEntries = await cloudList(folder + '/sections', 500);
    meta.chapterCount = (sectionEntries || []).filter(e => isCloudFile(e) && isChapterFile(e.name)).length;
    docs.push(meta);
  }
  return docs;
}

// Egy Dokumentum teljes tartalmának letöltése (config, css, logó, fejezetek).
// A loaders.js cloudLoadProject() ebből építi fel a szerkesztő projekt-objektumát.
async function cloudFetchDocument(folderId) {
  const out = { config: {}, css: '', logo: '', files: {} };
  const configText = await cloudDownloadText(folderId + '/config.json');
  out.configText = configText;
  if (configText) { try { out.config = JSON.parse(configText); } catch(e) {} }
  out.css = (await cloudDownloadText(folderId + '/style.css')) || '';
  out.logo = ((await cloudDownloadText(folderId + '/logo.txt')) || '').trim();
  const entries = await cloudList(folderId + '/sections', 500);
  for (const entry of (entries || [])) {
    if (!isCloudFile(entry) || !isChapterFile(entry.name)) continue;
    const text = await cloudDownloadText(folderId + '/sections/' + entry.name);
    if (text !== null) out.files[entry.name] = text;
  }
  return out;
}

// ── Rekurzív törlés ──
// Az Object Storage-ban nincs valódi mappa, csak addig "létezik" egy elérési út, amíg
// van alatta fájl — ezért minden fájlt egyenként, almappánként törlünk.
async function cloudDeleteAllUnder(path) {
  const data = await cloudList(path, 1000);
  const filePaths = [];
  const subfolders = [];
  for (const e of (data || [])) {
    if (isCloudFile(e)) filePaths.push(path + '/' + e.name);
    else subfolders.push(path + '/' + e.name);
  }
  if (filePaths.length) {
    const { error } = await cloudBucket().remove(filePaths);
    if (error) console.warn('Cloud delete failed:', path, error);
  }
  for (const sub of subfolders) await cloudDeleteAllUnder(sub);
}

async function cloudDeleteDocument(projectId, docId) {
  await cloudDeleteAllUnder(projectId + '/' + docId);
  return true;
}

// ── Dokumentum áthelyezése egy másik Projektbe ──
function guessContentType(filename) {
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.css')) return 'text/css';
  if (filename.endsWith('.html')) return 'text/html';
  if (filename.endsWith('.md')) return 'text/markdown';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(filename)) return 'image/jpeg';
  if (filename.endsWith('.gif')) return 'image/gif';
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
}
async function cloudMoveDocument(fromProjectId, docId, toProjectId) {
  const fromFolder = fromProjectId + '/' + docId;
  const toFolder = toProjectId + '/' + docId;

  if (await cloudDownloadText(toFolder + '/config.json')) return { ok: false, reason: 'exists' };

  const rootFiles = ((await cloudList(fromFolder, 200)) || []).filter(isCloudFile).map(e => e.name);
  const sectionFiles = ((await cloudList(fromFolder + '/sections', 500)) || []).filter(isCloudFile).map(e => e.name);
  const imageFiles = ((await cloudList(fromFolder + '/images', 1000)) || []).filter(isCloudFile).map(e => e.name);

  // Minden fájl szöveges (config.json, style.css, logo.txt, HTML, fejezetek).
  for (const name of rootFiles) {
    const text = await cloudDownloadText(fromFolder + '/' + name);
    if (text === null) continue;
    if (!await cloudUpload(toFolder + '/' + name, text, guessContentType(name))) return { ok: false, reason: 'upload' };
  }
  for (const name of sectionFiles) {
    const text = await cloudDownloadText(fromFolder + '/sections/' + name);
    if (text === null) continue;
    if (!await cloudUpload(toFolder + '/sections/' + name, text, 'text/markdown')) return { ok: false, reason: 'upload' };
  }

  for (const name of imageFiles) { // képek: bináris másolás
    const blob = await cloudDownloadBlob(fromFolder + '/images/' + name);
    if (!blob) continue;
    if (!await cloudUpload(toFolder + '/images/' + name, blob, blob.type || guessContentType(name))) return { ok: false, reason: 'upload' };
  }

  // Csak sikeres másolás után töröljük a forrást — korábban egy félbeszakadt
  // feltöltés után is törölt, ami adatvesztéshez vezethetett.
  await cloudDeleteAllUnder(fromFolder);
  return { ok: true };
}
