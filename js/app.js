// ── Panel resize ──────────────────────────────────────────────────────────────
(function() {
  const handle = document.getElementById('resize-handle');
  const editorPane = document.getElementById('editor-pane');
  const previewPane = document.getElementById('preview-pane');
  const mainEl = document.getElementById('main');
  let isResizing = false, startX = 0, startW = 0;

  handle.addEventListener('mousedown', e => {
    isResizing = true;
    startX = e.clientX;
    startW = editorPane.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const mainW = mainEl.getBoundingClientRect().width;
    const newW = Math.max(200, Math.min(mainW - 200, startW + dx));
    editorPane.style.width = newW + 'px';
    editorPane.style.minWidth = newW + 'px';
    editorPane.style.maxWidth = newW + 'px';
    // A panel szélessége változott, tehát a sortörés is máshol történhet a
    // szerkesztőben — a sorszám-sávot (lásd updateLineNums()) újra kell méretezni.
    scheduleLineNumsUpdate();
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // Böngészőablak átméretezésekor (nem csak a panel-húzáskor) is újratörhetnek a
  // sorok, mert a #editor szélessége a flex-elrendezés miatt vele együtt változik.
  window.addEventListener('resize', scheduleLineNumsUpdate);
})();

// ── Projekt-választó a topbaron ──────────────────────────────────────────────
// (Korábban csak a sidebart frissítette — a morzsamenü és a szülő Projekt nem váltott.)
document.getElementById('project-select').addEventListener('change', e => {
  const name = e.target.value;
  if (name && state.projects[name]) activateProject(name);
});

// ── Indítás ───────────────────────────────────────────────────────────────────
// Sorrend: IndexedDB beolvasása → bejelentkezés ellenőrzése → navigáció.
//  • megosztott #view/… link → a publikált kézikönyv
//  • utoljára használt FELHŐ Dokumentum → frissen a felhőből töltjük újra (nem az
//    esetleg elavult böngészős másolatból — egy kolléga közben módosíthatta, és a
//    régi verzió a böngészős CSS-sel felülírhatta volna a felhőbelit)
//  • utoljára használt helyi projekt → a böngészős másolatból
//  • egyébként a Kezdőlap
async function initApp() {
  updateLineNums();
  const last = await loadPersistedProjects();
  const session = await cloudCheckSession();
  state.booting = false;

  const shared = session ? parseSharedViewHash() : null;
  if (shared) { openSharedView(shared.projectId, shared.docId); return; }

  if (last && last.cloudFolder) {
    const resume = { cloudFolder: last.cloudFolder, topProjectId: last.topProjectId, docId: last.docId };
    if (session) await cloudLoadProject(resume.cloudFolder, resume.topProjectId, resume.docId);
    else state.pendingCloudResume = resume; // bejelentkezés után nyílik meg (lásd onLoggedIn)
    return;
  }
  if (last && state.projects[last.name]) {
    await activateProject(last.name);
    const lastFile = last.currentFile;
    if (lastFile && state.projects[last.name].files[lastFile]) openFile(lastFile);
    flashStatus('Visszatöltve: ' + projectDisplayTitle(state.projects[last.name]), '', 2500);
    return;
  }
  showHomeView();
}

initApp();
