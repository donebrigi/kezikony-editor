// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const proj = state.projects[state.currentProject];
  if (!proj) return;
  const list = document.getElementById('file-list');
  list.innerHTML = '';
  proj.fileOrder.forEach(fn => {
    const f = proj.files[fn];
    const title = f.meta.title || fn.replace(/^\d+_?/, '').replace('.md','');
    const num = fn.match(/^(\d+)/)?.[1] || '';
    const div = document.createElement('div');
    div.className = 'file-item' + (fn === state.currentFile ? ' active' : '') + (f.dirty ? ' unsaved' : '');
    div.innerHTML = `<span class="num">${num}</span><span class="file-title">${escapeHtml(title)}</span><span class="file-actions"><button class="file-act-btn" title="Átnevezés" onclick="event.stopPropagation();startChapterRename('${fn}')">✏</button><button class="file-act-btn del" title="Törlés" onclick="event.stopPropagation();deleteChapter('${fn}')">🗑</button></span>`;
    div.onclick = () => openFile(fn);
    div.title = fn;
    setupDrag(div, fn);
    list.appendChild(div);
  });
}

// ── File open ─────────────────────────────────────────────────────────────────
function openFile(fn) {
  if (state.currentFile === fn) return;
  state.currentFile = fn;
  const proj = state.projects[state.currentProject];
  const f = proj.files[fn];
  const editor = document.getElementById('editor');
  editor.value = f.raw;
  document.getElementById('editor-filename').textContent = fn;
  renderSidebar();
  updateLineNums();
  schedulePreview();
  editor.focus();
}

// ── Sidebar drag & drop (fejezetek sorrendezése / másolása projektek között) ──
let dragSrcFile = null;
let dragSrcProject = null;

function setupDrag(div, fn) {
  div.draggable = true;
  div.addEventListener('dragstart', e => {
    dragSrcFile = fn;
    dragSrcProject = state.currentProject;
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', fn);
  });
  div.addEventListener('dragend', () => div.classList.remove('dragging'));
  div.addEventListener('dragover', e => {
    e.preventDefault();
    div.classList.add('drag-over-item');
  });
  div.addEventListener('dragleave', () => div.classList.remove('drag-over-item'));
  div.addEventListener('drop', async e => {
    e.preventDefault();
    e.stopPropagation(); // ne fusson le a dokumentum-szintű "mappa betöltése" drop-kezelő
    div.classList.remove('drag-over-item');
    if (!dragSrcFile || dragSrcFile === fn) return;

    const proj = state.projects[state.currentProject];
    if (dragSrcProject === state.currentProject) {
      // Sorrend csere
      const a = proj.fileOrder.indexOf(dragSrcFile);
      const b = proj.fileOrder.indexOf(fn);
      if (a > -1 && b > -1) {
        proj.fileOrder.splice(a, 1);
        proj.fileOrder.splice(b, 0, dragSrcFile);
        renderSidebar();
        await persistState();
        // Az új sorrendet a config.json-ba is kiírjuk, hogy betöltéskor (más gépen/böngészőben,
        // vagy a GitHub-ra feltöltött fájlokból) is a beállított sorrend legyen érvényben,
        // ne az ábécésorrend.
        await saveConfigToDisk();
      }
    } else {
      // Másik projektből másolás
      const srcProj = state.projects[dragSrcProject];
      if (!srcProj?.files[dragSrcFile]) return;
      const exists = !!proj.files[dragSrcFile];
      if (exists && !confirm(`"${dragSrcFile}" már létezik. Felülírja?`)) return;
      const srcF = srcProj.files[dragSrcFile];
      proj.files[dragSrcFile] = { ...srcF, dirty: true, fileHandle: null };
      if (!proj.fileOrder.includes(dragSrcFile)) {
        const idx = proj.fileOrder.indexOf(fn);
        proj.fileOrder.splice(idx, 0, dragSrcFile);
      }
      await saveChapterSilently(proj, dragSrcFile);
      renderSidebar();
      await persistState();
      await saveProjectConfig(proj, { showToast: false, interactive: false });
      toast('📋 Fejezet másolva: ' + dragSrcFile);
    }
    dragSrcFile = null; dragSrcProject = null;
  });
}

// ── Fejezet törlés és átnevezés ──────────────────────────────────────────────
async function deleteChapter(fn) {
  if (!state.currentProject) return;
  const proj = state.projects[state.currentProject];
  const title = proj.files[fn]?.meta?.title || fn;
  const msg = proj.cloudFolder
    ? `Törlöd a "${title}" fejezetet?\n(A felhőből is törlődik, minden kollégának.)`
    : `Törlöd a "${title}" fejezetet?\n(Csak a szerkesztőből törlődik, a lemezen megmarad.)`;
  if (!confirm(msg)) return;

  // HIBAJAVÍTÁS: felhő Dokumentumnál korábban a fájl a Storage-ban maradt, így a
  // következő megnyitáskor a törölt fejezet a lista végén "visszajött".
  if (proj.cloudFolder) {
    const { error } = await cloudBucket().remove([proj.cloudFolder + '/sections/' + fn]);
    if (error) { toast('⚠ A fejezet törlése a felhőből sikertelen', 'err', 4000); return; }
  }

  delete proj.files[fn];
  proj.fileOrder = proj.fileOrder.filter(f => f !== fn);
  deleteFileRecord(state.currentProject, fn);

  if (state.currentFile === fn) {
    state.currentFile = null;
    document.getElementById('editor').value = '';
    document.getElementById('editor-filename').textContent = '—';
    document.getElementById('preview-frame').srcdoc = '';
    if (proj.fileOrder.length > 0) openFile(proj.fileOrder[0]);
  }

  renderSidebar();
  await persistState();
  await saveProjectConfig(proj, { showToast: false, interactive: false });
  toast('🗑 Fejezet törölve: ' + title);
}

function startChapterRename(fn) {
  const proj = state.projects[state.currentProject];
  if (!proj) return;
  const f = proj.files[fn];
  const currentTitle = f.meta.title || fn;

  // Find the div
  const items = document.querySelectorAll('.file-item');
  let targetDiv = null;
  items.forEach(div => { if (div.title === fn) targetDiv = div; });
  if (!targetDiv) return;

  // Replace content with inline input
  targetDiv.innerHTML = `
    <span class="num">${fn.match(/^(\d+)/)?.[1] || ''}</span>
    <input class="file-rename-input" type="text" value="${escapeHtml(currentTitle)}" data-fn="${fn}" />
    <span class="file-actions" style="display:flex">
      <button class="file-act-btn" onclick="event.stopPropagation();confirmChapterRename('${fn}')">✓</button>
      <button class="file-act-btn" onclick="event.stopPropagation();renderSidebar()">✕</button>
    </span>`;

  const input = targetDiv.querySelector('.file-rename-input');
  input.focus(); input.select();
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmChapterRename(fn); }
    if (e.key === 'Escape') { e.stopPropagation(); renderSidebar(); }
  });
  input.addEventListener('click', e => e.stopPropagation());
  targetDiv.onclick = null;
}

async function confirmChapterRename(fn) {
  const proj = state.projects[state.currentProject];
  if (!proj) return;
  const input = document.querySelector('.file-rename-input[data-fn="' + fn + '"]');
  if (!input) return;
  const newTitle = input.value.trim();
  if (!newTitle) { renderSidebar(); return; }

  const f = proj.files[fn];
  f.meta.title = newTitle;

  // Update title in frontmatter
  const rawLines = f.raw.split('\n');
  const titleIdx = rawLines.findIndex(l => l.startsWith('title:'));
  if (titleIdx > -1) rawLines[titleIdx] = 'title: ' + newTitle;
  f.raw = rawLines.join('\n');
  f.dirty = true;
  if (titleIdx === -1) {
    // Nincs még title: sor — beszúrjuk (frontmatterrel vagy anélkül).
    f.raw = f.raw.startsWith('---')
      ? f.raw.replace(/^---\s*\n/, '---\ntitle: ' + newTitle + '\n')
      : '---\ntitle: ' + newTitle + '\n---\n\n' + f.raw;
  }
  Object.assign(f, parseFrontmatter(f.raw));

  // Felhőbe / mappába is kiírjuk (korábban helyi mappánál csak a böngészőben változott).
  await saveChapterSilently(proj, fn);

  renderSidebar();
  if (fn === state.currentFile) {
    document.getElementById('editor').value = f.raw;
    updateLineNums();
  }
  await persistState();
  toast('✓ Átnevezve: ' + newTitle);
}

// ── Új fejezet ───────────────────────────────────────────────────────────────
function openNewChapterModal() {
  if (!state.currentProject) { toast('Előbb tölts be egy projektet!', 'err'); return; }
  document.getElementById('nc-id').value = '';
  document.getElementById('nc-title').value = '';
  document.getElementById('nc-position').value = 'end';
  delete document.getElementById('nc-id').dataset.manualEdit; // új modalnál újra automatikus az id
  const backdrop = document.getElementById('new-chapter-backdrop');
  backdrop.style.display = 'flex';
  document.getElementById('nc-id').focus();
}

function closeNewChapterModal() {
  document.getElementById('new-chapter-backdrop').style.display = 'none';
}

document.getElementById('new-chapter-backdrop').addEventListener('click', function(e) {
  if (e.target === this) closeNewChapterModal();
});

// Auto-fill id from title
document.getElementById('nc-title').addEventListener('input', e => {
  const id = e.target.value.trim()
    .toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
    .replace(/ó/g,'o').replace(/ö/g,'o').replace(/ő/g,'o')
    .replace(/ú/g,'u').replace(/ü/g,'u').replace(/ű/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if (!document.getElementById('nc-id').dataset.manualEdit) {
    document.getElementById('nc-id').value = id;
  }
});

document.getElementById('nc-id').addEventListener('input', e => {
  e.target.dataset.manualEdit = e.target.value ? '1' : '';
});

async function createNewChapter() {
  const proj = state.projects[state.currentProject];
  if (!proj) return;

  const id = document.getElementById('nc-id').value.trim().replace(/\s+/g,'-');
  const title = document.getElementById('nc-title').value.trim();
  const position = document.getElementById('nc-position').value;

  if (!id) { toast('Add meg a fejezet azonosítóját!', 'err'); return; }
  if (!title) { toast('Add meg a fejezet nevét!', 'err'); return; }

  // Fájlnév generálás — sorrendszám alapján
  const nums = proj.fileOrder.map(fn => parseInt(fn) || 0);
  const maxNum = nums.length ? Math.max(...nums) : 0;
  const newNum = String(maxNum + 1).padStart(2, '0');
  const fn = `${newNum}_${id}.md`;

  if (proj.files[fn]) { toast('Már létezik ilyen fájl!', 'err'); return; }

  const raw = `---
id: ${id}
title: ${title}
---

# ${title}

`;
  proj.files[fn] = makeFileEntry(raw, { dirty: true });
  // Írható mappánál / felhőben a fájl azonnal létrejön — ettől kezdve gépelés közben
  // is automatikusan mentődik.
  await saveChapterSilently(proj, fn);

  // Pozicionálás
  if (position === 'end') {
    proj.fileOrder.push(fn);
  } else if (position === 'start') {
    proj.fileOrder.unshift(fn);
  } else if (position === 'after') {
    const idx = proj.fileOrder.indexOf(state.currentFile);
    if (idx > -1) proj.fileOrder.splice(idx + 1, 0, fn);
    else proj.fileOrder.push(fn);
  }

  await persistState();
  await saveProjectConfig(proj, { showToast: false }); // az új fejezettel megváltozott sorrendet is elmentjük a config.json-ba
  renderSidebar();
  openFile(fn);
  closeNewChapterModal();
  toast('✓ Fejezet létrehozva: ' + title);
}

// Enter gomb a modalban
document.getElementById('nc-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') createNewChapter();
});
