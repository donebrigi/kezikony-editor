// ── Editor ────────────────────────────────────────────────────────────────────
function showEditorPane() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('editor-pane').style.display = 'flex';
  document.getElementById('preview-pane').style.display = 'flex';
}

document.getElementById('editor').addEventListener('input', () => {
  const proj = currentProj();
  const f = proj && state.currentFile ? proj.files[state.currentFile] : null;
  if (!f) return;
  const text = document.getElementById('editor').value;
  f.raw = text;
  const { meta, content } = parseFrontmatter(text);
  f.meta = meta; f.content = content;
  const wasDirty = f.dirty;
  f.dirty = true;
  setStatus('Nem mentett változás', 'unsaved');
  // A teljes sidebar-lista csak akkor kell újraépüljön, amikor a "nem mentett" (●) jelzés
  // ténylegesen megjelenik — nem minden egyes billentyűleütésnél.
  if (!wasDirty) renderSidebar();
  scheduleLineNumsUpdate();
  schedulePreview();
  scheduleAutosave(); // ~2 mp szünet után automatikus mentés (lásd persistence.js)
});

// Billentyűparancsok: Ctrl+S mentés, Ctrl+B/I/K formázás, Tab = 2 szóköz.
document.getElementById('editor').addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveCurrentFile(); }
    if (k === 'b') { e.preventDefault(); fmtWrap('**', '**'); }
    if (k === 'i') { e.preventDefault(); fmtWrap('*', '*'); }
    if (k === 'k') { e.preventDefault(); fmtLink(); }
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target;
    const s = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0,s) + '  ' + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = s + 2;
    ta.dispatchEvent(new Event('input')); // különben a módosítás nem számított mentetlennek
  }
});

function updateLineNums() {
  const ta = document.getElementById('editor');
  const ln = document.getElementById('line-nums');
  const mirror = document.getElementById('line-nums-mirror');
  const lines = ta.value.split('\n');

  // Mivel a szerkesztő most a sor szélességéhez töri a hosszú sorokat (lásd #editor
  // CSS-t), egy logikai sor a képernyőn több vizuális sorra is eshet — a sorszám-sáv
  // ilyenkor nem lehet egyszerűen "egy szám = egy fix magas sor". A láthatatlan
  // #line-nums-mirror-ba pontosan ugyanazzal a betűtípussal/szélességgel/sortöréssel
  // kirakjuk az összes sor szövegét, majd lemérjük, ténylegesen hány pixel magasra
  // törtek — ez alapján állítjuk be az egyes sorszám-cellák magasságát, hogy azok
  // pontosan illeszkedjenek a hozzájuk tartozó (esetleg több sorra tört) szöveghez.
  const cs = getComputedStyle(ta);
  const contentWidth = ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  mirror.style.width = Math.max(0, contentWidth) + 'px';
  mirror.innerHTML = lines.map(l => `<div>${escapeHtml(l)}</div>`).join('');

  const rowEls = mirror.children;
  const lineHeightPx = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.65);
  const html = [];
  for (let i = 0; i < lines.length; i++) {
    const h = rowEls[i] ? rowEls[i].offsetHeight : lineHeightPx;
    const rows = Math.max(1, Math.round(h / lineHeightPx));
    html.push(`<div style="height:${rows * lineHeightPx}px">${i + 1}</div>`);
  }
  ln.innerHTML = html.join('');
}

// Gépelés közben az overlay frissítését a következő animációs keretre toljuk,
// hogy a beírt karakter azonnal megjelenjen és ne a sorszám-lista újraépítése
// blokkolja a billentyűleütés visszajelzését.
let _lineNumsRAF = null;
function scheduleLineNumsUpdate() {
  if (_lineNumsRAF) return;
  _lineNumsRAF = requestAnimationFrame(() => {
    _lineNumsRAF = null;
    updateLineNums();
  });
}

document.getElementById('editor').addEventListener('scroll', () => {
  document.getElementById('line-nums').scrollTop = document.getElementById('editor').scrollTop;
});

// ── Kép beillesztés: Ctrl+V vágólapból ───────────────────────────────────────
document.getElementById('editor').addEventListener('paste', async (e) => {
  const items = Array.from(e.clipboardData?.items || []);

  // 1. Próbál image/* típust (Chrome, Firefox normál esetben)
  let imgItem = items.find(it => it.type.startsWith('image/'));

  // 2. Fallback: "Files" kind (Snipping Tool, fájlkezelőből másolt kép)
  if (!imgItem) {
    imgItem = items.find(it => it.kind === 'file');
  }

  if (!imgItem) return; // nem kép → normál paste megengedett

  const file = imgItem.getAsFile();
  if (!file) return;

  // Ha a fájl típusa nem kép, kihagyjuk
  if (file.type && !file.type.startsWith('image/')) return;

  e.preventDefault();
  await insertImageFromFile(file);
});

// ── Kép beillesztés: drag & drop a szerkesztőbe ───────────────────────────────
const editorWrap = document.getElementById('editor-wrap');
const imgOverlay = document.getElementById('img-drop-overlay');

editorWrap.addEventListener('dragover', e => {
  const hasImg = Array.from(e.dataTransfer.types).includes('Files');
  if (!hasImg) return;
  e.preventDefault();
  e.stopPropagation();
  imgOverlay.classList.add('active');
  editorWrap.classList.add('drag-active');
});

editorWrap.addEventListener('dragleave', e => {
  if (!editorWrap.contains(e.relatedTarget)) {
    imgOverlay.classList.remove('active');
    editorWrap.classList.remove('drag-active');
  }
});

editorWrap.addEventListener('drop', async e => {
  imgOverlay.classList.remove('active');
  editorWrap.classList.remove('drag-active');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  e.stopPropagation();
  for (const file of files) {
    await insertImageFromFile(file);
  }
});

// ── Kép tömörítés beillesztéskor (WebP, méret + minőség korlát) ──────────────
// Cél: a szerkesztőben és az IndexedDB-ben ne halmozódjon fel nyers, tömörítetlen
// base64 kép — ez a fő oka a sok kép után jelentkező szerkesztési lassulásnak.
const PASTE_IMG_MAX_WIDTH = 1440;
const PASTE_IMG_QUALITY = 0.85;

async function compressImageForInsert(file) {
  // Csak raszteres képeket tömörítünk; SVG-t és GIF-et (animáció miatt) érintetlenül hagyjuk.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  try {
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width, h = bitmap.height;
    if (w > PASTE_IMG_MAX_WIDTH) {
      h = Math.round(h * PASTE_IMG_MAX_WIDTH / w);
      w = PASTE_IMG_MAX_WIDTH;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const webpUrl = canvas.toDataURL('image/webp', PASTE_IMG_QUALITY);

    // Ha a böngésző nem támogatja a WebP kódolást, toDataURL csendben PNG-t ad vissza —
    // ilyenkor is jó, mert legalább a méretkorlátozás (resize) érvényesült.
    // Csak akkor használjuk, ha ténylegesen kisebb, mint az eredeti fájl.
    if (webpUrl.length < file.size * 1.37) { // base64 ≈ 1.37x a bináris méretnek
      return webpUrl;
    }
  } catch(e) {
    console.warn('Kép tömörítés sikertelen, eredeti fájl beillesztése:', e);
  }

  // Fallback: eredeti fájl base64-ként, ha a tömörítés nem sikerült vagy nem hozott javulást
  return await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// ── Közös kép beillesztő ─────────────────────────────────────────────────────
async function insertImageFromFile(file) {
  if (!state.currentFile) {
    toast('Előbb nyiss meg egy fejezetet!', 'err'); return;
  }

  // Kép → tömörített base64 (WebP, max 1440px, q85)
  const base64 = await compressImageForInsert(file);

  // Alt szöveg: fájlnév kiterjesztés nélkül, vagy "screenshot"
  const altText = file.name ? file.name.replace(/\.[^.]+$/, '') : 'screenshot';

  // Md szintaxis
  const mdImg = `\n![${altText}](${base64})\n*${altText}*\n`;

  // Beillesztés a kurzor pozíciójába
  const ta = document.getElementById('editor');
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const after = ta.value.slice(ta.selectionEnd);

  // Keressük a sor elejét — a kép saját sorba kerüljön
  const insertAt = before.endsWith('\n') || before === '' ? before : before + '\n';
  ta.value = insertAt + mdImg + after;
  ta.selectionStart = ta.selectionEnd = insertAt.length + mdImg.length;

  // Trigger input event hogy az állapot frissüljön
  ta.dispatchEvent(new Event('input'));
  updateLineNums();
  toast('✓ Kép beillesztve');
}

async function handleImgFileInput(input) {
  const file = input.files[0];
  if (!file) return;
  await insertImageFromFile(file);
  input.value = '';
}
