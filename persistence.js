// ── Mentés (csak felhő) ──────────────────────────────────────────────────────
//
// Minden módosítás a Supabase Storage-ba kerül, a Dokumentum mappájába:
//   sections/*.md  – fejezetek (gépelés után ~1,5 mp-cel automatikusan)
//   config.json    – cím, menü/fa, fejezetsorrend
//   style.css      – megjelenés (a Megjelenés fül Mentés gombjával)
//   logo.txt       – logó
//   images/*       – képek (beillesztéskor azonnal, lásd images.js)
//
// Sikertelen mentésnél a fejezet "mentetlen" (●) marad, és a következő
// automatikus mentés újra megpróbálja. Az oldal bezárása előtt a böngésző
// figyelmeztet, ha van még ki nem mentett módosítás.

function serializeConfig(proj) {
  const out = Object.assign({}, proj.config || {});
  delete out.fileOrder;
  if (!out.nav_groups || !out.nav_groups.length) delete out.nav_groups;
  if (proj.fileOrder && proj.fileOrder.length) out.fileOrder = proj.fileOrder;
  return JSON.stringify(out, null, 2);
}

// ── config.json ──
// Ütközésjelzéssel: ha a config.json a felhőben megváltozott, mióta betöltöttük (valaki
// más is átrendezte / átnevezte), rákérdezünk, melyik maradjon.
async function saveProjectConfig(proj, { showToast = false } = {}) {
  if (!proj) return false;
  if (proj.remoteConfig != null) {
    const remote = await cloudDownloadText(proj.cloudFolder + '/config.json');
    const mine = serializeConfig(proj);
    if (remote != null && remote !== proj.remoteConfig && remote !== mine) {
      const keepMine = await resolveConfigConflict(proj);
      if (!keepMine) return false; // a dokumentum újratöltődött a felhőből
    }
  }
  const json = serializeConfig(proj);
  const ok = await cloudSaveConfig(proj);
  if (ok) proj.remoteConfig = json;
  if (ok && showToast) toast('✓ Beállítások mentve');
  return ok;
}

// A fa (menü + sorrend) gyakran változik egymás után (húzogatás) — összevonva mentjük.
function scheduleConfigSave() {
  const proj = currentProj();
  if (!proj) return;
  state._configDirty = true;
  clearTimeout(state._configTimer);
  state._configTimer = setTimeout(async () => {
    const ok = await saveProjectConfig(proj);
    if (ok) state._configDirty = false;
  }, 800);
}

// ── style.css ──
async function saveProjectCss(proj) {
  if (!proj) return { ok: false };
  return { ok: await cloudSaveCss(proj) };
}

// ── logo.txt ──
async function saveProjectLogo(proj) {
  if (!proj) return false;
  return cloudSaveLogo(proj);
}

// ── Fejezetek ──
// Egy fejezet mentése, ütközésjelzéssel: mentés előtt megnézzük, a felhőben lévő
// változat azonos-e azzal, amit utoljára betöltöttünk/mentettünk (f.remoteRaw). Ha nem,
// valaki más is módosította közben → a felhasználó dönt (lásd conflicts.js).
async function saveChapter(proj, fn) {
  const f = proj.files[fn];
  if (!f) return true;
  if (f.conflict) return false;          // döntésre vár
  if (f._saving) return f._saving;       // már fut egy mentés erre a fejezetre
  f._saving = (async () => {
    rebuildRaw(f);
    const rawAtSave = f.raw;
    if (f.remoteRaw != null) {
      const remote = await cloudDownloadText(proj.cloudFolder + '/sections/' + fn);
      if (remote != null && remote !== f.remoteRaw && remote !== rawAtSave) {
        f.conflict = true;
        queueChapterConflict(proj, fn, remote);
        return false;
      }
    }
    const ok = await cloudUpload(proj.cloudFolder + '/sections/' + fn, rawAtSave, 'text/markdown');
    if (ok) {
      f.remoteRaw = rawAtSave;
      // Ha mentés közben tovább gépeltek, a fejezet mentetlen marad (a következő kör viszi).
      if (serializeChapter(f.meta, f.content) === rawAtSave) f.dirty = false;
    }
    return ok;
  })();
  try { return await f._saving; } finally { f._saving = null; }
}

// Minden mentetlen fejezet + a config mentése (💾 gomb / Ctrl+S / build előtt).
async function saveAllDirty({ quiet = false } = {}) {
  const proj = currentProj();
  if (!proj) return true;
  clearTimeout(state._persistTimer);
  let ok = true, conflicts = 0;
  for (const fn of proj.fileOrder) {
    const f = proj.files[fn];
    if (!f || !f.dirty) continue;
    if (f.conflict) { conflicts++; continue; }
    const r = await saveChapter(proj, fn);
    if (f.conflict) conflicts++;
    else ok = r && ok;
  }
  if (state._configDirty) {
    clearTimeout(state._configTimer);
    const cOk = await saveProjectConfig(proj);
    if (cOk) state._configDirty = false;
    ok = ok && cOk;
  }
  renderTree();
  if (conflicts) setStatus('⚠ Ütközés — döntésre vár', 'unsaved');
  else if (ok) { if (!quiet) flashStatus('Mentve a felhőbe ✓'); }
  else setStatus('⚠ Mentés sikertelen — újrapróbálom', 'unsaved');
  return ok;
}

async function saveCurrentFile() {
  if (await saveAllDirty()) toast('☁️ Minden mentve');
}

// Automatikus mentés gépelés közben.
function scheduleAutosave() {
  clearTimeout(state._persistTimer);
  state._persistTimer = setTimeout(async () => {
    const ok = await saveAllDirty({ quiet: true });
    if (ok) { if (!hasPendingConflicts()) flashStatus('Automatikusan mentve ✓', 'saved', 1500); }
    else scheduleAutosave(); // újrapróbálás
  }, 1500);
}

function hasUnsavedWork() {
  const proj = currentProj();
  if (!proj) return false;
  return state._configDirty || proj.fileOrder.some(fn => proj.files[fn] && proj.files[fn].dirty) || hasUnsavedCss();
}

window.addEventListener('beforeunload', e => {
  if (hasUnsavedWork()) { e.preventDefault(); e.returnValue = ''; }
});
