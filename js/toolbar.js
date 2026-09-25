// ── Formatting toolbar ───────────────────────────────────────────────────────
function getEditor() { return document.getElementById('editor'); }

function fmtWrap(before, after) {
  const ta = getEditor();
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end);
  const replacement = before + (sel || 'szöveg') + after;
  ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
  // Select the inner text
  const newStart = start + before.length;
  const newEnd = newStart + (sel || 'szöveg').length;
  ta.selectionStart = newStart;
  ta.selectionEnd = newEnd;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

function fmtLine(prefix) {
  const ta = getEditor();
  const start = ta.selectionStart;
  // Find line start
  const before = ta.value.slice(0, start);
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineContent = ta.value.slice(lineStart);
  const lineEnd = lineStart + (lineContent.indexOf('\n') === -1 ? lineContent.length : lineContent.indexOf('\n'));
  const line = ta.value.slice(lineStart, lineEnd);

  // Toggle: if already has prefix, remove it; else add
  let newLine;
  if (line.startsWith(prefix)) {
    newLine = line.slice(prefix.length);
  } else {
    // Remove other heading prefixes first
    const cleaned = line.replace(/^#+\s|^>\s/, '');
    newLine = prefix + cleaned;
  }

  ta.value = ta.value.slice(0, lineStart) + newLine + ta.value.slice(lineEnd);
  ta.selectionStart = ta.selectionEnd = lineStart + newLine.length;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

function fmtList(prefix) {
  const ta = getEditor();
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);

  if (selected.includes('\n')) {
    // Multi-line: prefix each line
    const lines = selected.split('\n');
    let counter = 1;
    const newLines = lines.map(l => {
      if (!l.trim()) return l;
      if (prefix === '1. ') return (counter++) + '. ' + l.replace(/^\d+\.\s|^-\s/, '');
      return prefix + l.replace(/^\d+\.\s|^-\s/, '');
    });
    const replacement = newLines.join('\n');
    ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
    ta.selectionStart = start;
    ta.selectionEnd = start + replacement.length;
  } else {
    // Single line
    fmtLine(prefix);
    return;
  }
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

function fmtLink() {
  const ta = getEditor();
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end);
  const url = prompt('URL:', 'https://');
  if (!url) return;
  const text = sel || prompt('Link szövege:', 'link') || 'link';
  const replacement = `[${text}](${url})`;
  ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
  ta.selectionStart = start;
  ta.selectionEnd = start + replacement.length;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

function fmtCodeBlock() {
  const ta = getEditor();
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || 'kód ide';
  const q = String.fromCharCode(96);
  const fence = q + q + q;
  const replacement = fence + '\n' + sel + '\n' + fence;
  ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
  ta.selectionStart = start + 4;
  ta.selectionEnd = start + 4 + sel.length;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

// Lenyíló elemek (accordion / harmonika) beszúrása egy induló sablonnal.
// Szintaxis: <!-- accordion --> ... +++ Cím ... <!-- /accordion --> — lásd mdToHtml.
function fmtAccordion() {
  const ta = getEditor();
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const after = ta.value.slice(ta.selectionEnd);
  const insertAt = before.endsWith('\n') || before === '' ? before : before + '\n';
  const block =
`<!-- accordion -->
+++ Első kérdés vagy cím
Ide jön az első elem szövege.

+++ Második kérdés vagy cím
Ide jön a második elem szövege.
<!-- /accordion -->
`;
  ta.value = insertAt + block + after;
  ta.selectionStart = ta.selectionEnd = insertAt.length + block.length;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
  updateLineNums();
  toast('✓ Harmonika beszúrva — a "+++ " sorok a lenyíló elemek címei');
}

// Szerkesztői jegyzet beszúrása. A <!-- jegyzet --> ... <!-- /jegyzet --> közötti szöveg
// (vagy az egysoros <!-- jegyzet: ... --> forma) az élő előnézetben egy elkülönülő
// buborékban látszik, de a végleges buildelt/exportált oldalra sosem kerül bele — lásd mdToHtml.
function fmtNote() {
  const ta = getEditor();
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const after = ta.value.slice(ta.selectionEnd);
  const insertAt = before.endsWith('\n') || before === '' ? before : before + '\n';
  const block =
`<!-- jegyzet -->
Ide írhatsz szerkesztői jegyzetet — ez nem kerül bele a végleges oldalba.
<!-- /jegyzet -->
`;
  ta.value = insertAt + block + after;
  ta.selectionStart = ta.selectionEnd = insertAt.length + block.length;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
  updateLineNums();
  toast('✓ Jegyzet beszúrva — az előnézetben látszik, a végleges oldalon nem');
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

async function openIconPicker() {
  document.getElementById('icon-picker-modal-backdrop').classList.add('open');
  const search = document.getElementById('icon-picker-search');
  search.value = '';
  search.focus();
  const hint = document.getElementById('icon-picker-hint');
  if (!state.lucideIcons) {
    hint.textContent = 'Ikonlista betöltése...';
    document.getElementById('icon-picker-grid').innerHTML = '';
    try {
      const res = await fetch(LUCIDE_TAGS_URL);
      const data = await res.json();
      state.lucideIcons = Object.keys(data).map(name => ({ name, tags: data[name] || [] }));
    } catch (e) {
      hint.textContent = 'Nem sikerült betölteni az ikonlistát — ellenőrizd az internetkapcsolatot.';
      state.lucideIcons = null;
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
  const ta = getEditor();
  const start = ta.selectionStart, end = ta.selectionEnd;
  const token = `:${name}:`;
  ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + token.length;
  ta.focus();
  ta.dispatchEvent(new Event('input'));
  closeIconPicker();
  toast(`✓ Ikon beszúrva: ${name}`);
}
