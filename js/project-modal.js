// ── ⚙ Beállítások ablak: Dokumentum / Fejezetek másolása (a Megjelenés: designpanel.js) ────────

// A szerkesztőn kívülre ejtett fájl ne nyissa meg a böngészőben (elhagyva az oldalt).
document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) e.preventDefault(); });

function openProjModal(tab = 'doc') {
  if (!currentProj()) { toast('Előbb nyiss meg egy dokumentumot!', 'err'); return; }
  switchModalTab(tab);
  document.getElementById('proj-modal-backdrop').classList.add('open');
}

async function closeProjModal() {
  document.getElementById('proj-modal-backdrop').classList.remove('open');
}

document.getElementById('proj-modal-backdrop').addEventListener('click', function(e) {
  if (e.target === this) closeProjModal();
});

const MODAL_TABS = ['doc', 'copy'];
function switchModalTab(tab) {
  const idx = MODAL_TABS.indexOf(tab);
  if (idx === -1) return;
  document.querySelectorAll('#proj-modal .tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  document.querySelectorAll('#proj-modal .tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  if (tab === 'doc') loadDocTab();
  if (tab === 'copy') loadCopyTab();
}

// ── Dokumentum fül: cím, alcím, leírás, logó ─────────────────────────────────
function loadDocTab() {
  const proj = currentProj();
  if (!proj) return;
  document.getElementById('doc-title').value = proj.config.title || '';
  document.getElementById('doc-subtitle').value = proj.config.subtitle || '';
  document.getElementById('doc-description').value = proj.config.description || '';
  showLogoPreview(proj.logo);
}

function showLogoPreview(logo) {
  const img = document.getElementById('logo-preview-img');
  const empty = document.getElementById('logo-preview-empty');
  if (logo) { img.src = logo; img.style.display = 'block'; empty.style.display = 'none'; }
  else { img.style.display = 'none'; empty.style.display = 'block'; }
}

async function saveDocSettings() {
  const proj = currentProj();
  if (!proj) return;
  const title = document.getElementById('doc-title').value.trim();
  if (!title) { toast('A cím nem lehet üres!', 'err'); return; }
  proj.config.title = title;
  proj.config.subtitle = document.getElementById('doc-subtitle').value.trim() || title;
  proj.config.description = document.getElementById('doc-description').value.trim();
  const ok = await saveProjectConfig(proj);
  updateBreadcrumb();
  renderPreview();
  if (state.projectDocs) { const d = state.projectDocs.find(x => x.id === proj.docId); if (d) d.title = title; }
  toast(ok ? '✓ Dokumentum adatai mentve' : '⚠ Mentés sikertelen', ok ? 'ok' : 'err');
}

function handleLogoUpload(input) {
  const proj = currentProj();
  const file = input.files[0];
  input.value = '';
  if (!proj || !file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    proj.logo = e.target.result;
    showLogoPreview(proj.logo);
    const ok = await saveProjectLogo(proj);
    renderPreview();
    toast(ok ? '✓ Logó feltöltve' : '⚠ A logó mentése nem sikerült', ok ? 'ok' : 'err');
  };
  reader.readAsDataURL(file);
}

async function removeLogo() {
  const proj = currentProj();
  if (!proj) return;
  proj.logo = '';
  showLogoPreview('');
  await saveProjectLogo(proj);
  renderPreview();
  toast('Logó eltávolítva');
}

// ── Fejezetek másolása egy másik Dokumentumból ────────────────────────────────
let _copySource = null; // { folder, data }

async function loadCopyTab() {
  const projSel = document.getElementById('copy-project-select');
  document.getElementById('copy-doc-select').innerHTML = '';
  document.getElementById('copy-chapters-list').innerHTML = '';
  document.getElementById('copy-dest-row').style.display = 'none';
  _copySource = null;
  projSel.innerHTML = '<option value="">Betöltés...</option>';
  const ids = await cloudListProjectIds();
  projSel.innerHTML = '<option value="">— válassz projektet —</option>';
  for (const id of ids) {
    const m = (state.homeProjects || []).find(p => p.id === id) || await cloudGetProjectMeta(id) || { id, name: id };
    const o = document.createElement('option');
    o.value = id; o.textContent = m.name;
    projSel.appendChild(o);
  }
  if (state.currentTopProject && ids.includes(state.currentTopProject)) { projSel.value = state.currentTopProject; loadCopyDocs(); }
}

async function loadCopyDocs() {
  const projectId = document.getElementById('copy-project-select').value;
  const docSel = document.getElementById('copy-doc-select');
  document.getElementById('copy-chapters-list').innerHTML = '';
  document.getElementById('copy-dest-row').style.display = 'none';
  if (!projectId) { docSel.innerHTML = ''; return; }
  docSel.innerHTML = '<option value="">Betöltés...</option>';
  const docs = await cloudListDocuments(projectId);
  const current = currentProj();
  docSel.innerHTML = '<option value="">— válassz dokumentumot —</option>';
  docs.forEach(d => {
    if (current && current.cloudFolder === projectId + '/' + d.id) return;
    const o = document.createElement('option');
    o.value = projectId + '/' + d.id; o.textContent = d.title;
    docSel.appendChild(o);
  });
}

async function loadCopyChapters() {
  const folder = document.getElementById('copy-doc-select').value;
  const list = document.getElementById('copy-chapters-list');
  list.innerHTML = '';
  document.getElementById('copy-dest-row').style.display = 'none';
  if (!folder) return;
  list.innerHTML = '<div class="hint" style="padding:8px">Betöltés...</div>';
  const data = await cloudFetchDocument(folder);
  _copySource = { folder, data };
  const tmp = { files: {}, config: data.config, fileOrder: [] };
  Object.entries(data.files).forEach(([fn, raw]) => { tmp.files[fn] = makeFileEntry(raw); ensureChapterMeta(fn, tmp.files[fn]); });
  normalizeStructure(tmp);
  list.innerHTML = '';
  if (!tmp.fileOrder.length) { list.innerHTML = '<div class="hint" style="padding:8px">Ennek a dokumentumnak nincs fejezete.</div>'; return; }

  const selAll = document.createElement('div');
  selAll.style.cssText = 'display:flex;align-items:center;gap:10px;padding:4px 10px;margin-bottom:6px';
  selAll.innerHTML = `<input type="checkbox" id="copy-select-all" onchange="toggleSelectAll(this)" style="accent-color:var(--accent);width:15px;height:15px" />
    <label for="copy-select-all" style="font-size:12px;color:var(--text3);cursor:pointer">Összes kijelölése</label>`;
  list.appendChild(selAll);
  tmp.fileOrder.forEach(fn => {
    const row = document.createElement('div');
    row.className = 'copy-chapter-row';
    row.innerHTML = `<input type="checkbox" class="copy-cb" data-fn="${escapeHtml(fn)}" style="accent-color:var(--accent);width:15px;height:15px" />
      <div><div class="ch-name">${escapeHtml(tmp.files[fn].meta.title)}</div><div class="ch-file">${escapeHtml(fn)}</div></div>`;
    row.addEventListener('click', e => {
      const cb = row.querySelector('.copy-cb');
      if (e.target !== cb) cb.checked = !cb.checked;
      row.classList.toggle('selected', cb.checked);
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

// A kijelölt fejezetek átmásolása az aktuális dokumentumba (a képeikkel együtt).
async function copySelectedChapters() {
  const proj = currentProj();
  if (!proj || !_copySource) return;
  const selected = [...document.querySelectorAll('.copy-cb:checked')].map(c => c.dataset.fn);
  if (!selected.length) { toast('Jelölj be legalább egy fejezetet!', 'err'); return; }
  toast('📋 Másolás...', 'ok', 3000);
  let copied = 0, skipped = 0;
  for (const fn of selected) {
    const f = makeFileEntry(_copySource.data.files[fn]);
    ensureChapterMeta(fn, f);
    let targetFn = fn;
    if (proj.files[fn]) {
      if (!confirm(`"${f.meta.title}" (${fn}) már létezik ebben a dokumentumban. Felülírod?`)) { skipped++; continue; }
    } else if (proj.fileOrder.some(x => chapterId(proj, x) === f.meta.id)) {
      f.meta.id = f.meta.id + '-masolat';
      targetFn = fn.replace(/\.md$/, '-masolat.md');
    }
    await copyImagesBetweenDocs(f.content, _copySource.folder, proj);
    const existed = !!proj.files[targetFn];
    f.dirty = true;
    proj.files[targetFn] = f;
    _editorStates.delete(targetFn);
    if (!existed) insertChapterAfter(proj, targetFn, null);
    await saveChapter(proj, targetFn);
    copied++;
  }
  await saveProjectConfig(proj);
  renderTree();
  schedulePreview();
  if (state.currentFile && selected.includes(state.currentFile)) {
    const fn = state.currentFile; state.currentFile = null; openFile(fn);
  }
  toast(`✓ ${copied} fejezet másolva${skipped ? ', ' + skipped + ' kihagyva' : ''}`);
}
