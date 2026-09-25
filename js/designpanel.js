// ── Megjelenés oldalpanel ────────────────────────────────────────────────────
// A Megjelenés beállításai nem egy ablakban, hanem egy oldalpanelben nyílnak meg:
// a panel a fa és a szerkesztő helyére kerül, az előnézet pedig a teljes kézikönyvet
// mutatja mellette, így minden módosítás hatása azonnal, a teljes oldalon látszik.
// Bezáráskor a korábbi elrendezés és előnézeti mód áll vissza.

let _designPrevMode = null;

function isDesignPanelOpen() {
  return document.getElementById('design-panel').style.display !== 'none';
}

function toggleDesignPanel() {
  if (isDesignPanelOpen()) closeDesignPanel();
  else openDesignPanel();
}

function openDesignPanel() {
  if (!currentProj()) { toast('Előbb nyiss meg egy dokumentumot!', 'err'); return; }
  if (isDesignPanelOpen()) return;
  document.getElementById('main').classList.add('design-mode');
  document.getElementById('design-panel').style.display = 'flex';
  document.getElementById('btn-design').classList.add('active');
  loadCssEditor();
  if (!state.previewPoppedOut) document.getElementById('preview-pane').style.display = 'flex';
  // A teljes kézikönyv látszódjon (menüvel, borítóval), ne csak az aktuális fejezet.
  _designPrevMode = state.previewMode;
  if (state.previewMode !== 'full') setPreviewMode('full');
  else renderPreview();
}

// Bezárás: nem mentett módosításnál rákérdez (mentés vagy elvetés).
async function closeDesignPanel() {
  if (!isDesignPanelOpen()) return;
  await resolveUnsavedCssOnClose();
  document.getElementById('main').classList.remove('design-mode');
  document.getElementById('design-panel').style.display = 'none';
  document.getElementById('btn-design').classList.remove('active');
  if (_designPrevMode && _designPrevMode !== state.previewMode) setPreviewMode(_designPrevMode);
  _designPrevMode = null;
  if (!state.currentFile) showEmptyDocState(); // üres dokumentumnál vissza az üres nézetre
  else if (editorView) { editorView.requestMeasure(); editorView.focus(); }
}
