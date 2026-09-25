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
async function saveProjectConfig(proj, { showToast = false } = {}) {
  if (!proj) return false;
  const ok = await cloudSaveConfig(proj);
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
async function saveChapter(proj, fn) {
  const f = proj.files[fn];
  if (!f) return true;
  rebuildRaw(f);
  const rawAtSave = f.raw;
  const ok = await cloudSaveSectionFile(proj, fn);
  // Ha mentés közben tovább gépeltek, a fejezet mentetlen marad (a következő kör viszi).
  if (ok && f.raw === rawAtSave) f.dirty = false;
  return ok;
}

// Minden mentetlen fejezet + a config mentése (💾 gomb / Ctrl+S / build előtt).
async function saveAllDirty({ quiet = false } = {}) {
  const proj = currentProj();
  if (!proj) return true;
  clearTimeout(state._persistTimer);
  let ok = true;
  for (const fn of proj.fileOrder) {
    if (proj.files[fn] && proj.files[fn].dirty) ok = (await saveChapter(proj, fn)) && ok;
  }
  if (state._configDirty) {
    clearTimeout(state._configTimer);
    const cOk = await saveProjectConfig(proj);
    if (cOk) state._configDirty = false;
    ok = ok && cOk;
  }
  renderTree();
  if (ok) { if (!quiet) flashStatus('Mentve a felhőbe ✓'); }
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
    if (ok) flashStatus('Automatikusan mentve ✓', 'saved', 1500);
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
