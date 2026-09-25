// ── Mentés: egyetlen helyen dől el, hová kerül egy módosítás ─────────────────
//
// Minden projekt-adat háromféle helyre mehet:
//   1. IndexedDB (böngészőn belüli másolat)       — mindig
//   2. Felhő (Supabase Storage)                   — ha proj.cloudFolder
//   3. Helyi mappa (File System Access API)       — ha van írási jog (dirHandle / fájl-handle)
//
// A korábbi verzióban ez a döntés minden funkcióban külön, kézzel volt megírva, és
// több helyről hiányzott egy-egy ág — pl. a Megjelenés fül "Egyszerű" nézetének
// "✓ Mentés" gombja CSAK az IndexedDB-be mentett, a felhőbe és a mappába nem.
// Ezért állt vissza a CSS alapértelmezettre, amikor a dokumentumot újra megnyitották
// a felhőből / a mappából. Most minden mentés az alábbi save* függvényeken megy át.

// ── config.json ──────────────────────────────────────────────────────────────
function serializeConfig(proj) {
  const c = proj.config || {};
  // Az ismeretlen (kézzel felvett) kulcsokat is megtartjuk — korábban ezek mentéskor elvesztek.
  const out = Object.assign({}, c);
  delete out.fileOrder;
  if (!out.nav_groups) delete out.nav_groups;
  // A fejezetek sorrendje: enélkül betöltéskor ábécésorrendbe rendeződnének vissza.
  if (proj.fileOrder && proj.fileOrder.length) out.fileOrder = proj.fileOrder;
  return JSON.stringify(out, null, 2);
}

// Helyi mappa: egy gyökér szintű fájl (config.json, style.css, logo.txt) írása.
// A handle-t a projekt objektumon megjegyezzük (handleKey), így legközelebb dialóg nélkül ír.
async function writeRootFile(proj, filename, handleKey, text) {
  if (proj[handleKey] && await writeFileHandle(proj[handleKey], text)) return true;
  proj[handleKey] = null;
  if (proj.dirHandle) {
    try {
      const fh = await proj.dirHandle.getFileHandle(filename, { create: true });
      if (await writeFileHandle(fh, text)) { proj[handleKey] = fh; return true; }
    } catch(e) { console.warn(filename + ' írása a mappába sikertelen:', e); }
  }
  return false;
}


// config.json mentése. interactive=true esetén (kézi mentés) írási jog híján
// felajánlja a "Mentés másként" dialógust / letöltést is.
async function saveProjectConfig(proj, { showToast = true, interactive = true } = {}) {
  if (!proj) return false;
  await persistProjectMeta(proj);
  const json = serializeConfig(proj);

  if (proj.cloudFolder) {
    const ok = await cloudSaveConfig(proj);
    if (showToast && ok) toast('✓ config.json elmentve a felhőbe');
    return ok;
  }
  if (await writeRootFile(proj, 'config.json', 'configHandle', json)) {
    if (showToast) toast('✓ config.json elmentve a mappába');
    return true;
  }
  if (!interactive) return false;

  const fh = await saveAsWithPicker(json, 'config.json', 'JSON fájl', 'application/json', '.json');
  if (fh === null) return false;
  if (fh) { proj.configHandle = fh; if (showToast) toast('💾 config.json mentve: ' + fh.name); return true; }
  downloadText(json, 'config.json', 'application/json');
  if (showToast) toast('💾 config.json letöltve');
  return true;
}

// Visszafelé kompatibilis név (a régi kód így hívta, mindig az aktív projektre).
async function saveConfigToDisk(showToast = true) {
  return saveProjectConfig(currentProj(), { showToast });
}

async function saveNavGroups() {
  renderPreview();
  await saveProjectConfig(currentProj());
}

// ── style.css ────────────────────────────────────────────────────────────────
// A projekt CSS-ének mentése mindenhová, ahová lehet. Visszatérés: { ok, where }.
async function saveProjectCss(proj) {
  if (!proj) return { ok: false, where: [] };
  const where = ['böngésző'];
  await persistProjectMeta(proj);
  let ok = true;
  if (proj.cloudFolder) {
    const cloudOk = await cloudSaveCss(proj);
    ok = ok && cloudOk;
    if (cloudOk) where.push('felhő');
  } else if (proj.dirHandle || proj.cssHandle) {
    const diskOk = await writeRootFile(proj, 'style.css', 'cssHandle', proj.css || getDefaultCSS());
    ok = ok && diskOk;
    if (diskOk) where.push('mappa');
  }
  return { ok, where };
}

// ── logo.txt ─────────────────────────────────────────────────────────────────
// Korábban a logó sem a felhőbe, sem a mappába nem került ki, csak az IndexedDB-be.
async function saveProjectLogo(proj) {
  if (!proj) return false;
  await persistProjectMeta(proj);
  if (proj.cloudFolder) return cloudSaveLogo(proj);
  if (proj.dirHandle || proj.logoHandle) return writeRootFile(proj, 'logo.txt', 'logoHandle', proj.logo || '');
  return true;
}

// ── Fejezetek ────────────────────────────────────────────────────────────────
// Egy fejezet mentése felhőbe / mappába dialógus nélkül. true, ha valahová kikerült
// (a böngészőn kívül); false, ha nincs hová (csak olvasható helyi projekt).
async function saveChapterSilently(proj, fn) {
  const f = proj.files[fn];
  if (!f) return false;
  if (proj.cloudFolder) {
    const ok = await cloudSaveSectionFile(proj, fn);
    if (ok) f.dirty = false;
    return ok;
  }
  if (!f.fileHandle && proj.sectionsDirHandle) {
    try { f.fileHandle = await proj.sectionsDirHandle.getFileHandle(fn, { create: true }); } catch(e) {}
  }
  if (f.fileHandle && await writeFileHandle(f.fileHandle, f.raw)) {
    f.dirty = false;
    return true;
  }
  return false;
}

// Kézi mentés (💾 gomb / Ctrl+S) — az aktív fejezet.
async function saveCurrentFile() {
  const proj = currentProj();
  if (!proj || !state.currentFile) return;
  await saveChapter(proj, state.currentFile);
}

async function saveChapter(proj, fn) {
  const f = proj.files[fn];
  if (!f) return;

  if (await saveChapterSilently(proj, fn)) {
    renderSidebar();
    flashStatus(proj.cloudFolder ? 'Mentve a felhőbe ✓' : 'Mentve ✓');
    toast((proj.cloudFolder ? '☁️ Mentve: ' : '💾 Mentve: ') + fn);
    await persistProject(proj);
    return;
  }
  if (proj.cloudFolder) return; // a cloudUpload már jelezte a hibát

  // Nincs írási jog: "Mentés másként" dialóg, végső esetben letöltés.
  const fh = await saveAsWithPicker(f.raw, fn, 'Markdown fájl', 'text/markdown', '.md');
  if (fh === null) return;
  if (fh) {
    f.fileHandle = fh; // megjegyzi, legközelebb nem kérdez
    toast('💾 Mentve: ' + fh.name);
  } else {
    downloadText(f.raw, fn, 'text/markdown');
    toast('💾 Letöltve: ' + fn);
  }
  f.dirty = false;
  renderSidebar();
  flashStatus(fh ? 'Mentve ✓' : 'Letöltve', 'saved', 2500);
  await persistProject(proj);
}

// ── Automatikus mentés gépelés közben ────────────────────────────────────────
// Csak az aktuális fejezetet írja ki (IndexedDB + felhő / mappa, ha van hova).
async function autosaveCurrentFile() {
  await persistCurrentFile();
  const proj = currentProj();
  if (!proj || !state.currentFile) return;
  const f = proj.files[state.currentFile];
  if (!f) return;
  if (!proj.cloudFolder && !f.fileHandle && !proj.sectionsDirHandle) return; // nincs hova írni
  if (await saveChapterSilently(proj, state.currentFile)) {
    renderSidebar();
    flashStatus(proj.cloudFolder ? 'Automatikusan mentve a felhőbe ✓' : 'Automatikusan mentve a mappába ✓', 'saved', 1500);
  }
}

function scheduleAutosave() {
  clearTimeout(state._persistTimer);
  state._persistTimer = setTimeout(autosaveCurrentFile, 2000);
}
