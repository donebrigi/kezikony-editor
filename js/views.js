// ── Nézetváltás: Kezdőlap / Projekt / Szerkesztő ──
function updateTopbarToolsVisibility() {
  const isEditor = state.uiView === 'editor';
  const left = document.getElementById('topbar-editor-tools-left');
  const right = document.getElementById('topbar-editor-tools-right');
  if (left) left.style.display = isEditor ? 'contents' : 'none';
  if (right) right.style.display = isEditor ? 'contents' : 'none';
}

function updateBreadcrumb() {
  const bar = document.getElementById('breadcrumb-bar');
  const row = document.getElementById('breadcrumb-row');
  if (!bar) return;
  if (state.uiView === 'project') {
    if (row) row.classList.add('visible');
    const name = state.currentTopProjectMeta ? state.currentTopProjectMeta.name : state.currentTopProject;
    bar.innerHTML = `<span class="crumb" onclick="showHomeView()">Kezdőlap</span><span class="crumb-sep">/</span><span class="crumb-current">${escapeHtml(name)}</span>`;
  } else if (state.uiView === 'editor') {
    if (row) row.classList.add('visible');
    const proj = state.projects[state.currentProject];
    const docTitle = (proj && (proj.config?.title || proj.docId || proj.name)) || state.currentProject || '';
    if (proj && proj.topProjectId) {
      const projName = (state.currentTopProjectMeta && state.currentTopProjectMeta.id === proj.topProjectId) ? state.currentTopProjectMeta.name : proj.topProjectId;
      bar.innerHTML = `<span class="crumb" onclick="showHomeView()">Kezdőlap</span><span class="crumb-sep">/</span><span class="crumb" onclick="showProjectView('${proj.topProjectId}')">${escapeHtml(projName)}</span><span class="crumb-sep">/</span><span class="crumb-current">${escapeHtml(docTitle)}</span>`;
    } else {
      bar.innerHTML = `<span class="crumb-current">${escapeHtml(docTitle)} <span style="color:var(--text3)">(helyi)</span></span>`;
    }
  } else {
    if (row) row.classList.remove('visible');
    bar.innerHTML = '';
  }
}

function enterEditorView() {
  state.uiView = 'editor';
  const home = document.getElementById('view-home'), proj = document.getElementById('view-project'), main = document.getElementById('main');
  if (home) home.classList.remove('active');
  if (proj) proj.classList.remove('active');
  if (main) main.style.display = 'flex';
  updateTopbarToolsVisibility();
  updateBreadcrumb();
}

async function showHomeView() {
  if (typeof isDesignPanelOpen === 'function' && isDesignPanelOpen()) await closeDesignPanel();
  if (state.uiView === 'editor' && hasUnsavedWork()) saveAllDirty({ quiet: true }); // kilépés előtt minden felmegy
  state.uiView = 'home';
  state.currentTopProject = null;
  state.currentTopProjectMeta = null;
  const home = document.getElementById('view-home'), proj = document.getElementById('view-project'), main = document.getElementById('main');
  if (main) main.style.display = 'none';
  if (proj) proj.classList.remove('active');
  if (home) home.classList.add('active');
  updateTopbarToolsVisibility();
  updateBreadcrumb();
  const grid = document.getElementById('home-grid');
  if (grid) grid.innerHTML = '<div class="hp-empty">Betöltés...</div>';
  state.homeProjects = await cloudListTopProjects();
  renderHomeGrid();
}

function renderHomeGrid() {
  const grid = document.getElementById('home-grid');
  if (!grid) return;
  const searchInput = document.getElementById('home-search');
  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const list = (state.homeProjects || []).filter(p => !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  grid.innerHTML = '';
  if (!list.length) {
    const msg = q ? ('Nincs találat "' + escapeHtml(q) + '" keresésre.') : 'Még nincs projekt — hozz létre egyet lent.';
    grid.innerHTML = `<div class="hp-empty" style="grid-column:1/-1">${msg}</div>`;
  } else {
    list.forEach(p => {
      const openProj = () => showProjectView(p.id);
      const card = document.createElement('div');
      card.className = 'hp-card';
      card.onclick = openProj;
      card.innerHTML = `
        <div class="accent-bar" style="background:${p.color}"></div>
        <div class="hp-card-icon" style="background:${p.color}22;color:${p.color}">${escapeHtml(p.icon)}</div>
        <div class="hp-card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="hp-card-desc">${escapeHtml(p.description || '')}</div>
        <div class="hp-card-meta"><span class="hp-badge">${p.docCount || 0} dokumentum</span></div>
        <div class="hp-actions-row">
          <button class="btn-sm hp-proj-edit-btn" title="Projekt szerkesztése">✏ Szerkesztés</button>
          <button class="btn-sm del hp-proj-del-btn" title="Projekt törlése">🗑 Törlés</button>
          <button class="btn primary hp-proj-open-btn">Megnyitás</button>
        </div>
      `;
      card.querySelector('.hp-proj-edit-btn').onclick = (e) => { e.stopPropagation(); openEditTopProjectModal(p); };
      card.querySelector('.hp-proj-del-btn').onclick = (e) => { e.stopPropagation(); deleteTopProjectFromHome(p.id, p.name); };
      card.querySelector('.hp-proj-open-btn').onclick = (e) => { e.stopPropagation(); openProj(); };
      grid.appendChild(card);
    });
  }
  const newCard = document.createElement('div');
  newCard.className = 'hp-card hp-new-card';
  newCard.onclick = openNewTopProjectModal;
  newCard.innerHTML = '<div class="plus">+</div><div>Új projekt</div>';
  grid.appendChild(newCard);
}

async function showProjectView(projectId) {
  if (typeof isDesignPanelOpen === 'function' && isDesignPanelOpen()) await closeDesignPanel();
  if (state.uiView === 'editor' && hasUnsavedWork()) saveAllDirty({ quiet: true }); // kilépés előtt minden felmegy
  state.uiView = 'project';
  state.currentTopProject = projectId;
  const home = document.getElementById('view-home'), proj = document.getElementById('view-project'), main = document.getElementById('main');
  if (main) main.style.display = 'none';
  if (home) home.classList.remove('active');
  if (proj) proj.classList.add('active');
  updateTopbarToolsVisibility();

  document.getElementById('project-page-title').textContent = 'Betöltés...';
  document.getElementById('project-page-desc').textContent = '';
  document.getElementById('project-doc-grid').innerHTML = '<div class="hp-empty" style="grid-column:1/-1">Betöltés...</div>';

  let meta = (state.homeProjects || []).find(p => p.id === projectId) || await cloudGetProjectMeta(projectId);
  if (!meta) meta = { id: projectId, name: projectId, description: '', color: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] };
  state.currentTopProjectMeta = meta;

  document.getElementById('project-page-title').textContent = meta.name;
  document.getElementById('project-page-desc').textContent = meta.description || '';
  updateBreadcrumb();

  state.projectDocs = await cloudListDocuments(projectId);
  renderProjectDocGrid();
}

function renderProjectDocGrid() {
  const grid = document.getElementById('project-doc-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const docs = state.projectDocs || [];
  if (!docs.length) {
    grid.innerHTML = '<div class="hp-empty" style="grid-column:1/-1">Ebben a projektben még nincs dokumentum — hozz létre egyet lent.</div>';
  } else {
    const projectId = state.currentTopProject;
    docs.forEach(d => {
      const openDoc = () => cloudLoadProject(projectId + '/' + d.id, projectId, d.id);
      const card = document.createElement('div');
      card.className = 'hp-card hp-doc-card';
      card.onclick = openDoc;
      const metaBits = [d.chapterCount + ' fejezet'];
      if (d.updatedAt) metaBits.push('frissítve ' + formatRelativeDate(d.updatedAt));
      card.innerHTML = `
        <div class="hp-doc-top">
          <div class="hp-card-icon">📘</div>
          <div class="hp-doc-body">
            <div class="hp-doc-title" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</div>
            <div class="hp-doc-meta">${escapeHtml(metaBits.join(' · '))}</div>
          </div>
        </div>
        <div class="hp-actions-row">
          <button class="btn-sm hp-doc-edit-btn" title="Dokumentum átnevezése">✏ Szerkesztés</button>
          <button class="btn-sm hp-doc-move-btn" title="Áthelyezés másik projektbe">➡️ Áthelyezés</button>
          <button class="btn-sm hp-doc-dl-btn" title="A legutóbb legenerált HTML letöltése — szerkesztő megnyitása nélkül">⬇ HTML</button>
          <button class="btn-sm hp-doc-link-btn" title="Megosztható link másolása (csak bejelentkezett felhasználók nyithatják meg)">🔗 Link</button>
          <button class="btn-sm del hp-doc-del-btn" title="Dokumentum törlése">🗑 Törlés</button>
          <button class="btn primary hp-doc-open-btn">Megnyitás</button>
        </div>
      `;
      card.querySelector('.hp-doc-edit-btn').onclick = (e) => { e.stopPropagation(); renameDocInProject(projectId, d.id, d.title); };
      card.querySelector('.hp-doc-move-btn').onclick = (e) => { e.stopPropagation(); openMoveDocModal(projectId, d.id, d.title); };
      card.querySelector('.hp-doc-dl-btn').onclick = (e) => { e.stopPropagation(); downloadPublishedHtml(projectId, d.id, d.title); };
      card.querySelector('.hp-doc-link-btn').onclick = (e) => { e.stopPropagation(); copyDocShareLink(projectId, d.id); };
      card.querySelector('.hp-doc-del-btn').onclick = (e) => { e.stopPropagation(); deleteDocInProject(projectId, d.id, d.title); };
      card.querySelector('.hp-doc-open-btn').onclick = (e) => { e.stopPropagation(); openDoc(); };
      grid.appendChild(card);
    });
  }
  const newCard = document.createElement('div');
  newCard.className = 'hp-card hp-new-card';
  newCard.style.minHeight = '68px';
  newCard.onclick = (e) => { e.stopPropagation(); openNewDocModal(); };
  newCard.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><span class="plus" style="font-size:20px">+</span><span>Új dokumentum</span></div>';
  grid.appendChild(newCard);
}

// ── Új Projekt modal (szín/ikon választóval) ──
function renderSwatches() {
  const row = document.getElementById('ntp-color-row');
  if (!row) return;
  row.innerHTML = '';
  PROJECT_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (c === state.ntpColor ? ' selected' : '');
    sw.style.background = c;
    sw.title = c;
    sw.onclick = () => { state.ntpColor = c; renderSwatches(); };
    row.appendChild(sw);
  });
}
function renderIconOptions() {
  const row = document.getElementById('ntp-icon-row');
  if (!row) return;
  row.innerHTML = '';
  PROJECT_ICONS.forEach(ic => {
    const opt = document.createElement('div');
    opt.className = 'icon-opt' + (ic === state.ntpIcon ? ' selected' : '');
    opt.textContent = ic;
    opt.onclick = () => { state.ntpIcon = ic; renderIconOptions(); };
    row.appendChild(opt);
  });
}
function openNewTopProjectModal() {
  state.editingProjectId = null;
  document.getElementById('ntp-modal-title').textContent = '➕ Új projekt';
  document.getElementById('ntp-submit-btn').textContent = 'Létrehozás';
  document.getElementById('ntp-name').value = '';
  document.getElementById('ntp-desc').value = '';
  state.ntpColor = PROJECT_COLORS[0];
  state.ntpIcon = PROJECT_ICONS[0];
  renderSwatches();
  renderIconOptions();
  document.getElementById('new-topproject-modal-backdrop').classList.add('open');
}
function openEditTopProjectModal(p) {
  state.editingProjectId = p.id;
  document.getElementById('ntp-modal-title').textContent = '✏ Projekt szerkesztése';
  document.getElementById('ntp-submit-btn').textContent = 'Mentés';
  document.getElementById('ntp-name').value = p.name || '';
  document.getElementById('ntp-desc').value = p.description || '';
  state.ntpColor = p.color || PROJECT_COLORS[0];
  state.ntpIcon = p.icon || PROJECT_ICONS[0];
  renderSwatches();
  renderIconOptions();
  document.getElementById('new-topproject-modal-backdrop').classList.add('open');
}
function closeNewTopProjectModal() {
  document.getElementById('new-topproject-modal-backdrop').classList.remove('open');
  state.editingProjectId = null;
}
async function saveTopProject() {
  const name = document.getElementById('ntp-name').value.trim();
  if (!name) { toast('Add meg a projekt nevét!', 'err'); return; }
  const desc = document.getElementById('ntp-desc').value.trim();

  if (state.editingProjectId) {
    const id = state.editingProjectId;
    const meta = { name, description: desc, color: state.ntpColor, icon: state.ntpIcon };
    toast('☁️ Mentés...', 'ok', 2000);
    const ok = await cloudUpload(id + '/_project.json', JSON.stringify(meta, null, 2), 'application/json');
    if (!ok) { toast('⚠ Mentés sikertelen', 'err'); return; }
    closeNewTopProjectModal();

    const entry = (state.homeProjects || []).find(p => p.id === id);
    if (entry) { entry.name = name; entry.description = desc; entry.color = state.ntpColor; entry.icon = state.ntpIcon; }
    if (state.currentTopProject === id) {
      state.currentTopProjectMeta = { ...(state.currentTopProjectMeta || {}), id, name, description: desc, color: state.ntpColor, icon: state.ntpIcon };
      if (state.uiView === 'project') {
        document.getElementById('project-page-title').textContent = name;
        document.getElementById('project-page-desc').textContent = desc;
      }
      updateBreadcrumb();
    }
    if (state.uiView === 'home') renderHomeGrid();
    toast('✓ Projekt frissítve');
    return;
  }

  // Új Projekt létrehozása
  const existing = state.homeProjects || (await cloudListTopProjects());
  let id = slugify(name) || ('projekt-' + Math.floor(Math.random() * 100000));
  if (existing.find(p => p.id === id)) id = id + '-' + Math.floor(Math.random() * 1000);

  const meta = { name, description: desc, color: state.ntpColor, icon: state.ntpIcon };
  toast('☁️ Projekt létrehozása...', 'ok', 2000);
  await cloudUpload(id + '/_project.json', JSON.stringify(meta, null, 2), 'application/json');

  closeNewTopProjectModal();
  toast('✓ Projekt létrehozva');
  state.homeProjects = null;
  await showProjectView(id);
}

// Egy (felhőben törölt / áthelyezett) Dokumentum eltávolítása a memóriából.
async function forgetLocalCopy(folderId) {
  unregisterProject(folderId);
}

async function deleteTopProjectFromHome(projectId, name) {
  if (!confirm('Törlöd a(z) "' + (name || projectId) + '" projektet?\nEz véglegesen törli az ÖSSZES benne lévő dokumentumot, fejezetet, CSS-t és beállítást a felhőből — ez nem vonható vissza.')) return;
  toast('🗑 Projekt törlése...', 'ok', 3000);
  await cloudDeleteAllUnder(projectId);

  // Minden, ebből a Projektből esetleg már betöltött Dokumentum eltávolítása a memóriából/IndexedDB-ből.
  for (const folderId of Object.keys(state.projects)) {
    if (state.projects[folderId].topProjectId === projectId) await forgetLocalCopy(folderId);
  }

  state.homeProjects = (state.homeProjects || []).filter(p => p.id !== projectId);
  renderHomeGrid();
  toast('✓ Projekt törölve');
}

// ── Új Dokumentum modal (egy Projekten belül) ──
function openNewDocModal() {
  document.getElementById('nd-id').value = '';
  document.getElementById('nd-title').value = '';
  document.getElementById('new-doc-modal-backdrop').classList.add('open');
}
function closeNewDocModal() {
  document.getElementById('new-doc-modal-backdrop').classList.remove('open');
}
async function createDocInProject() {
  const projectId = state.currentTopProject;
  if (!projectId) return;
  const id = document.getElementById('nd-id').value.trim().replace(/\s+/g, '-');
  const title = document.getElementById('nd-title').value.trim();
  if (!id) { toast('Add meg a dokumentum azonosítóját!', 'err'); return; }
  if ((state.projectDocs || []).find(d => d.id === id)) { toast('Már létezik ilyen azonosítójú dokumentum ebben a projektben!', 'err'); return; }

  const config = { title: title || id, subtitle: title || id, description: '', lang: 'hu', output: id + '.html' };
  const starterRaw = '---\nid: bevezetes\ntitle: Bevezetés\n---\n\n# Bevezetés\n\n';

  toast('☁️ Létrehozás...', 'ok', 2000);
  await cloudUpload(projectId + '/' + id + '/config.json', JSON.stringify(config, null, 2), 'application/json');
  await cloudUpload(projectId + '/' + id + '/style.css', getDefaultCSS(), 'text/css');
  await cloudUpload(projectId + '/' + id + '/sections/01_bevezetes.md', starterRaw, 'text/markdown');

  closeNewDocModal();
  await cloudLoadProject(projectId + '/' + id, projectId, id);
}

// ── Dokumentum átnevezése / törlése egy Projekten belül ──
// Fontos: ezek a Projekt nézet dokumentum-kártyáiról hívódnak, ahol a dokumentum
// esetleg MÉG NINCS betöltve a szerkesztőbe (state.projects-ben) — ezért közvetlenül
// a Storage-ban lévő config.json-t olvassuk/írjuk, nem a memóriában lévő objektumot.
async function renameDocInProject(projectId, docId, currentTitle) {
  const newTitle = prompt('Új cím a dokumentumnak:', currentTitle || docId);
  if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) return;
  const trimmed = newTitle.trim();
  const folder = projectId + '/' + docId;

  const configText = await cloudDownloadText(folder + '/config.json');
  let config = {};
  if (configText) { try { config = JSON.parse(configText); } catch(e) {} }
  config.title = trimmed;
  const ok = await cloudUpload(folder + '/config.json', JSON.stringify(config, null, 2), 'application/json');
  if (!ok) { toast('⚠ Átnevezés sikertelen', 'err'); return; }

  // Ha ez a dokumentum épp meg van nyitva a szerkesztőben, ott is frissítjük.
  const openProj = state.projects[folder];
  if (openProj) {
    openProj.config.title = trimmed;
    if (state.currentProject === folder) updateBreadcrumb();
  }

  if (state.projectDocs) {
    const d = state.projectDocs.find(x => x.id === docId);
    if (d) d.title = trimmed;
  }
  renderProjectDocGrid();
  toast('✓ Átnevezve');
}

async function openMoveDocModal(projectId, docId, title) {
  state.moveDocSource = { projectId, docId, title };
  const sel = document.getElementById('move-doc-target-select');
  sel.innerHTML = '<option value="">Betöltés...</option>';
  document.getElementById('move-doc-modal-backdrop').classList.add('open');

  // Friss (nem cache-elt) Projekt-lista, docCount nélkül — itt csak a névre van szükség,
  // nem érdemes minden Projekt összes Dokumentumát is végignézni csak egy legördülőhöz.
  const ids = (await cloudListProjectIds()).filter(id => id !== projectId);
  const others = [];
  for (const id of ids) {
    const m = await cloudGetProjectMeta(id);
    others.push(m || { id, name: id });
  }
  if (!others.length) {
    sel.innerHTML = '<option value="">— nincs másik projekt —</option>';
  } else {
    sel.innerHTML = '';
    others.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }
}
function closeMoveDocModal() {
  document.getElementById('move-doc-modal-backdrop').classList.remove('open');
  state.moveDocSource = null;
}
async function runMoveDoc() {
  const src = state.moveDocSource;
  if (!src) return;
  const toProjectId = document.getElementById('move-doc-target-select').value;
  if (!toProjectId) { toast('Válassz célprojektet!', 'err'); return; }

  toast('➡️ Áthelyezés folyamatban...', 'ok', 4000);
  const result = await cloudMoveDocument(src.projectId, src.docId, toProjectId);
  if (!result.ok) {
    toast(result.reason === 'exists' ? 'A célprojektben már van ilyen azonosítójú dokumentum!' : '⚠ Áthelyezés sikertelen', 'err', 4000);
    return;
  }
  closeMoveDocModal();

  // Ha épp meg volt nyitva a szerkesztőben a forrás helyről, zárjuk be onnan.
  await forgetLocalCopy(src.projectId + '/' + src.docId);

  state.homeProjects = null; // mindkét projekt dokumentumszáma változott
  toast('✓ Dokumentum áthelyezve');
  await showProjectView(src.projectId); // a forrás Projekt nézete frissül, a dokumentum eltűnik belőle
}

async function deleteDocInProject(projectId, docId, title) {
  if (!confirm('Törlöd a(z) "' + (title || docId) + '" dokumentumot?\nEz véglegesen törli az összes fejezetét, a CSS-ét és a beállításait a felhőből — ez nem vonható vissza.')) return;
  toast('🗑 Törlés...', 'ok', 2500);
  const ok = await cloudDeleteDocument(projectId, docId);
  if (!ok) { toast('⚠ Törlés sikertelen', 'err'); return; }

  await forgetLocalCopy(projectId + '/' + docId);

  state.projectDocs = (state.projectDocs || []).filter(d => d.id !== docId);
  state.homeProjects = null; // a projekt-kártya dokumentumszáma elavult, legközelebb frissül
  renderProjectDocGrid();
  toast('✓ Dokumentum törölve');
}

// ── Importálás: mappából vagy a böngészőben tárolt régi helyi projektből ──────
let _importFolderSource = null;
let _legacyProjects = [];

async function openImportModal() {
  _importFolderSource = null;
  document.getElementById('import-folder-input').value = '';
  document.getElementById('import-folder-info').textContent = 'Nincs kiválasztva mappa';
  document.getElementById('import-doc-id').value = '';
  document.getElementById('import-doc-title').value = '';
  setImportSource('folder');
  document.getElementById('import-modal-backdrop').classList.add('open');

  _legacyProjects = await listLegacyLocalProjects();
  const row = document.getElementById('import-legacy-option');
  const sel = document.getElementById('import-legacy-select');
  row.style.display = _legacyProjects.length ? '' : 'none';
  sel.innerHTML = '';
  _legacyProjects.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = p.title + ' (' + Object.keys(p.files).length + ' fejezet)';
    sel.appendChild(o);
  });
}
function closeImportModal() {
  document.getElementById('import-modal-backdrop').classList.remove('open');
}
function setImportSource(kind) {
  document.querySelectorAll('input[name=import-source]').forEach(r => { r.checked = r.value === kind; });
  document.getElementById('import-folder-box').style.display = kind === 'folder' ? '' : 'none';
  document.getElementById('import-legacy-box').style.display = kind === 'legacy' ? '' : 'none';
  if (kind === 'legacy') onLegacySelected();
}
function onLegacySelected() {
  const p = _legacyProjects[document.getElementById('import-legacy-select').value];
  if (!p) return;
  if (!document.getElementById('import-doc-title').value) document.getElementById('import-doc-title').value = p.title;
  if (!document.getElementById('import-doc-id').value) document.getElementById('import-doc-id').value = slugify(p.name);
}
async function onImportFolderPicked(input) {
  if (!input.files.length) return;
  _importFolderSource = await readFolderSource(input.files);
  const n = Object.keys(_importFolderSource.files).length;
  const imgs = Object.keys(_importFolderSource.images).length;
  const root = input.files[0].webkitRelativePath.split('/')[0];
  document.getElementById('import-folder-info').textContent = n
    ? `${root}: ${n} fejezet${imgs ? ', ' + imgs + ' kép' : ''}`
    : `${root}: nem találtam fejezetet (sections/*.md)`;
  if (!document.getElementById('import-doc-title').value) document.getElementById('import-doc-title').value = _importFolderSource.config.title || root;
  if (!document.getElementById('import-doc-id').value) document.getElementById('import-doc-id').value = slugify(root);
}

async function runImport() {
  const projectId = state.currentTopProject;
  if (!projectId) return;
  const kind = (document.querySelector('input[name=import-source]:checked') || {}).value;
  let source = null;
  if (kind === 'legacy') source = _legacyProjects[document.getElementById('import-legacy-select').value];
  else source = _importFolderSource;
  if (!source || !Object.keys(source.files || {}).length) { toast('Válassz egy mappát (vagy régi projektet), amiben vannak fejezetek!', 'err'); return; }

  const docId = slugify(document.getElementById('import-doc-id').value.trim());
  const title = document.getElementById('import-doc-title').value.trim();
  if (!docId) { toast('Add meg a dokumentum azonosítóját!', 'err'); return; }
  if ((await cloudListDocuments(projectId)).find(d => d.id === docId)) { toast('Már létezik ilyen azonosítójú dokumentum ebben a projektben!', 'err'); return; }

  toast('☁️ Importálás folyamatban, ez eltarthat pár másodpercig...', 'ok', 8000);
  const ok = await importAsCloudDocument(projectId, docId, title, source);
  if (!ok) { toast('⚠ Az importálás nem sikerült teljesen', 'err', 5000); return; }
  closeImportModal();
  toast('✓ Importálva — megnyitás...', 'ok', 2500);
  await cloudLoadProject(projectId + '/' + docId, projectId, docId);
}
