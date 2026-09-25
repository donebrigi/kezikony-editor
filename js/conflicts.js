// ── Ütközésjelzés (ha ketten egyszerre szerkesztik ugyanazt) ─────────────────
//
// Mentés előtt a szerkesztő összeveti a felhőben lévő fejezetet azzal a változattal,
// amit utoljára ő töltött be / mentett. Ha közben valaki más is mentett, nem írja
// felül vakon, hanem megkérdezi, melyik maradjon:
//   • Az enyém   — a te változatod felülírja a másikat
//   • Az övé     — a másik változat töltődik be, a tiéd elvész
//   • Mindkettő  — az övé marad ebben a fejezetben, a tiéd egy új fejezetbe kerül mellé
//
// Fejezetváltáskor (ha nincs mentetlen módosításod) a szerkesztő csendben frissíti a
// fejezetet a felhőben lévő legújabb változatra.

const _conflictQueue = [];
let _conflictActive = null;

function hasPendingConflicts() { return !!_conflictActive || _conflictQueue.length > 0; }

function queueChapterConflict(proj, fn, remoteRaw) {
  if (_conflictActive && _conflictActive.fn === fn) {
    // Már erről a fejezetről kérdezünk — friss tartalommal (újra) megmutatjuk.
    _conflictActive.remoteRaw = remoteRaw;
    renderConflictDialog();
    return;
  }
  const existing = _conflictQueue.find(c => c.fn === fn);
  if (existing) existing.remoteRaw = remoteRaw;
  else _conflictQueue.push({ proj, fn, remoteRaw });
  if (!_conflictActive) showNextConflict();
}

function showNextConflict() {
  _conflictActive = _conflictQueue.shift() || null;
  renderConflictDialog();
}

function renderConflictDialog() {
  const backdrop = document.getElementById('conflict-modal-backdrop');
  if (!_conflictActive) { backdrop.classList.remove('open'); return; }
  const { proj, fn, remoteRaw } = _conflictActive;
  const f = proj.files[fn];
  const theirs = makeFileEntry(remoteRaw);
  document.getElementById('conflict-title').textContent = chapterTitle(proj, fn);
  document.getElementById('conflict-theirs').value = theirs.content;
  document.getElementById('conflict-mine').value = f.content;
  backdrop.classList.add('open');
}

// Egy fejezet tartalmának lecserélése a szerkesztőben is (pl. "az övé" választásnál).
function applyRemoteChapter(proj, fn, remoteRaw) {
  const f = proj.files[fn];
  const fresh = makeFileEntry(remoteRaw);
  f.meta = fresh.meta;
  f.content = fresh.content;
  f.raw = remoteRaw;
  f.remoteRaw = remoteRaw;
  f.dirty = false;
  _editorStates.delete(fn);
  if (fn === state.currentFile && editorView) {
    editorView.setState(stateForChapter(fn));
    updateChapterHeader();
  }
  invalidateAnchors();
}

async function resolveConflict(choice) {
  const c = _conflictActive;
  if (!c) return;
  // HIBAJAVÍTÁS: a döntés alatt már nincs "aktív" ütközés — ha közben újabb érkezik
  // (pl. a kolléga tovább gépel), az rendesen, új ablakként jelenik meg.
  _conflictActive = null;
  const { proj, fn, remoteRaw } = c;
  const f = proj.files[fn];
  document.getElementById('conflict-modal-backdrop').classList.remove('open');

  if (choice === 'mine') {
    f.remoteRaw = remoteRaw;
    f.conflict = false;
    // Kifejezetten felülírást kértél: nincs újabb ellenőrzés (különben a kolléga
    // közbeni automatikus mentése miatt a kérdés végtelenül ismétlődhetne).
    const ok = await saveChapter(proj, fn, { force: true });
    toast(ok ? '✓ A te változatod mentve' : '⚠ A mentés nem sikerült — próbáld újra a 💾 Mentés gombbal', ok ? 'ok' : 'err', ok ? 2500 : 5000);
  } else if (choice === 'theirs') {
    f.conflict = false;
    applyRemoteChapter(proj, fn, remoteRaw);
    toast('✓ A másik változat betöltve');
  } else if (choice === 'both') {
    // A te szöveged egy új fejezetbe kerül közvetlenül utána.
    const mine = { meta: Object.assign({}, f.meta), content: f.content };
    f.conflict = false;
    applyRemoteChapter(proj, fn, remoteRaw);
    let newId = (mine.meta.id || 'fejezet') + '-sajat';
    let n = 2;
    while (proj.fileOrder.some(x => chapterId(proj, x) === newId)) newId = (mine.meta.id || 'fejezet') + '-sajat-' + (n++);
    const newFn = fn.replace(/\.md$/, '') + '-sajat-' + Date.now().toString(36) + '.md';
    proj.files[newFn] = { meta: Object.assign(mine.meta, { id: newId, title: (mine.meta.title || '') + ' (saját változat)' }), content: mine.content, raw: '', dirty: true };
    insertChapterAfter(proj, newFn, fn);
    await saveChapter(proj, newFn);
    await saveProjectConfig(proj);
    toast('✓ Mindkét változat megmaradt — a tiéd a „(saját változat)” fejezetben van', 'ok', 4500);
  }
  renderTree();
  schedulePreview();
  if (!_conflictActive) showNextConflict();
  if (!hasPendingConflicts()) { setStatus(''); scheduleAutosave(); }
}

// Ha egy fejezet ütközésre vár, de az ablak valamiért nem látszik: újra megnyitjuk.
// (A 💾 Mentés gomb és a "⚠ Ütközés" állapotfelirat is ezt hívja.)
async function reopenPendingConflicts() {
  const proj = currentProj();
  if (!proj) return false;
  const pending = proj.fileOrder.filter(fn => proj.files[fn] && proj.files[fn].conflict);
  if (!pending.length) return false;
  if (_conflictActive) { renderConflictDialog(); return true; }
  for (const fn of pending) {
    if (_conflictQueue.some(c => c.fn === fn)) continue;
    const remote = await cloudDownloadText(proj.cloudFolder + '/sections/' + fn);
    if (remote == null) { proj.files[fn].conflict = false; continue; } // közben törölték → a mienk mehet
    _conflictQueue.push({ proj, fn, remoteRaw: remote });
  }
  if (!_conflictActive) showNextConflict();
  return true;
}

// config.json ütközés (szerkezet / cím): egyszerű kérdés.
async function resolveConfigConflict(proj) {
  const keepMine = confirm('Valaki más is módosította ennek a dokumentumnak a szerkezetét vagy beállításait (sorrend, csoportok, cím), mióta megnyitottad.\n\nOK = a te változatod mentése (felülírja az övét)\nMégse = az ő változatának betöltése (a te szerkezeti módosításod elvész, a fejezetek szövege megmarad)');
  if (keepMine) return true;
  state._configDirty = false;
  clearTimeout(state._configTimer);
  // Előbb a mentetlen fejezetszövegek mennek fel, aztán újratöltés a felhőből.
  for (const fn of proj.fileOrder) if (proj.files[fn] && proj.files[fn].dirty) await saveChapter(proj, fn);
  const cur = state.currentFile;
  await cloudLoadProject(proj.cloudFolder, proj.topProjectId, proj.docId);
  if (cur && currentProj() && currentProj().files[cur]) openFile(cur);
  return false;
}

// Fejezet megnyitásakor: ha nincs nálunk mentetlen módosítás, de a felhőben újabb van,
// csendben frissítünk.
async function refreshChapterFromCloud(proj, fn) {
  const f = proj.files[fn];
  if (!f || f.dirty || f.conflict || f.remoteRaw == null) return;
  const remote = await cloudDownloadText(proj.cloudFolder + '/sections/' + fn);
  if (remote == null || remote === f.remoteRaw || isOwnVersion(f, remote)) return; // saját (esetleg késleltetett) változat
  if (f.dirty || currentProj() !== proj) return; // közben elkezdtek gépelni / elnavigáltak
  applyRemoteChapter(proj, fn, remote);
  renderTree();
  schedulePreview();
  toast('↻ „' + chapterTitle(proj, fn) + '” frissítve — közben valaki más módosította', 'ok', 3500);
}
