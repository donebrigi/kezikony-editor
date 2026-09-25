// ── Szerkesztő (CodeMirror 6) ────────────────────────────────────────────────
//
// A korábbi sima <textarea> helyett CodeMirror szerkesztő:
//   • a frontmatter (id/title) nem látszik — a cím a szerkesztő fölötti mezőben állítható
//   • "/" a sor elején (vagy szóköz után) → beszúró menü (címsor, harmonika, kép, ikon, ...)
//   • ":ho" → ikon-javaslatok a Lucide készletből
//   • a képhivatkozások helyén kis előnézeti címke látszik a hosszú útvonal helyett
//   • a saját jelölések (harmonika, jegyzet, ==kiemelés==, :ikon:) színezve látszanak
//   • fejezetenként külön visszavonás-előzmény (Ctrl+Z)
//
// A CodeMirror a vendor/codemirror.bundle.js-ből jön (window.CM), build lépés nélkül.

let editorView = null;
const _editorStates = new Map(); // fn → EditorState (a fejezetváltáskor megőrzött állapot)

function resetEditorStates() { _editorStates.clear(); }

// ── Saját jelölések kiemelése ────────────────────────────────────────────────
function buildMarkerDecorations(view) {
  const D = CM.Decoration;
  const decos = [];
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const t = line.text.trim();
      if (/^<!--\s*\/?(accordion|shot-stack)\s*-->$/.test(t)) decos.push(D.line({ class: 'cm-kk-block' }).range(line.from));
      else if (/^<!--\s*\/?jegyzet/.test(t)) decos.push(D.line({ class: 'cm-kk-note' }).range(line.from));
      else if (t.startsWith('+++ ')) decos.push(D.line({ class: 'cm-kk-acc' }).range(line.from));
      else if (/^#{1,4}\s/.test(t)) decos.push(D.line({ class: 'cm-kk-h cm-kk-h' + t.match(/^#+/)[0].length }).range(line.from));
      else if (t.startsWith('> ')) decos.push(D.line({ class: 'cm-kk-callout' }).range(line.from));
      if (line.length < 5000) {
        for (const m of line.text.matchAll(/==(.+?)==/g)) decos.push(D.mark({ class: 'cm-kk-hl' }).range(line.from + m.index, line.from + m.index + m[0].length));
        for (const m of line.text.matchAll(/:([a-z][a-z0-9-]*):/g)) decos.push(D.mark({ class: 'cm-kk-icon' }).range(line.from + m.index, line.from + m.index + m[0].length));
      }
      pos = line.to + 1;
    }
  }
  return D.set(decos, true);
}

// ── Kép-címke: a ](images/…) rész helyén egy kis bélyegkép ────────────────────
class ImageChipWidget extends CM.WidgetType {
  constructor(src) { super(); this.src = src; }
  eq(other) { return other.src === this.src; }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-kk-img';
    const img = document.createElement('img');
    const label = document.createElement('span');
    const proj = currentProj();
    if (this.src.startsWith('feltoltes-')) {
      label.textContent = '⏳ feltöltés…';
    } else if (this.src.startsWith('data:')) {
      img.src = this.src;
      label.textContent = 'beágyazott kép';
    } else if (isImageRef(this.src) && proj) {
      const url = getImageUrl(proj, this.src, () => { const u = getImageUrl(proj, this.src); if (u) img.src = u; });
      if (url) img.src = url;
      label.textContent = '🖼 kép';
    } else {
      img.src = this.src;
      label.textContent = this.src.length > 30 ? this.src.slice(0, 28) + '…' : this.src;
    }
    wrap.title = this.src.startsWith('data:') ? 'Beágyazott kép' : this.src;
    wrap.appendChild(img);
    wrap.appendChild(label);
    return wrap;
  }
  ignoreEvent() { return false; }
}

function buildImageDecorations(view) {
  const decos = [];
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      for (const m of line.text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
        const urlStart = line.from + m.index + 2 + m[1].length + 1; // a "(" pozíciója
        const urlEnd = line.from + m.index + m[0].length;
        decos.push(CM.Decoration.replace({ widget: new ImageChipWidget(m[2]) }).range(urlStart, urlEnd));
      }
      pos = line.to + 1;
    }
  }
  return CM.Decoration.set(decos, true);
}

function decorationPlugin(builder) {
  return CM.ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = builder(view); }
    update(u) { if (u.docChanged || u.viewportChanged) this.decorations = builder(u.view); }
  }, { decorations: v => v.decorations });
}

// ── "/" beszúró menü ─────────────────────────────────────────────────────────
const SLASH_ITEMS = [
  { label: 'Címsor 1', detail: '#', keys: 'cimsor h1 heading fejlec', run: () => fmtLine('# ') },
  { label: 'Címsor 2', detail: '##', keys: 'cimsor h2 heading alcim', run: () => fmtLine('## ') },
  { label: 'Címsor 3', detail: '###', keys: 'cimsor h3 heading', run: () => fmtLine('### ') },
  { label: 'Felsorolás', detail: '- elem', keys: 'lista felsorolas bullet', run: () => fmtList('- ') },
  { label: 'Számozott lista', detail: '1. elem', keys: 'lista szamozott lepesek', run: () => fmtList('1. ') },
  { label: 'Kiemelt doboz', detail: '> szöveg', keys: 'callout kiemelt doboz figyelem', run: () => fmtLine('> ') },
  { label: 'Harmonika', detail: 'lenyíló elemek', keys: 'harmonika accordion lenyilo gyik', run: () => fmtAccordion() },
  { label: 'Kép', detail: 'fájlból', keys: 'kep image screenshot', run: () => pickImageFile() },
  { label: 'Képsor', detail: 'képek egy keretben', keys: 'kepsor shot stack kepek', run: () => fmtShotStack() },
  { label: 'Ikon', detail: 'Lucide', keys: 'ikon icon', run: () => openIconPicker() },
  { label: 'Táblázat', detail: '| a | b |', keys: 'tablazat table', run: () => fmtTable() },
  { label: 'Link', detail: '[szöveg](url)', keys: 'link hivatkozas url', run: () => fmtLink() },
  { label: 'Kiemelt szöveg', detail: '==szöveg==', keys: 'kiemeles highlight', run: () => fmtWrap('==', '==') },
  { label: 'Jegyzet', detail: 'csak az előnézetben', keys: 'jegyzet note megjegyzes todo', run: () => fmtNote() },
  { label: 'Kódblokk', detail: '```', keys: 'kod code', run: () => fmtCodeBlock() },
];

const foldAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function slashCompletionSource(ctx) {
  const m = ctx.matchBefore(/(?:^|\s)\/[\p{L}\d ]{0,20}$/u);
  if (!m) return null;
  const slashPos = m.text.startsWith('/') ? m.from : m.from + 1;
  const query = foldAccents(ctx.state.sliceDoc(slashPos + 1, ctx.pos)).trim();
  const items = SLASH_ITEMS.filter(it => !query || foldAccents(it.label + ' ' + it.keys).includes(query));
  if (!items.length) return null;
  return {
    from: slashPos,
    filter: false,
    options: items.map((it, i) => ({
      label: it.label, detail: it.detail, type: 'keyword', boost: -i,
      apply: (view, _c, from, to) => {
        view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from } });
        it.run();
      }
    }))
  };
}

// ":ho" → ikonjavaslatok
function iconCompletionSource(ctx) {
  const m = ctx.matchBefore(/(?:^|[\s(])\:[a-z0-9-]{2,}$/);
  if (!m) return null;
  if (!state.lucideIcons) { ensureLucideIcons(); return null; }
  const from = m.text.startsWith(':') ? m.from : m.from + 1;
  const q = ctx.state.sliceDoc(from + 1, ctx.pos);
  const hits = state.lucideIcons.filter(ic => ic.name.startsWith(q)).concat(
    state.lucideIcons.filter(ic => !ic.name.startsWith(q) && (ic.name.includes(q) || ic.tags.some(t => t.includes(q))))
  ).slice(0, 40);
  if (!hits.length) return null;
  return {
    from, filter: false,
    options: hits.map(ic => ({ label: ':' + ic.name + ':', type: 'constant', apply: ':' + ic.name + ':' }))
  };
}

// ── Képek beillesztése (Ctrl+V / húzás / fájlválasztó) ───────────────────────
let _uploadSeq = 0;
async function insertImageFiles(files, pos) {
  const proj = currentProj();
  if (!proj || !editorView) return;
  const images = Array.from(files).filter(f => f && (!f.type || f.type.startsWith('image/')));
  if (!images.length) return;
  if (pos == null) pos = editorView.state.selection.main.head;

  // 1. Helyőrzők azonnal (a szöveg nem "ugrik", ha közben tovább gépelnek)
  const jobs = images.map(file => {
    const alt = (file.name ? file.name.replace(/\.[^.]+$/, '') : 'kép').replace(/[\[\]]/g, '') || 'kép';
    return { file, alt, token: 'feltoltes-' + Date.now() + '-' + (++_uploadSeq) };
  });
  const doc = editorView.state.doc;
  const before = pos > 0 ? doc.sliceString(pos - 1, pos) : '\n';
  const text = (before === '\n' ? '' : '\n') + jobs.map(j => `![${j.alt}](${j.token})\n*${j.alt}*\n`).join('\n');
  editorView.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } });
  editorView.focus();
  toast(images.length > 1 ? `🖼 ${images.length} kép feltöltése...` : '🖼 Kép feltöltése...', 'ok', 3000);

  // 2. Feltöltés, majd a helyőrző cseréje a végleges hivatkozásra
  for (const job of jobs) {
    const path = await uploadImage(proj, job.file);
    const cur = editorView.state.doc.toString();
    const idx = cur.indexOf('(' + job.token + ')');
    if (idx === -1) continue; // közben kitörölték
    if (path) {
      editorView.dispatch({ changes: { from: idx + 1, to: idx + 1 + job.token.length, insert: path } });
    } else {
      // Sikertelen: a helyőrző sorokat eltávolítjuk
      const lineStart = cur.lastIndexOf('\n', idx) + 1;
      const block = `![${job.alt}](${job.token})\n*${job.alt}*\n`;
      if (cur.slice(lineStart, lineStart + block.length) === block) editorView.dispatch({ changes: { from: lineStart, to: lineStart + block.length, insert: '' } });
      toast('⚠ A kép feltöltése nem sikerült', 'err', 4000);
    }
  }
}

function pickImageFile() {
  document.getElementById('img-file-input').click();
}
async function handleImgFileInput(input) {
  const files = Array.from(input.files || []);
  input.value = '';
  await insertImageFiles(files);
}

// ── Szerkesztő létrehozása ───────────────────────────────────────────────────
let _editorExt = null;
function editorExtensions() {
  if (_editorExt) return _editorExt;
  return _editorExt = [
    CM.lineNumbers(),
    CM.highlightActiveLine(),
    CM.highlightActiveLineGutter(),
    CM.history(),
    CM.drawSelection(),
    CM.dropCursor(),
    CM.EditorView.lineWrapping,
    CM.markdown(),
    CM.syntaxHighlighting(KK_HIGHLIGHT),
    CM.highlightSelectionMatches(),
    CM.autocompletion({ override: [slashCompletionSource, iconCompletionSource], icons: false, activateOnTyping: true }),
    CM.placeholder('Kezdj el írni… Tipp: írj be egy "/" jelet a sor elején a beszúrható elemekhez.'),
    CM.keymap.of([
      { key: 'Mod-s', preventDefault: true, run: () => { saveCurrentFile(); return true; } },
      { key: 'Mod-b', run: () => { fmtWrap('**', '**'); return true; } },
      { key: 'Mod-i', run: () => { fmtWrap('*', '*'); return true; } },
      { key: 'Mod-k', run: () => { fmtLink(); return true; } },
      ...CM.completionKeymap,
      ...CM.searchKeymap,
      ...CM.historyKeymap,
      ...CM.defaultKeymap,
      CM.indentWithTab,
    ]),
    decorationPlugin(buildMarkerDecorations),
    imageDecoPlugin,
    CM.EditorView.atomicRanges.of(view => { const p = view.plugin(imageDecoPlugin); return p ? p.decorations : CM.Decoration.none; }),
    CM.EditorView.domEventHandlers({
      paste(e) {
        const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
        const files = items.filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(f => f && (!f.type || f.type.startsWith('image/')));
        if (!files.length) return false;
        e.preventDefault();
        insertImageFiles(files);
        return true;
      },
      drop(e, view) {
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;
        e.preventDefault();
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        insertImageFiles(files, pos == null ? undefined : view.state.doc.lineAt(pos).to);
        return true;
      }
    }),
    CM.EditorView.updateListener.of(u => { if (u.docChanged) onEditorDocChanged(u.state.doc.toString()); }),
  ];
}

let imageDecoPlugin, KK_HIGHLIGHT;
function initEditor() {
  imageDecoPlugin = decorationPlugin(buildImageDecorations);
  const t = CM.tags;
  KK_HIGHLIGHT = CM.HighlightStyle.define([
    { tag: t.heading, color: 'var(--accent2)', fontWeight: '700' },
    { tag: t.strong, fontWeight: '700', color: 'var(--text)' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.link, color: 'var(--accent2)' },
    { tag: t.url, color: 'var(--text3)' },
    { tag: t.monospace, color: '#f9a8d4', fontFamily: 'var(--mono)' },
    { tag: t.quote, color: '#fcd34d' },
    { tag: t.list, color: 'var(--accent2)' },
    { tag: t.comment, color: 'var(--text3)' },
    { tag: t.processingInstruction, color: 'var(--text3)' },
    { tag: t.meta, color: 'var(--text3)' },
  ]);
  editorView = new CM.EditorView({
    parent: document.getElementById('editor-host'),
    state: CM.EditorState.create({ doc: '', extensions: editorExtensions() }),
  });
}

function stateForChapter(fn) {
  let st = _editorStates.get(fn);
  if (!st) {
    const f = currentProj().files[fn];
    st = CM.EditorState.create({ doc: f ? f.content : '', extensions: editorExtensions() });
    _editorStates.set(fn, st);
  }
  return st;
}

// A szerkesztő tartalmának kívülről történő cseréje (pl. AI beillesztés) — visszavonható.
function replaceChapterContent(fn, content) {
  const proj = currentProj();
  const f = proj && proj.files[fn];
  if (!f) return;
  if (fn === state.currentFile && editorView) {
    editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: content } });
  } else {
    f.content = content;
    f.dirty = true;
    _editorStates.delete(fn);
    scheduleAutosave();
  }
}

// ── Fejezet megnyitása ───────────────────────────────────────────────────────
function openFile(fn) {
  const proj = currentProj();
  if (!proj || !proj.files[fn]) return;
  if (state.currentFile && editorView && proj.files[state.currentFile]) _editorStates.set(state.currentFile, editorView.state);
  state.currentFile = fn;
  showEditorPane();
  editorView.setState(stateForChapter(fn));
  updateChapterHeader();
  renderTree();
  schedulePreview();
  editorView.focus();
}

function updateChapterHeader() {
  const f = currentFileEntry();
  document.getElementById('chapter-title').value = f ? (f.meta.title || '') : '';
  document.getElementById('chapter-id').textContent = f ? '#' + (f.meta.id || '') : '';
}

let _treeRefreshTimer = null;
function onEditorDocChanged(text) {
  const f = currentFileEntry();
  if (!f) return;
  f.content = text;
  if (!f.dirty) { f.dirty = true; renderTree(); }
  setStatus('Nem mentett változás', 'unsaved');
  schedulePreview();
  scheduleAutosave();
  // A fában a címsorok listája frissül (kicsit késleltetve, nem minden leütésre).
  clearTimeout(_treeRefreshTimer);
  _treeRefreshTimer = setTimeout(renderTree, 700);
}

// Cím mező: a fejezet címe (= menüpont neve). Ha a törzs első sora "# <régi cím>",
// azt is együtt frissítjük, hogy a két cím ne váljon szét.
function onChapterTitleInput(value) {
  const f = currentFileEntry();
  if (!f || !editorView) return;
  const oldTitle = f.meta.title || '';
  f.meta.title = value;
  const doc = editorView.state.doc;
  for (let i = 1; i <= Math.min(doc.lines, 5); i++) {
    const line = doc.line(i);
    if (!line.text.trim()) continue;
    if (line.text.trim() === '# ' + oldTitle) editorView.dispatch({ changes: { from: line.from, to: line.to, insert: '# ' + value } });
    break;
  }
  f.dirty = true;
  scheduleAutosave();
  clearTimeout(_treeRefreshTimer);
  _treeRefreshTimer = setTimeout(() => { renderTree(); schedulePreview(); }, 300);
}

// Az azonosító (horgony / menühivatkozás) módosítása — ritkán kell, ezért kérdez.
function editChapterId() {
  const proj = currentProj();
  const f = currentFileEntry();
  if (!f) return;
  const input = prompt('A fejezet azonosítója (a linkekben #azonosito formában szerepel).\nFigyelem: a más fejezetekből erre mutató régi linkek nem frissülnek automatikusan.', f.meta.id || '');
  if (input == null) return;
  const newId = slugify(input) || '';
  if (!newId || newId === f.meta.id) return;
  if (proj.fileOrder.some(fn => fn !== state.currentFile && chapterId(proj, fn) === newId)) { toast('Már van ilyen azonosítójú fejezet!', 'err'); return; }
  renameChapterIdInNav(proj, f.meta.id, newId);
  f.meta.id = newId;
  f.dirty = true;
  updateChapterHeader();
  scheduleAutosave();
  scheduleConfigSave();
  schedulePreview();
}

// Ugrás egy sorra (a fában egy címsorra kattintva) + az előnézetben a címsorhoz.
function jumpToLine(lineIndex, headingId) {
  if (!editorView) return;
  const line = editorView.state.doc.line(Math.min(lineIndex + 1, editorView.state.doc.lines));
  editorView.dispatch({ selection: { anchor: line.from }, effects: CM.EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 40 }) });
  editorView.focus();
  if (headingId) {
    try {
      const el = document.getElementById('preview-frame').contentDocument.getElementById(headingId);
      if (el) el.scrollIntoView({ block: 'start' });
    } catch(e) {}
  }
}

function showEditorPane() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('editor-pane').style.display = 'flex';
  if (!state.previewPoppedOut) document.getElementById('preview-pane').style.display = 'flex';
}

function showEmptyDocState() {
  document.getElementById('editor-pane').style.display = 'none';
  document.getElementById('preview-pane').style.display = 'none';
  const es = document.getElementById('empty-state');
  es.style.display = 'flex';
}

// ── Szerkesztő-segédek a formázó eszköztárnak (toolbar.js) ───────────────────
function edState() { return editorView.state; }
function edSelection() { const r = editorView.state.selection.main; return { from: r.from, to: r.to, text: editorView.state.sliceDoc(r.from, r.to) }; }
function edReplace(from, to, insert, selFrom, selTo) {
  editorView.dispatch({
    changes: { from, to, insert },
    selection: { anchor: selFrom != null ? selFrom : from + insert.length, head: selTo != null ? selTo : (selFrom != null ? selFrom : from + insert.length) },
    scrollIntoView: true
  });
  editorView.focus();
}
// Egy több soros blokk beszúrása saját sorba (előtte/utána sortöréssel).
function edInsertBlock(block, cursorOffsetInBlock) {
  const { from, to } = edSelection();
  const doc = editorView.state.doc;
  const needNlBefore = from > 0 && doc.sliceString(from - 1, from) !== '\n';
  const prefix = needNlBefore ? '\n' : '';
  const insert = prefix + block;
  const cursor = from + prefix.length + (cursorOffsetInBlock != null ? cursorOffsetInBlock : block.length);
  edReplace(from, to, insert, cursor);
}
