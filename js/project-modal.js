// ── Drag & drop folder ────────────────────────────────────────────────────────
// Drag & drop — a böngésző biztonsági okokból nem enged mappát olvasni drag-ból
// ezért a folder input a megbízható módszer
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  // Irányítjuk a mappás inputhoz
  toast('Kattints a 📂 ikonra a mappa betöltéséhez', '', 2500);
});

// ── Projekt kezelő modal ─────────────────────────────────────────────────────
function openProjModal() {
  switchModalTab('projects');
  refreshProjList();
  document.getElementById('proj-modal-backdrop').classList.add('open');
}

async function closeProjModal() {
  // Nem mentett megjelenés-módosítás esetén rákérdezünk (lásd design.js).
  await resolveUnsavedCssOnClose();
  document.getElementById('proj-modal-backdrop').classList.remove('open');
}

document.getElementById('proj-modal-backdrop').addEventListener('click', function(e) {
  if (e.target === this) closeProjModal();
});

// ── Tab váltás ────────────────────────────────────────────────────────────────
function switchModalTab(tab) {
  document.querySelectorAll('#proj-modal .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#proj-modal .tab-panel').forEach(p => p.classList.remove('active'));
  const tabs = ['projects','new','copy','settings','css'];
  const idx = tabs.indexOf(tab);
  if (idx === -1) return;
  document.querySelectorAll('#proj-modal .tab')[idx].classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'css') loadCssEditor();
  if (tab === 'copy') loadCopyTab();
  if (tab === 'settings') loadSettingsTab();
}

// ── Projektek lista ───────────────────────────────────────────────────────────
function refreshProjList() {
  const list = document.getElementById('proj-modal-list');
  list.innerHTML = '';
  const names = Object.keys(state.projects);
  if (!names.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:8px 0">Nincs betöltött projekt.</div>';
    return;
  }
  names.forEach(name => {
    const proj = state.projects[name];
    const displayName = proj.config.title || proj.docId || name;
    const isActive = name === state.currentProject;
    const isCloud = !!proj.cloudFolder;
    // Felhő dokumentumnál a szülő Projekt nevét (ha ismert) is kiírjuk zárójelben —
    // e nélkül két különböző Projektben lévő, azonos című Dokumentum megkülönböztethetetlen
    // lenne ebben a listában.
    let subtitleText = '';
    if (isCloud && proj.topProjectId) {
      const meta = (state.homeProjects || []).find(p => p.id === proj.topProjectId);
      subtitleText = meta ? meta.name : proj.topProjectId;
    }
    const row = document.createElement('div');
    row.className = 'proj-row' + (isActive ? ' active-proj' : '');
    row.dataset.name = name;
    row.innerHTML = `
      <span class="proj-name" title="${escapeHtml(name)}">${isCloud ? '<span title="Felhőben tárolt dokumentum">☁️</span> ' : ''}${escapeHtml(displayName)}${subtitleText ? ' <span style="color:var(--text3);font-weight:400;font-size:11px">— ' + escapeHtml(subtitleText) + '</span>' : ''}${isActive ? ' <span style="font-size:10px;color:var(--accent2)">(aktív)</span>' : ''}</span>
      <input class="proj-rename" type="text" value="${escapeHtml(displayName)}" />
      <button class="btn-sm" onclick="startRename('${name}')">✏</button>
      <button class="btn-sm confirm-btn" onclick="confirmRename('${name}')" style="display:none">✓</button>
      <button class="btn-sm" onclick="activateProject('${name}')" ${isActive ? 'disabled style="opacity:.4"' : ''}>→ Váltás</button>
      <button class="btn-sm del" onclick="deleteProject('${name}')">🗑</button>
    `;
    list.appendChild(row);
  });
}

function startRename(name) {
  const row = document.querySelector(`.proj-row[data-name="${name}"]`);
  if (!row) return;
  row.classList.add('renaming');
  row.querySelector('.confirm-btn').style.display = '';
  row.querySelector('.proj-rename').focus();
  row.querySelector('.proj-rename').select();
}

async function confirmRename(name) {
  const row = document.querySelector(`.proj-row[data-name="${name}"]`);
  if (!row) return;
  const newTitle = row.querySelector('.proj-rename').value.trim();
  if (!newTitle) return;
  const proj = state.projects[name];
  proj.config.title = newTitle;
  registerProject(proj);
  if (state.currentProject === name) updateBreadcrumb();
  // A config.json-t is frissítjük (felhő / mappa) — korábban helyi projektnél csak
  // az IndexedDB-be került, így a mappából újranyitva a régi cím jött vissza.
  await saveProjectConfig(proj, { showToast: false, interactive: false });
  if (proj.cloudFolder) {
    if (state.projectDocs && proj.docId) {
      const d = state.projectDocs.find(x => x.id === proj.docId);
      if (d) d.title = newTitle;
    }
  }
  refreshProjList();
  toast('✓ Átnevezve' + (proj.cloudFolder ? ' (a felhőben is)' : ''));
}

async function activateProject(name) {
  if (!state.projects[name]) return;
  if (name !== state.currentProject) await resolveUnsavedCssOnClose();
  state.currentProject = name;
  state.currentFile = null;
  document.getElementById('project-select').value = name;
  renderSidebar();
  showEditorPane();
  const proj = state.projects[name];
  if (proj.fileOrder.length > 0) openFile(proj.fileOrder[0]);
  checkFolderAccessBtn();
  document.getElementById('proj-modal-backdrop').classList.remove('open');
  toast('→ Projekt: ' + (proj.config.title || proj.docId || name));
  if (proj.topProjectId) {
    state.currentTopProject = proj.topProjectId;
    if (!state.currentTopProjectMeta || state.currentTopProjectMeta.id !== proj.topProjectId) {
      cloudGetProjectMeta(proj.topProjectId).then(m => { if (m) { state.currentTopProjectMeta = m; updateBreadcrumb(); } });
    }
  }
  enterEditorView();
}

async function deleteProject(name) {
  const proj = state.projects[name];
  const isCloud = !!(proj && proj.cloudFolder);
  const label = proj?.config?.title || proj?.docId || name;
  const confirmMsg = isCloud
    ? `Törlöd a(z) "${label}" dokumentumot?\nEz véglegesen törli az összes fejezetét, a CSS-ét és a beállításait a felhőből — ez nem vonható vissza, és minden kollégának eltűnik.`
    : `Törlöd a "${label}" projektet?\n(Fájlok a lemezen megmaradnak.)`;
  if (!confirm(confirmMsg)) return;

  if (isCloud) {
    toast('🗑 Törlés a felhőből...', 'ok', 2500);
    await cloudDeleteAllUnder(proj.cloudFolder);
    state.homeProjects = null;
    if (state.projectDocs && proj.docId) state.projectDocs = state.projectDocs.filter(d => d.id !== proj.docId);
  }

  const wasCurrent = state.currentProject === name;
  if (wasCurrent) discardCssDraft();
  await deleteProjectRecords(name);
  unregisterProject(name);
  const sel = document.getElementById('project-select');
  if (wasCurrent) {
    const remaining = Object.keys(state.projects);
    if (remaining.length > 0) {
      activateProject(remaining[0]);
    } else {
      state.currentProject = null; state.currentFile = null;
      sel.value = '';
      document.getElementById('editor-pane').style.display = 'none';
      document.getElementById('preview-pane').style.display = 'none';
      document.getElementById('empty-state').style.display = 'flex';
      document.getElementById('file-list').innerHTML =
        '<div style="padding:20px 14px;font-size:12px;color:var(--text3);text-align:center">Tölts be egy projektet</div>';
    }
  }
  toast(isCloud ? '✓ Dokumentum törölve a felhőből' : '🗑 Törölve'); refreshProjList();
}

// ── Új projekt ────────────────────────────────────────────────────────────────
async function createNewProject() {
  const id = document.getElementById('new-proj-id').value.trim().replace(/\s+/g,'-');
  const title = document.getElementById('new-proj-title').value.trim();
  const desc = document.getElementById('new-proj-desc').value.trim();
  if (!id) { toast('Add meg a projekt azonosítóját!', 'err'); return; }
  if (state.projects[id]) { toast('Már létezik ilyen azonosítójú projekt!', 'err'); return; }

  const project = newProjectObject(id, {
    config: { title: title || id, subtitle: title || id, description: desc, lang: 'hu', output: id + '.html' },
    css: getDefaultCSS()
  });
  registerProject(project);
  // HIBAJAVÍTÁS: korábban itt persistState() futott, ami az ÉPP AKTÍV (régi) projektet
  // mentette, nem az újat — az új projekt így egy oldalfrissítés után eltűnhetett.
  await persistProject(project);

  // Reset form
  document.getElementById('new-proj-id').value = '';
  document.getElementById('new-proj-title').value = '';
  document.getElementById('new-proj-desc').value = '';

  activateProject(id);
  toast('✓ Új projekt létrehozva: ' + (title || id));
}

// ── Fejezet másolás ───────────────────────────────────────────────────────────
function loadCopyTab() {
  const srcSel = document.getElementById('copy-source-select');
  const destSel = document.getElementById('copy-dest-select');
  const names = Object.keys(state.projects);

  // Source select
  srcSel.innerHTML = '<option value="">— válassz projektet —</option>';
  names.forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = state.projects[n].config.title || n;
    srcSel.appendChild(o);
  });

  // Dest select
  destSel.innerHTML = '';
  names.forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = state.projects[n].config.title || n;
    if (n === state.currentProject) o.selected = true;
    destSel.appendChild(o);
  });

  document.getElementById('copy-chapters-list').innerHTML = '';
  document.getElementById('copy-dest-row').style.display = 'none';
}

function loadCopyChapters() {
  const src = document.getElementById('copy-source-select').value;
  const list = document.getElementById('copy-chapters-list');
  list.innerHTML = '';

  if (!src || !state.projects[src]) {
    document.getElementById('copy-dest-row').style.display = 'none';
    return;
  }

  const proj = state.projects[src];
  if (!proj.fileOrder.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px">Ennek a projektnek nincs fejezete.</div>';
    document.getElementById('copy-dest-row').style.display = 'none';
    return;
  }

  // Select all checkbox
  const selAllRow = document.createElement('div');
  selAllRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:4px 10px;margin-bottom:6px';
  selAllRow.innerHTML = `<input type="checkbox" id="copy-select-all" onchange="toggleSelectAll(this)" style="accent-color:var(--accent);width:15px;height:15px" />
    <label for="copy-select-all" style="font-size:12px;color:var(--text3);cursor:pointer">Összes kijelölése</label>`;
  list.appendChild(selAllRow);

  proj.fileOrder.forEach(fn => {
    const f = proj.files[fn];
    const title = f.meta.title || fn.replace(/^\d+_?/,'').replace('.md','');
    const row = document.createElement('div');
    row.className = 'copy-chapter-row';
    row.dataset.fn = fn;
    row.innerHTML = `
      <input type="checkbox" class="copy-cb" data-fn="${fn}" style="accent-color:var(--accent);width:15px;height:15px" />
      <div>
        <div class="ch-name">${title}</div>
        <div class="ch-file">${fn}</div>
      </div>`;
    row.addEventListener('click', e => {
      if (e.target.type !== 'checkbox') {
        const cb = row.querySelector('.copy-cb');
        cb.checked = !cb.checked;
      }
      row.classList.toggle('selected', row.querySelector('.copy-cb').checked);
    });
    list.appendChild(row);
  });

  document.getElementById('copy-dest-row').style.display = 'flex';
}

function toggleSelectAll(cb) {
  document.querySelectorAll('.copy-cb').forEach(c => {
    c.checked = cb.checked;
    c.closest('.copy-chapter-row').classList.toggle('selected', cb.checked);
  });
}

async function copySelectedChapters() {
  const src = document.getElementById('copy-source-select').value;
  const dest = document.getElementById('copy-dest-select').value;
  if (!src || !dest) { toast('Válassz forrást és célt!', 'err'); return; }
  if (src === dest) { toast('A forrás és a cél nem lehet ugyanaz!', 'err'); return; }

  const selected = [...document.querySelectorAll('.copy-cb:checked')].map(c => c.dataset.fn);
  if (!selected.length) { toast('Jelölj be legalább egy fejezetet!', 'err'); return; }

  const srcProj = state.projects[src];
  const destProj = state.projects[dest];

  let copied = 0, skipped = 0;
  selected.forEach(fn => {
    if (destProj.files[fn]) {
      if (!confirm(`"${fn}" már létezik a célprojektben. Felülírja?`)) { skipped++; return; }
    }
    const srcFile = srcProj.files[fn];
    destProj.files[fn] = {
      meta: { ...srcFile.meta },
      content: srcFile.content,
      raw: srcFile.raw,
      dirty: true,
      fileHandle: null
    };
    if (!destProj.fileOrder.includes(fn)) destProj.fileOrder.push(fn);
    copied++;
  });

  destProj.fileOrder.sort();
  await persistProject(destProj); // a CÉL projektet mentjük (nem feltétlenül az aktív)
  // Felhő / írható mappa esetén a másolt fejezetek és az új sorrend azonnal ki is kerülnek.
  for (const fn of selected) {
    if (destProj.files[fn] && destProj.files[fn].dirty) await saveChapterSilently(destProj, fn);
  }
  await saveProjectConfig(destProj, { showToast: false, interactive: false });

  // Ha a cél az aktív projekt, frissítsük a sidebárt
  if (dest === state.currentProject) renderSidebar();

  toast(`✓ ${copied} fejezet másolva${skipped ? ', ' + skipped + ' kihagyva' : ''}`);
  loadCopyChapters(); // reset checkboxes
}

// ── Beállítások tab (logó + nav csoportok) ───────────────────────────────────
function loadSettingsTab() {
  if (!state.currentProject || !state.projects[state.currentProject]) {
    document.getElementById('nav-groups-editor').innerHTML =
      '<div style="font-size:13px;color:var(--text3);padding:8px">Előbb tölts be egy projektet.</div>';
    return;
  }
  const proj = state.projects[state.currentProject];

  // Logó előnézet
  const img = document.getElementById('logo-preview-img');
  const empty = document.getElementById('logo-preview-empty');
  if (proj.logo) {
    img.src = proj.logo; img.style.display = 'block'; empty.style.display = 'none';
  } else {
    img.style.display = 'none'; empty.style.display = 'block';
  }

  // Nav csoportok editor
  renderNavGroupsEditor();
}

function handleLogoUpload(input) {
  if (!state.currentProject) return;
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const proj = state.projects[state.currentProject];
    proj.logo = e.target.result;
    // Update preview
    const img = document.getElementById('logo-preview-img');
    const empty = document.getElementById('logo-preview-empty');
    img.src = proj.logo; img.style.display = 'block'; empty.style.display = 'none';
    const ok = await saveProjectLogo(proj);
    renderPreview();
    toast(ok ? '✓ Logó feltöltve' : '⚠ A logó csak a böngészőbe mentődött', ok ? 'ok' : 'err');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function removeLogo() {
  if (!state.currentProject) return;
  state.projects[state.currentProject].logo = '';
  document.getElementById('logo-preview-img').style.display = 'none';
  document.getElementById('logo-preview-empty').style.display = 'block';
  await saveProjectLogo(state.projects[state.currentProject]);
  renderPreview();
  toast('Logó eltávolítva');
}
