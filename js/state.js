// ── Globális állapot + projekt-modell segédfüggvények ────────────────────────
//
// Egy betöltött projekt (state.projects[name]) szerkezete:
// {
//   name,                 // kulcs: helyi mappa neve, vagy felhőben "projektId/dokumentumId"
//   config: {},           // config.json tartalma (title, subtitle, nav_groups, fileOrder, ...)
//   css: '',              // a projekt teljes CSS-e (alap + @kezikonyv-design blokk)
//   logo: '',             // base64 kép vagy elérési út
//   files: { [fn]: { meta, content, raw, dirty, fileHandle } },
//   fileOrder: [fn, ...],
//   // opcionális, a forrástól függően:
//   cloudFolder, topProjectId, docId            // felhő Dokumentum
//   dirHandle, sectionsDirHandle, configHandle,  // helyi mappa írási joggal
//   outputHandle, cssHandle
// }
const state = {
  projects: {},
  currentProject: null,
  currentFile: null,
  previewMode: 'section',
  previewTimer: null,
  previewRenderKey: null, // az utolsó előnézet-render "kulcsa" (fájl+mód) — ha nem változik, gépeléskor megmarad a görgetési pozíció
  // Kezdőlap / Projekt-Dokumentum hierarchia (felhő mód)
  uiView: 'home',              // 'home' | 'project' | 'editor'
  currentTopProject: null,     // felhő Projekt azonosító (mappa neve)
  currentTopProjectMeta: null, // { id, name, description, color, icon, docCount }
  homeProjects: null,          // kezdőlap kártyák cache-e
  projectDocs: null,           // az aktuális Projekt dokumentumainak cache-e
  editingProjectId: null,      // ha nem null, az "Új/szerkesztés Projekt" modal szerkeszt, nem létrehoz
  moveDocSource: null,         // { projectId, docId, title } — a "Dokumentum áthelyezése" modal forrása
  isAuthed: false,             // van-e érvényes bejelentkezés (a megosztott linkek kapuőrzéséhez)
  booting: true,               // amíg igaz, az auth-változás nem navigál (az initApp dönt)
  pendingCloudResume: null,    // bejelentkezés után visszanyitandó felhő Dokumentum
  cssDirty: false,             // van-e a Megjelenés fülön nem mentett változás
};

// Az aktív projekt objektuma (vagy null).
function currentProj() {
  return state.currentProject ? (state.projects[state.currentProject] || null) : null;
}

// Egy fejezet-bejegyzés létrehozása nyers markdownból.
function makeFileEntry(raw, extra = {}) {
  const parsed = (extra.meta && extra.content !== undefined)
    ? { meta: extra.meta, content: extra.content }
    : parseFrontmatter(raw || '');
  return {
    meta: parsed.meta || {},
    content: parsed.content || '',
    raw: raw || '',
    dirty: !!extra.dirty,
    fileHandle: extra.fileHandle || null
  };
}

// Fejezetsorrend: a config.json-ban mentett sorrend, a benne nem szereplő (új) fájlok
// ábécérendben a végére. Korábban három betöltőben is szó szerint ismétlődött.
function resolveFileOrder(project) {
  const names = Object.keys(project.files);
  const saved = Array.isArray(project.config.fileOrder) ? project.config.fileOrder : null;
  if (!saved) return names.sort();
  const known = new Set(names);
  const ordered = saved.filter(fn => known.has(fn));
  const missing = names.filter(fn => !ordered.includes(fn)).sort();
  return ordered.concat(missing);
}

function projectDisplayTitle(proj) {
  return (proj.config && proj.config.title) || proj.docId || proj.name;
}

// Projekt felvétele a state-be és a topbar projekt-választójába (vagy a felirat frissítése).
function registerProject(project) {
  state.projects[project.name] = project;
  const sel = document.getElementById('project-select');
  let opt = [...sel.options].find(o => o.value === project.name);
  if (!opt) {
    opt = document.createElement('option');
    opt.value = project.name;
    sel.appendChild(opt);
  }
  opt.textContent = (project.cloudFolder ? '☁️ ' : '') + projectDisplayTitle(project);
}

// Projekt eltávolítása a memóriából és a választóból (IndexedDB-t nem érinti).
function unregisterProject(name) {
  delete state.projects[name];
  const sel = document.getElementById('project-select');
  const opt = [...sel.options].find(o => o.value === name);
  if (opt) opt.remove();
  if (state.currentProject === name) { state.currentProject = null; state.currentFile = null; }
}
