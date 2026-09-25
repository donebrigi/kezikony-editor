// ── Bal oldali fa: csoportok → fejezetek → címsorok ─────────────────────────
//
// Egy helyen van a fejezetlista, a menü (navigációs csoportok) és a sorrend:
//   • húzd a fejezeteket a csoportok között / sorrendben (a menü és az oldal sorrendje együtt változik)
//   • a csoportokat és alcsoportokat is lehet húzni, átnevezni, törölni
//   • az aktív fejezet alatt a címsorai látszanak — kattintásra oda ugrik a szerkesztő
//   • fejezetenként ⬇ .md letöltés (a képek beágyazva), 🗑 törlés

let _drag = null; // { type: 'chapter', fn } | { type: 'group', gi } | { type: 'subgroup', gi, si }

function groupKey(gi, si, tree) {
  const g = tree.groups[gi];
  return si == null ? 'g:' + g.name : 'g:' + g.name + '/s:' + g.subgroups[si].name;
}

function renderTree() {
  const host = document.getElementById('file-list');
  const proj = currentProj();
  if (!host) return;
  host.innerHTML = '';
  if (!proj) {
    host.innerHTML = '<div class="tree-empty">Nincs megnyitott dokumentum</div>';
    return;
  }
  const tree = getTree(proj);
  const hasGroups = tree.groups.length > 0;

  // Csoport nélküli fejezetek (a menü tetején, sima linkként)
  host.appendChild(renderContainer(proj, tree.ungrouped, { kind: 'ungrouped' },
    hasGroups ? 'Húzz ide fejezetet, ha csoport nélkül, a menü tetején legyen' : 'Még nincs fejezet — hozz létre egyet a + gombbal'));

  tree.groups.forEach((g, gi) => {
    const key = groupKey(gi, null, tree);
    const collapsed = !!state.collapsedGroups[key];
    const box = el('div', 'tree-group' + (collapsed ? ' collapsed' : ''));
    const head = el('div', 'tree-group-head');
    head.draggable = true;
    head.innerHTML = `<span class="tree-caret">${collapsed ? '▸' : '▾'}</span><span class="tree-group-name" title="Dupla kattintás: átnevezés">${escapeHtml(g.name)}</span>
      <span class="tree-actions">
        <button class="tree-btn" title="Alcsoport hozzáadása" data-act="addsub">＋</button>
        <button class="tree-btn" title="Átnevezés" data-act="rename">✏</button>
        <button class="tree-btn del" title="Csoport törlése (a fejezetei megmaradnak)" data-act="del">🗑</button>
      </span>`;
    head.querySelector('.tree-caret').onclick = e => { e.stopPropagation(); toggleCollapsed(key); };
    head.querySelector('.tree-group-name').ondblclick = () => promptRenameGroup(gi, null, g.name);
    head.querySelector('[data-act=addsub]').onclick = e => { e.stopPropagation(); addSubgroup(proj, gi); state.collapsedGroups[key] = false; afterTreeChange(); };
    head.querySelector('[data-act=rename]').onclick = e => { e.stopPropagation(); promptRenameGroup(gi, null, g.name); };
    head.querySelector('[data-act=del]').onclick = e => { e.stopPropagation(); if (confirm(`Törlöd a(z) "${g.name}" csoportot?\nA benne lévő fejezetek nem törlődnek, a lista tetejére kerülnek.`)) { removeGroup(proj, gi); afterTreeChange(); } };
    setupHeadDnD(head, { type: 'group', gi });
    box.appendChild(head);

    if (!collapsed) {
      const body = el('div', 'tree-group-body');
      body.appendChild(renderContainer(proj, g.sections, { kind: 'group', gi }, g.subgroups.length ? '' : 'Húzz ide fejezetet'));
      g.subgroups.forEach((sg, si) => {
        const skey = groupKey(gi, si, tree);
        const sCollapsed = !!state.collapsedGroups[skey];
        const sbox = el('div', 'tree-subgroup' + (sCollapsed ? ' collapsed' : ''));
        const shead = el('div', 'tree-group-head tree-sub-head');
        shead.draggable = true;
        shead.innerHTML = `<span class="tree-caret">${sCollapsed ? '▸' : '▾'}</span><span class="tree-group-name" title="Dupla kattintás: átnevezés">${escapeHtml(sg.name)}</span>
          <span class="tree-actions">
            <button class="tree-btn" title="Átnevezés" data-act="rename">✏</button>
            <button class="tree-btn del" title="Alcsoport törlése (a fejezetei a csoportban maradnak)" data-act="del">🗑</button>
          </span>`;
        shead.querySelector('.tree-caret').onclick = e => { e.stopPropagation(); toggleCollapsed(skey); };
        shead.querySelector('.tree-group-name').ondblclick = () => promptRenameGroup(gi, si, sg.name);
        shead.querySelector('[data-act=rename]').onclick = e => { e.stopPropagation(); promptRenameGroup(gi, si, sg.name); };
        shead.querySelector('[data-act=del]').onclick = e => { e.stopPropagation(); if (confirm(`Törlöd a(z) "${sg.name}" alcsoportot?\nA fejezetei a csoportban maradnak.`)) { removeSubgroup(proj, gi, si); afterTreeChange(); } };
        setupHeadDnD(shead, { type: 'subgroup', gi, si });
        sbox.appendChild(shead);
        if (!sCollapsed) sbox.appendChild(renderContainer(proj, sg.sections, { kind: 'subgroup', gi, si }, 'Húzz ide fejezetet'));
        body.appendChild(sbox);
      });
      box.appendChild(body);
    }
    host.appendChild(box);
  });
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function toggleCollapsed(key) {
  state.collapsedGroups[key] = !state.collapsedGroups[key];
  renderTree();
}

function renderContainer(proj, list, addr, emptyHint) {
  const c = el('div', 'tree-container');
  c.dataset.addr = JSON.stringify(addr);
  list.forEach((fn, index) => {
    c.appendChild(renderChapterItem(proj, fn, addr, index));
    if (fn === state.currentFile) c.appendChild(renderHeadings(proj, fn));
  });
  if (!list.length && emptyHint) {
    const hint = el('div', 'tree-drop-hint');
    hint.textContent = emptyHint;
    c.appendChild(hint);
  }
  // Húzás a konténer üres részére → a lista végére
  c.addEventListener('dragover', e => {
    if (!_drag || _drag.type !== 'chapter') return;
    if (e.target.closest('.tree-ch')) return;
    e.preventDefault();
    clearDropMarks();
    c.classList.add('drop-into');
  });
  c.addEventListener('dragleave', e => { if (!c.contains(e.relatedTarget)) c.classList.remove('drop-into'); });
  c.addEventListener('drop', e => {
    if (!_drag || _drag.type !== 'chapter' || e.target.closest('.tree-ch')) return;
    e.preventDefault(); e.stopPropagation();
    moveChapterInTree(proj, _drag.fn, addr, list.length);
    endDrag(); afterTreeChange();
  });
  return c;
}

function renderChapterItem(proj, fn, addr, index) {
  const f = proj.files[fn];
  const item = el('div', 'tree-ch' + (fn === state.currentFile ? ' active' : '') + (f.dirty ? ' unsaved' : ''));
  item.draggable = true;
  item.title = chapterTitle(proj, fn) + '  (#' + chapterId(proj, fn) + ')';
  const broken = brokenLinksIn(f.content);
  item.innerHTML = `<span class="tree-ch-title">${escapeHtml(chapterTitle(proj, fn))}</span>${broken.length ? `<span class="tree-warn" title="${broken.length} nem létező belső hivatkozás: ${escapeHtml(broken.map(b => '#' + b).join(', '))}">⚠</span>` : ''}
    <span class="tree-actions">
      <button class="tree-btn" title="Letöltés .md fájlként (a képek beágyazva)" data-act="dl">⬇</button>
      <button class="tree-btn del" title="Fejezet törlése" data-act="del">🗑</button>
    </span>`;
  item.onclick = () => { if (fn !== state.currentFile) openFile(fn); };
  item.querySelector('[data-act=dl]').onclick = e => { e.stopPropagation(); downloadChapterMarkdown(fn); };
  item.querySelector('[data-act=del]').onclick = e => { e.stopPropagation(); deleteChapter(fn); };

  item.addEventListener('dragstart', e => {
    _drag = { type: 'chapter', fn };
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fn);
  });
  item.addEventListener('dragend', endDrag);
  item.addEventListener('dragover', e => {
    if (!_drag || _drag.type !== 'chapter' || _drag.fn === fn) return;
    e.preventDefault(); e.stopPropagation();
    clearDropMarks();
    const r = item.getBoundingClientRect();
    item.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  item.addEventListener('drop', e => {
    if (!_drag || _drag.type !== 'chapter' || _drag.fn === fn) return;
    e.preventDefault(); e.stopPropagation();
    const after = item.classList.contains('drop-after');
    moveChapterInTree(proj, _drag.fn, addr, index + (after ? 1 : 0));
    endDrag(); afterTreeChange();
  });
  return item;
}

function renderHeadings(proj, fn) {
  const f = proj.files[fn];
  const box = el('div', 'tree-headings');
  let hs = extractHeadings(f.content);
  // Az első "# Cím" sor általában a fejezet címe — azt nem ismételjük meg.
  if (hs.length && hs[0].level === 1 && hs[0].text.trim() === (f.meta.title || '').trim()) hs = hs.slice(1);
  hs.forEach(h => {
    const a = el('div', 'tree-heading lvl' + h.level);
    a.textContent = h.text.replace(/[*=`]/g, '');
    a.title = 'Ugrás ide';
    a.onclick = e => { e.stopPropagation(); jumpToLine(h.line, h.id); };
    box.appendChild(a);
  });
  return box;
}

// Csoport / alcsoport fejlécek húzása és a fejezet csoportba ejtése.
function setupHeadDnD(head, who) {
  head.addEventListener('dragstart', e => {
    if (e.target !== head) return;
    _drag = Object.assign({}, who);
    head.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', who.type);
  });
  head.addEventListener('dragend', endDrag);
  head.addEventListener('dragover', e => {
    if (!_drag) return;
    const ok = _drag.type === 'chapter' ||
      (_drag.type === 'group' && who.type === 'group' && _drag.gi !== who.gi) ||
      (_drag.type === 'subgroup' && who.type === 'subgroup' && !(_drag.gi === who.gi && _drag.si === who.si));
    if (!ok) return;
    e.preventDefault(); e.stopPropagation();
    clearDropMarks();
    if (_drag.type === 'chapter') head.classList.add('drop-into');
    else {
      const r = head.getBoundingClientRect();
      head.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
    }
  });
  head.addEventListener('drop', e => {
    if (!_drag) return;
    const proj = currentProj();
    const after = head.classList.contains('drop-after');
    const into = head.classList.contains('drop-into');
    if (!after && !into && !head.classList.contains('drop-before')) return;
    e.preventDefault(); e.stopPropagation();
    if (_drag.type === 'chapter' && into) {
      const addr = who.type === 'group' ? { kind: 'group', gi: who.gi } : { kind: 'subgroup', gi: who.gi, si: who.si };
      moveChapterInTree(proj, _drag.fn, addr, Infinity);
      if (who.type === 'group') state.collapsedGroups[groupKey(who.gi, null, getTree(proj))] = false;
    } else if (_drag.type === 'group') {
      moveGroup(proj, _drag.gi, who.gi + (after ? 1 : 0));
    } else if (_drag.type === 'subgroup') {
      moveSubgroup(proj, _drag.gi, _drag.si, who.gi, who.si + (after ? 1 : 0));
    }
    endDrag(); afterTreeChange();
  });
}

function clearDropMarks() {
  document.querySelectorAll('#file-list .drop-before, #file-list .drop-after, #file-list .drop-into')
    .forEach(n => n.classList.remove('drop-before', 'drop-after', 'drop-into'));
}
function endDrag() {
  _drag = null;
  clearDropMarks();
  document.querySelectorAll('#file-list .dragging').forEach(n => n.classList.remove('dragging'));
}

// Szerkezetváltozás után: újrarajzolás, config mentés (összevonva), előnézet.
function afterTreeChange() {
  invalidateAnchors();
  renderTree();
  scheduleConfigSave();
  schedulePreview();
}

function promptRenameGroup(gi, si, current) {
  const name = prompt(si == null ? 'Csoport neve:' : 'Alcsoport neve:', current);
  if (!name || !name.trim() || name.trim() === current) return;
  renameGroup(currentProj(), gi, si, name.trim());
  afterTreeChange();
}

function addGroupFromSidebar() {
  const proj = currentProj();
  if (!proj) return;
  const name = prompt('Az új csoport neve (a menüben ez lesz a lenyíló cím):', 'Új csoport');
  if (!name || !name.trim()) return;
  addGroup(proj, name.trim());
  afterTreeChange();
}

// ── Fejezet műveletek ────────────────────────────────────────────────────────
async function deleteChapter(fn) {
  const proj = currentProj();
  if (!proj) return;
  const title = chapterTitle(proj, fn);
  if (!confirm(`Törlöd a "${title}" fejezetet?\n(A felhőből is törlődik, minden kollégának. Tipp: előtte a ⬇ gombbal letöltheted.)`)) return;
  const { error } = await cloudBucket().remove([proj.cloudFolder + '/sections/' + fn]);
  if (error) { toast('⚠ A fejezet törlése nem sikerült', 'err', 4000); return; }

  removeChapterFromTree(proj, fn);
  delete proj.files[fn];
  _editorStates.delete(fn);
  if (state.currentFile === fn) {
    state.currentFile = null;
    if (proj.fileOrder.length) openFile(proj.fileOrder[0]);
    else showEmptyDocState();
  }
  refreshEditorDecorations();
  renderTree();
  await saveProjectConfig(proj);
  schedulePreview();
  toast('🗑 Fejezet törölve: ' + title);
}

async function downloadChapterMarkdown(fn) {
  const proj = currentProj();
  const f = proj && proj.files[fn];
  if (!f) return;
  rebuildRaw(f);
  let md = f.raw;
  if (md.includes('(images/')) {
    toast('⬇ Képek beágyazása...', 'ok', 2000);
    md = await inlineImagesInMarkdown(md, proj);
  }
  downloadText(md, fn, 'text/markdown');
}

// Új fejezet ablak
function openNewChapterModal() {
  if (!currentProj()) return;
  document.getElementById('nc-id').value = '';
  document.getElementById('nc-title').value = '';
  delete document.getElementById('nc-id').dataset.manualEdit;
  document.getElementById('new-chapter-backdrop').style.display = 'flex';
  document.getElementById('nc-title').focus();
}
function closeNewChapterModal() {
  document.getElementById('new-chapter-backdrop').style.display = 'none';
}
document.getElementById('new-chapter-backdrop').addEventListener('click', function(e) { if (e.target === this) closeNewChapterModal(); });
document.getElementById('nc-title').addEventListener('input', e => {
  if (!document.getElementById('nc-id').dataset.manualEdit) document.getElementById('nc-id').value = slugify(e.target.value);
});
document.getElementById('nc-id').addEventListener('input', e => { e.target.dataset.manualEdit = e.target.value ? '1' : ''; });
document.getElementById('nc-title').addEventListener('keydown', e => { if (e.key === 'Enter') createNewChapter(); });

async function createNewChapter() {
  const proj = currentProj();
  if (!proj) return;
  const title = document.getElementById('nc-title').value.trim();
  const id = slugify(document.getElementById('nc-id').value.trim() || title);
  if (!title) { toast('Add meg a fejezet címét!', 'err'); return; }
  if (!id) { toast('Add meg a fejezet azonosítóját!', 'err'); return; }
  if (proj.fileOrder.some(fn => chapterId(proj, fn) === id)) { toast('Már van ilyen azonosítójú fejezet!', 'err'); return; }

  const nums = proj.fileOrder.map(fn => parseInt(fn, 10) || 0);
  const fn = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0') + '_' + id + '.md';
  if (proj.files[fn]) { toast('Már létezik ilyen fájl!', 'err'); return; }

  const f = { meta: { id, title }, content: '# ' + title + '\n\n', raw: '', dirty: true };
  proj.files[fn] = f;
  insertChapterAfter(proj, fn, state.currentFile);
  closeNewChapterModal();
  const ok = await saveChapter(proj, fn);
  await saveProjectConfig(proj);
  openFile(fn);
  schedulePreview();
  toast(ok ? '✓ Fejezet létrehozva: ' + title : '⚠ A fejezet létrejött, de a mentés nem sikerült — újrapróbálom', ok ? 'ok' : 'err');
  if (!ok) scheduleAutosave();
}
