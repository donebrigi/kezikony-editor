// ── Projektek betöltése (felhő / helyi mappa írási joggal / csak olvasható mappa) ──
//
// Mindhárom betöltő ugyanazt a projekt-objektumot állítja elő (lásd state.js), majd
// a közös openLoadedProject() nyitja meg a szerkesztőben. Korábban a sorrend-feloldás,
// a választó-frissítés és a megnyitás mindhárom helyen külön, másolva szerepelt.

function newProjectObject(name, extra = {}) {
  return Object.assign({ name, config: {}, css: '', logo: '', files: {}, fileOrder: [] }, extra);
}

// Közös befejező lépés: sorrend, alapértelmezett CSS, regisztráció, megnyitás.
function openLoadedProject(project, { statusMsg, toastMsg, emptyMsg } = {}) {
  project.fileOrder = resolveFileOrder(project);
  if (!project.css) project.css = getDefaultCSS();

  discardCssDraft();
  registerProject(project);
  state.currentProject = project.name;
  state.currentFile = null;
  document.getElementById('project-select').value = project.name;

  renderSidebar();
  showEditorPane();
  if (project.fileOrder.length > 0) openFile(project.fileOrder[0]);
  else if (emptyMsg) toast(emptyMsg, '', 4000);

  if (statusMsg) flashStatus(statusMsg, 'saved', 2500);
  if (toastMsg) toast(toastMsg);
  checkFolderAccessBtn();
  persistProject(project);
  enterEditorView();
}

// ── Egy Dokumentum (felhő "projekt mappa") betöltése a szerkesztőbe ──
async function cloudLoadProject(folderId, topProjectId, docId) {
  toast('☁️ Dokumentum betöltése...', 'ok', 2000);

  // FONTOS: name = folderId (a teljes "projektId/dokumentumId" útvonal), mert ez az
  // IndexedDB kulcsa — csak a docId-vel két Projekt azonos nevű dokumentumai ütköznének.
  const project = newProjectObject(folderId, {
    cloudFolder: folderId,
    topProjectId: topProjectId || null,
    docId: docId || folderId
  });

  const data = await cloudFetchDocument(folderId);
  project.config = data.config;
  project.css = data.css;
  project.logo = data.logo;
  for (const [fn, raw] of Object.entries(data.files)) project.files[fn] = makeFileEntry(raw);

  if (topProjectId) {
    state.currentTopProject = topProjectId;
    if (!state.currentTopProjectMeta || state.currentTopProjectMeta.id !== topProjectId) {
      state.currentTopProjectMeta = (state.homeProjects || []).find(p => p.id === topProjectId) || await cloudGetProjectMeta(topProjectId);
    }
  }

  openLoadedProject(project, {
    statusMsg: 'Felhő dokumentum betöltve: ' + projectDisplayTitle(project),
    toastMsg: '✓ Dokumentum betöltve — a mentés innentől mindenki számára közösen kerül el',
    emptyMsg: 'Üres dokumentum — hozz létre egy fejezetet a + gombbal.'
  });
}

// ── Fájl input alapú betöltés (csak olvasás; file:// protokollon is működik) ──
async function loadFromInput(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const rootName = files[0].webkitRelativePath.split('/')[0];
  const project = newProjectObject(rootName);

  for (const file of files) {
    const parts = file.webkitRelativePath.split('/');
    const fname = parts[parts.length - 1];
    const isRoot = parts.length === 2; // "gyökér/fájl"

    if (isRoot && fname === 'config.json') {
      try { project.config = JSON.parse(await file.text()); } catch(e) {}
    } else if (isRoot && fname === 'style.css') {
      project.css = await file.text();
    } else if (isRoot && fname === 'logo.txt') {
      project.logo = (await file.text()).trim();
    } else if (isChapterFile(fname) && parts[parts.length - 2] === 'sections') {
      project.files[fname] = makeFileEntry(await file.text());
    }
  }
  input.value = '';

  if (Object.keys(project.files).length === 0) {
    toast('Nem találtam md fájlokat a sections/ mappában!', 'err', 4000);
    return;
  }

  openLoadedProject(project, {
    statusMsg: 'Betöltve (csak olvasható): ' + rootName,
    toastMsg: '✓ Betöltve: ' + Object.keys(project.files).length + ' fejezet'
  });
}

// Egy megnyitott mappa-handle-ből a projekt írási handle-jeinek beállítása.
// (A loadProjectFromDirectory és a requestFolderAccess is ezt használja.)
async function attachDirectoryHandles(project, dirHandle) {
  project.dirHandle = dirHandle;
  // A gyökér fájlok handle-jeit (config.json, style.css, logo.txt, kimeneti HTML)
  // a mentések a writeRootFile()-ban igény szerint hozzák létre.
  project.configHandle = null;
  project.cssHandle = null;
  project.logoHandle = null;
  project.outputHandle = null;
  try {
    project.sectionsDirHandle = await dirHandle.getDirectoryHandle('sections', { create: true });
    for (const fn of Object.keys(project.files)) {
      try { project.files[fn].fileHandle = await project.sectionsDirHandle.getFileHandle(fn, { create: false }); } catch(e) {}
    }
  } catch(e) { console.warn('sections/ mappa hiba:', e); }
}

// ── Projekt mappa betöltése ÍRÁSI joggal, egy lépésben ────────────────────────
// A showDirectoryPicker API-val egy lépésben tölti be a projektet ÉS szerzi meg az
// írási jogot — ezután minden mentés (fejezet, config.json, style.css, logó, build)
// közvetlenül ebbe a mappába ír.
async function loadProjectFromDirectory() {
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch(e) {
    if (e.name !== 'AbortError') toast('Hiba: ' + e.message, 'err');
    return;
  }

  const rootName = dirHandle.name;
  const project = newProjectObject(rootName);

  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file') continue;
    try {
      if (name === 'config.json') {
        try { project.config = JSON.parse(await (await handle.getFile()).text()); } catch(e) {}
      } else if (name === 'style.css') {
        project.css = await (await handle.getFile()).text();
      } else if (name === 'logo.txt') {
        project.logo = (await (await handle.getFile()).text()).trim();
      }
    } catch(e) { console.warn('Gyökér fájl olvasási hiba (' + name + '):', e); }
  }

  try {
    const sectionsDir = await dirHandle.getDirectoryHandle('sections', { create: true });
    for await (const [name, handle] of sectionsDir.entries()) {
      if (handle.kind !== 'file' || !isChapterFile(name)) continue;
      const text = await (await handle.getFile()).text();
      project.files[name] = makeFileEntry(text, { fileHandle: handle });
    }
  } catch(e) { console.warn('sections/ mappa hiba:', e); }

  await attachDirectoryHandles(project, dirHandle);

  // Ha a mappában még nincs style.css, a (most alapértelmezett) CSS-t kiírjuk, hogy
  // a projekt a mappából újranyitva is ugyanazt a megjelenést kapja.
  const hadCss = !!project.css;
  openLoadedProject(project, {
    statusMsg: 'Betöltve (közvetlen mentéssel): ' + rootName,
    toastMsg: '✓ Betöltve, mentés innentől automatikusan ide kerül: ' + rootName,
    emptyMsg: 'Üres mappa — hozz létre egy fejezetet a + gombbal.'
  });
  if (!hadCss) saveProjectCss(project);
}

// A 📂 gomb ezt hívja: ha a böngésző támogatja, közvetlen írási joggal tölt be,
// ha nem, visszaesik a csak-olvasható mappa-betöltésre.
function openProjectFolder() {
  if (window.showDirectoryPicker) loadProjectFromDirectory();
  else document.getElementById('folder-input').click();
}

// ── Utólagos mappa hozzáférés egy már betöltött (pl. csak olvasható) projekthez ──
async function requestFolderAccess() {
  const proj = currentProj();
  if (!proj) { toast('Előbb tölts be egy projektet!', 'err'); return; }
  if (!window.showDirectoryPicker) { toast('A böngésző nem támogatja ezt a funkciót.', 'err'); return; }
  try {
    await attachDirectoryHandles(proj, await window.showDirectoryPicker({ mode: 'readwrite' }));
    checkFolderAccessBtn();
    flashStatus('Írási jog megadva ✓', 'saved', 2500);
    toast('✓ Írási jog megadva — Ctrl+S közvetlenül ment');
  } catch(e) {
    if (e.name !== 'AbortError') toast('Hiba: ' + e.message, 'err');
  }
}

function checkFolderAccessBtn() {
  const btn = document.getElementById('folder-access-btn');
  if (!btn) return;
  const proj = currentProj();
  btn.style.display = (proj && !proj.cloudFolder && !proj.dirHandle && window.showDirectoryPicker) ? '' : 'none';
}
