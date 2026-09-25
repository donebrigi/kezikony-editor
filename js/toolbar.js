// ── Formázó eszköztár + "/" menü műveletei ──────────────────────────────────
// Mindegyik a CodeMirror szerkesztőn dolgozik (lásd editor.js edSelection/edReplace).

// Kijelölés körbevétele (pl. **félkövér**). Kijelölés nélkül egy "szöveg" helyőrzőt szúr be kijelölve.
function fmtWrap(before, after) {
  const { from, to, text } = edSelection();
  const inner = text || 'szöveg';
  edReplace(from, to, before + inner + after, from + before.length, from + before.length + inner.length);
}

// Sor-előtag ki/be kapcsolása (címsor, kiemelt doboz) az aktuális sor(ok)on.
function fmtLine(prefix) {
  const st = edState();
  const sel = st.selection.main;
  const first = st.doc.lineAt(sel.from), last = st.doc.lineAt(sel.to);
  const changes = [];
  for (let n = first.number; n <= last.number; n++) {
    const line = st.doc.line(n);
    if (line.text.startsWith(prefix)) changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
    else {
      const m = line.text.match(/^(#{1,4}\s|>\s)/); // más címsor/doboz előtag cseréje
      changes.push({ from: line.from, to: line.from + (m ? m[0].length : 0), insert: prefix });
    }
  }
  editorView.dispatch({ changes });
  editorView.focus();
}

// Lista: több kijelölt sornál mindegyik elé, egy sornál ki/be kapcsolás.
function fmtList(prefix) {
  const st = edState();
  const sel = st.selection.main;
  const first = st.doc.lineAt(sel.from), last = st.doc.lineAt(sel.to);
  if (first.number === last.number) {
    const line = first;
    const stripped = line.text.replace(/^(\d+\.\s|[-*]\s)/, '');
    const isSame = prefix === '1. ' ? /^\d+\.\s/.test(line.text) : /^[-*]\s/.test(line.text);
    const insert = isSame ? stripped : prefix + stripped;
    editorView.dispatch({ changes: { from: line.from, to: line.to, insert }, selection: { anchor: line.from + insert.length } });
    editorView.focus();
    return;
  }
  let counter = 1;
  const changes = [];
  for (let n = first.number; n <= last.number; n++) {
    const line = st.doc.line(n);
    if (!line.text.trim()) continue;
    const stripped = line.text.replace(/^(\d+\.\s|[-*]\s)/, '');
    changes.push({ from: line.from, to: line.to, insert: (prefix === '1. ' ? (counter++) + '. ' : prefix) + stripped });
  }
  editorView.dispatch({ changes });
  editorView.focus();
}

// Link: [szöveg]() beszúrása, a kurzor a zárójelben — ott a szerkesztő felajánlja a
// dokumentum fejezeteit/címsorait, vagy begépelhető egy webcím (https://…).
function fmtLink() {
  const { from, to, text } = edSelection();
  const label = text || 'link szövege';
  const insert = `[${label}]()`;
  if (text) {
    edReplace(from, to, insert, from + insert.length - 1);
    CM.startCompletion(editorView);
  } else {
    // Kijelölés nélkül a link szövege lesz kijelölve, hogy azonnal átírható legyen.
    edReplace(from, to, insert, from + 1, from + 1 + label.length);
  }
}

function fmtCodeBlock() {
  const { text } = edSelection();
  const body = text || 'kód ide';
  const fence = '```';
  edInsertBlock(fence + '\n' + body + '\n' + fence + '\n', fence.length + 1);
}

function fmtAccordion() {
  const block = '<!-- accordion -->\n+++ Első kérdés vagy cím\nIde jön az első elem szövege.\n\n+++ Második kérdés vagy cím\nIde jön a második elem szövege.\n<!-- /accordion -->\n';
  edInsertBlock(block, '<!-- accordion -->\n+++ '.length);
}

function fmtNote() {
  const block = '<!-- jegyzet -->\nIde írhatsz szerkesztői jegyzetet — ez nem kerül bele a végleges oldalba.\n<!-- /jegyzet -->\n';
  edInsertBlock(block, '<!-- jegyzet -->\n'.length);
}

function fmtTable() {
  const block = '| Oszlop 1 | Oszlop 2 |\n|---|---|\n| érték | érték |\n';
  edInsertBlock(block, 2);
}

// Képsor: a közé kerülő képek egy közös keretben, egymás alatt jelennek meg.
function fmtShotStack() {
  const block = '<!-- shot-stack -->\n\n<!-- /shot-stack -->\n';
  edInsertBlock(block, '<!-- shot-stack -->\n'.length);
  toast('Illeszd be a képeket a két jelölés közé (Ctrl+V vagy 🖼 Kép)', '', 3500);
}

// ── Lucide ikon beszúró ──────────────────────────────────────────────────────
// A https://lucide.dev ikonkészletét használjuk. Az ikonnevek + kereső címkék listáját
// (tags.json) egyszer töltjük be a unpkg CDN-ről és a böngésző memóriájában (state.lucideIcons)
// gyorsítótárazzuk, utána a keresés kliens oldalon, hálózat nélkül fut. A kiválasztott ikon
// a markdownban egy :ikon-nev: jelöléssel kerül be, amit a mdToHtml inline() függvénye alakít
// egy, a Lucide CDN-jéről betöltött <img>-re — ez az előnézetben ÉS a végleges buildelt
// oldalon is megjelenik, ezért a végleges oldal megnyitásához is kell majd internet.
const LUCIDE_TAGS_URL = 'https://unpkg.com/lucide-static@latest/tags.json';
const LUCIDE_ICON_URL = name => `https://unpkg.com/lucide-static@latest/icons/${name}.svg`;

// Az ikonlista egyszeri betöltése (az ikonválasztó és a ":ikon" javaslatok is ezt használják).
let _lucidePromise = null;
function ensureLucideIcons() {
  if (state.lucideIcons) return Promise.resolve(true);
  if (!_lucidePromise) {
    _lucidePromise = fetch(LUCIDE_TAGS_URL).then(r => r.json()).then(data => {
      state.lucideIcons = Object.keys(data).map(name => ({ name, tags: data[name] || [] }));
      return true;
    }).catch(() => { _lucidePromise = null; return false; });
  }
  return _lucidePromise;
}

async function openIconPicker() {
  document.getElementById('icon-picker-modal-backdrop').classList.add('open');
  const search = document.getElementById('icon-picker-search');
  search.value = '';
  search.focus();
  const hint = document.getElementById('icon-picker-hint');
  if (!state.lucideIcons) {
    hint.textContent = 'Ikonlista betöltése...';
    document.getElementById('icon-picker-grid').innerHTML = '';
    if (!await ensureLucideIcons()) {
      hint.textContent = 'Nem sikerült betölteni az ikonlistát — ellenőrizd az internetkapcsolatot.';
      return;
    }
  }
  renderIconPickerGrid('');
}

function closeIconPicker() {
  document.getElementById('icon-picker-modal-backdrop').classList.remove('open');
}

function filterIconPicker() {
  renderIconPickerGrid(document.getElementById('icon-picker-search').value.trim().toLowerCase());
}

function renderIconPickerGrid(query) {
  const grid = document.getElementById('icon-picker-grid');
  const hint = document.getElementById('icon-picker-hint');
  const icons = state.lucideIcons || [];
  const matches = (query
    ? icons.filter(ic => ic.name.includes(query) || ic.tags.some(t => t.includes(query)))
    : icons
  ).slice(0, 90);
  grid.innerHTML = '';
  matches.forEach(ic => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-opt';
    btn.style.cssText = 'width:100%;height:56px;flex-direction:column;gap:3px;font-size:9px;padding:4px;line-height:1.1';
    btn.title = ic.name;
    btn.innerHTML = `<img src="${LUCIDE_ICON_URL(ic.name)}" alt="" style="width:20px;height:20px" loading="lazy"/><span style="max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ic.name}</span>`;
    btn.onclick = () => insertIcon(ic.name);
    grid.appendChild(btn);
  });
  if (!icons.length) { hint.textContent = ''; }
  else if (!matches.length) { hint.textContent = 'Nincs találat.'; }
  else { hint.textContent = query ? `${matches.length}${matches.length === 90 ? '+' : ''} találat` : `${icons.length} ikon — kezdj el gépelni a kereséshez`; }
}

function insertIcon(name) {
  const { from, to } = edSelection();
  edReplace(from, to, `:${name}:`);
  closeIconPicker();
  toast(`✓ Ikon beszúrva: ${name}`);
}
