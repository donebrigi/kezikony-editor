// ── Globális állapot + dokumentum-modell segédfüggvények ─────────────────────
//
// Minden adat a felhőben (Supabase Storage) él. Egy megnyitott Dokumentum
// (state.projects[name]) szerkezete:
// {
//   name,                 // "projektId/dokumentumId" — egyben a felhőbeli mappa (cloudFolder)
//   cloudFolder, topProjectId, docId,
//   config: {},           // config.json (title, subtitle, description, nav_groups, fileOrder, ...)
//   css: '',              // style.css (alap + @kezikonyv-design blokk)
//   logo: '',             // logo.txt (base64 kép)
//   files: { [fn]: { meta, content, raw, dirty } },   // sections/*.md
//   fileOrder: [fn, ...]  // a dokumentum sorrendje = a bal oldali fa sorrendje
// }
const state = {
  projects: {},
  currentProject: null,
  currentFile: null,
  previewMode: 'section',
  previewTimer: null,
  previewRenderKey: null, // az utolsó előnézet-render "kulcsa" (fájl+mód) — ha nem változik, megmarad a görgetési pozíció
  // Kezdőlap / Projekt-Dokumentum hierarchia
  uiView: 'home',              // 'home' | 'project' | 'editor'
  currentTopProject: null,     // Projekt azonosító (mappa neve)
  currentTopProjectMeta: null, // { id, name, description, color, icon, docCount }
  homeProjects: null,          // kezdőlap kártyák cache-e
  projectDocs: null,           // az aktuális Projekt dokumentumainak cache-e
  editingProjectId: null,      // ha nem null, az "Új/szerkesztés Projekt" modal szerkeszt, nem létrehoz
  moveDocSource: null,         // { projectId, docId, title } — a "Dokumentum áthelyezése" modal forrása
  isAuthed: false,
  booting: true,               // amíg igaz, az auth-változás nem navigál (az initApp dönt)
  pendingCloudResume: null,    // bejelentkezés után visszanyitandó Dokumentum
  cssDraft: null,              // a Megjelenés fül nem mentett piszkozata
  collapsedGroups: {},         // a fában összecsukott csoportok (kulcs: csoport neve)
};

function currentProj() {
  return state.currentProject ? (state.projects[state.currentProject] || null) : null;
}
function currentFileEntry() {
  const p = currentProj();
  return p && state.currentFile ? (p.files[state.currentFile] || null) : null;
}

// Fejezet-bejegyzés nyers markdownból (frontmatter + törzs).
function makeFileEntry(raw, extra = {}) {
  const parsed = parseFrontmatter(raw || '');
  // A törzs végére egy üres sort teszünk, hogy a kurzor a cím alatt, új sorban kezdhessen.
  let content = parsed.content || '';
  if (content && !content.endsWith('\n')) content += '\n\n';
  return { meta: parsed.meta || {}, content, raw: raw || '', dirty: !!extra.dirty };
}

// A fejezet szövegének frissítése a meta/törzs alapján (a szerkesztő csak a törzset mutatja).
function rebuildRaw(f) { f.raw = serializeChapter(f.meta, f.content); }

function chapterId(proj, fn) {
  const f = proj.files[fn];
  return (f && f.meta.id) || fn;
}
function chapterTitle(proj, fn) {
  const f = proj.files[fn];
  return (f && f.meta.title) || fn.replace(/^\d+_?/, '').replace(/\.md$/, '');
}

function projectDisplayTitle(proj) {
  return (proj.config && proj.config.title) || proj.docId || proj.name;
}

// Az utoljára megnyitott Dokumentum megjegyzése (induláskor ezt nyitjuk újra).
const LAST_DOC_KEY = 'kk:lastDoc';
function rememberLastDoc(proj) {
  try { localStorage.setItem(LAST_DOC_KEY, JSON.stringify({ cloudFolder: proj.cloudFolder, topProjectId: proj.topProjectId, docId: proj.docId })); } catch(e) {}
}
function readLastDoc() {
  try { return JSON.parse(localStorage.getItem(LAST_DOC_KEY) || 'null'); } catch(e) { return null; }
}
function forgetLastDoc(folder) {
  const last = readLastDoc();
  if (last && (!folder || last.cloudFolder === folder)) { try { localStorage.removeItem(LAST_DOC_KEY); } catch(e) {} }
}

function unregisterProject(name) {
  delete state.projects[name];
  if (state.currentProject === name) { state.currentProject = null; state.currentFile = null; }
  forgetLastDoc(name);
}
