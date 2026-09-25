// ── Képszerkesztő: vágás, nyíl, keret, számozott jelölő, kitakarás; kép cseréje ──
//
// Megnyitás: a szerkesztőben a kép-címkére kattintva, vagy az előnézetben a képre
// duplán kattintva.
//
// Újraszerkeszthetőség: a szerkesztett kép mellé egy kis leíró fájl is mentődik
// (images/<hash>.edit.json: { src, crop, objects }). Így később az EREDETI képből
// indulva lehet a nyilakat/kereteket módosítani, nem a "ráégetett" változatból.

const IMGED = {
  proj: null, path: null, srcPath: null, base: null,
  crop: null, objects: [], history: [],
  tool: 'arrow', color: '#e11d48', size: 1,
  drag: null, // { x0, y0, x1, y1 } rajzolás közben
};
const IMGED_COLORS = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#111827', '#ffffff'];

function sidecarPath(path) { return path.replace(/\.[a-z0-9]+$/i, '.edit.json'); }

async function openImageEditor(path) {
  const proj = currentProj();
  if (!proj || !isImageRef(path)) {
    if (path && path.startsWith('data:')) toast('Ez egy régi, beágyazott kép — nyisd meg újra a dokumentumot, és automatikusan külön fájl lesz belőle.', 'err', 5000);
    return;
  }
  IMGED.proj = proj;
  IMGED.path = path;
  IMGED.srcPath = path;
  IMGED.crop = null;
  IMGED.objects = [];
  IMGED.history = [];
  IMGED.drag = null;
  document.getElementById('imged-backdrop').classList.add('open');
  document.getElementById('imged-status').textContent = 'Betöltés...';

  // Ha korábban már szerkesztették, az eredetiből + a rajzelemekből indulunk.
  const side = await cloudDownloadText(proj.cloudFolder + '/' + sidecarPath(path));
  if (side) {
    try {
      const d = JSON.parse(side);
      if (d.src && isImageRef(d.src)) {
        IMGED.srcPath = d.src;
        IMGED.crop = d.crop || null;
        IMGED.objects = Array.isArray(d.objects) ? d.objects : [];
      }
    } catch(e) {}
  }
  const blob = await getImageBlob(proj, IMGED.srcPath);
  if (!blob) { toast('A kép nem tölthető be', 'err'); closeImageEditor(); return; }
  IMGED.base = await createImageBitmap(blob);
  document.getElementById('imged-status').textContent = `${IMGED.base.width}×${IMGED.base.height}px`;
  renderImgedToolbar();
  imgedRender();
}

function closeImageEditor() {
  document.getElementById('imged-backdrop').classList.remove('open');
  IMGED.base = null;
}

// ── Eszköztár ──
function renderImgedToolbar() {
  document.querySelectorAll('#imged-tools [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === IMGED.tool));
  const colors = document.getElementById('imged-colors');
  colors.innerHTML = '';
  IMGED_COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.className = 'imged-swatch' + (c === IMGED.color ? ' active' : '');
    sw.style.background = c;
    sw.title = c;
    sw.onclick = () => { IMGED.color = c; renderImgedToolbar(); };
    colors.appendChild(sw);
  });
  document.querySelectorAll('#imged-sizes [data-size]').forEach(b => b.classList.toggle('active', +b.dataset.size === IMGED.size));
}
function setImgedTool(t) { IMGED.tool = t; renderImgedToolbar(); }
function setImgedSize(s) { IMGED.size = s; renderImgedToolbar(); }

function imgedPushHistory() {
  IMGED.history.push(JSON.stringify({ crop: IMGED.crop, objects: IMGED.objects }));
  if (IMGED.history.length > 60) IMGED.history.shift();
}
function imgedUndo() {
  const last = IMGED.history.pop();
  if (!last) return;
  const d = JSON.parse(last);
  IMGED.crop = d.crop; IMGED.objects = d.objects;
  imgedRender();
}
function imgedReset() {
  if (!IMGED.objects.length && !IMGED.crop) return;
  imgedPushHistory();
  IMGED.crop = null; IMGED.objects = [];
  imgedRender();
}

// ── Rajzolás ──
function imgedArea() {
  const b = IMGED.base;
  return IMGED.crop || { x: 0, y: 0, w: b.width, h: b.height };
}
function imgedLineWidth() {
  const a = imgedArea();
  return Math.max(2, Math.round(Math.max(a.w, a.h) / 320)) * IMGED.size;
}

function drawImgedObjects(ctx, objects) {
  const b = IMGED.base;
  // 1. kitakarás (a kép pixeleiből dolgozik, ezért legalul)
  objects.filter(o => o.type === 'pixel').forEach(o => {
    const r = normRect(o);
    if (r.w < 2 || r.h < 2) return;
    // Durva pixelezés: a kijelölt terület magasságában legfeljebb ~3 blokk, így a szöveg
    // (nevek, e-mail címek) biztosan olvashatatlan lesz.
    const block = Math.max(10, Math.round(Math.max(b.width, b.height) / 70), Math.round(r.h / 3));
    const sw = Math.max(1, Math.round(r.w / block)), sh = Math.max(1, Math.round(r.h / block));
    const tmp = document.createElement('canvas');
    tmp.width = sw; tmp.height = sh;
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(b, r.x, r.y, r.w, r.h, 0, 0, sw, sh);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, r.x, r.y, r.w, r.h);
    ctx.restore();
  });
  // 2. keretek, nyilak, jelölők
  objects.forEach(o => {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color;
    ctx.lineWidth = o.lw;
    ctx.lineCap = ctx.lineJoin = 'round';
    if (o.type === 'rect') {
      const r = normRect(o);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else if (o.type === 'arrow') {
      drawArrow(ctx, o.x1, o.y1, o.x2, o.y2, o.lw);
    } else if (o.type === 'marker') {
      const rad = o.lw * 5.5;
      ctx.beginPath(); ctx.arc(o.x, o.y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(1.5, o.lw * 0.6);
      ctx.strokeStyle = o.color === '#ffffff' ? '#111827' : '#ffffff';
      ctx.stroke();
      ctx.fillStyle = o.color === '#ffffff' || o.color === '#f59e0b' ? '#111827' : '#ffffff';
      ctx.font = `700 ${Math.round(rad * 1.15)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(o.n), o.x, o.y + rad * 0.05);
    }
    ctx.restore();
  });
}

function drawArrow(ctx, x1, y1, x2, y2, w) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(10, w * 4.5);
  const bx = x2 - Math.cos(ang) * head * 0.8, by = y2 - Math.sin(ang) * head * 0.8;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 7), y2 - head * Math.sin(ang - Math.PI / 7));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 7), y2 - head * Math.sin(ang + Math.PI / 7));
  ctx.closePath(); ctx.fill();
}

function normRect(o) {
  const x = Math.min(o.x, o.x + o.w), y = Math.min(o.y, o.y + o.h);
  return { x, y, w: Math.abs(o.w), h: Math.abs(o.h) };
}

// A teljes kép kirajzolása egy vászonra (a kivágott terület méretében).
function renderImgedTo(canvas, objects, crop) {
  const b = IMGED.base;
  const a = crop || { x: 0, y: 0, w: b.width, h: b.height };
  canvas.width = Math.round(a.w); canvas.height = Math.round(a.h);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(-a.x, -a.y);
  ctx.drawImage(b, 0, 0);
  drawImgedObjects(ctx, objects);
  ctx.restore();
  return ctx;
}

function imgedRender() {
  if (!IMGED.base) return;
  const canvas = document.getElementById('imged-canvas');
  const objects = IMGED.objects.slice();
  const d = IMGED.drag;
  if (d && IMGED.tool !== 'crop' && IMGED.tool !== 'marker') objects.push(dragToObject(d));
  const ctx = renderImgedTo(canvas, objects, IMGED.crop);
  // Vágás előnézet: a kijelölt terület kívüle elsötétítve
  if (d && IMGED.tool === 'crop') {
    const a = imgedArea();
    const r = normRect({ x: d.x0 - a.x, y: d.y0 - a.y, w: d.x1 - d.x0, h: d.y1 - d.y0 });
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, canvas.width, r.y);
    ctx.fillRect(0, r.y + r.h, canvas.width, canvas.height - r.y - r.h);
    ctx.fillRect(0, r.y, r.x, r.h);
    ctx.fillRect(r.x + r.w, r.y, canvas.width - r.x - r.w, r.h);
    ctx.setLineDash([8, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  document.getElementById('imged-undo').disabled = !IMGED.history.length;
}

function dragToObject(d) {
  const lw = imgedLineWidth();
  if (IMGED.tool === 'arrow') return { type: 'arrow', x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1, color: IMGED.color, lw };
  if (IMGED.tool === 'rect') return { type: 'rect', x: d.x0, y: d.y0, w: d.x1 - d.x0, h: d.y1 - d.y0, color: IMGED.color, lw };
  if (IMGED.tool === 'pixel') return { type: 'pixel', x: d.x0, y: d.y0, w: d.x1 - d.x0, h: d.y1 - d.y0 };
  return null;
}

// Egérpozíció → a (teljes) kép koordinátái
function imgedPoint(e) {
  const canvas = document.getElementById('imged-canvas');
  const r = canvas.getBoundingClientRect();
  const a = imgedArea();
  const x = (e.clientX - r.left) * canvas.width / r.width + a.x;
  const y = (e.clientY - r.top) * canvas.height / r.height + a.y;
  return { x: Math.max(a.x, Math.min(a.x + a.w, x)), y: Math.max(a.y, Math.min(a.y + a.h, y)) };
}

function initImageEditorEvents() {
  const canvas = document.getElementById('imged-canvas');
  canvas.addEventListener('pointerdown', e => {
    if (!IMGED.base) return;
    const p = imgedPoint(e);
    if (IMGED.tool === 'marker') {
      imgedPushHistory();
      const n = IMGED.objects.filter(o => o.type === 'marker').length + 1;
      IMGED.objects.push({ type: 'marker', x: p.x, y: p.y, n, color: IMGED.color, lw: imgedLineWidth() });
      imgedRender();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    IMGED.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  });
  canvas.addEventListener('pointermove', e => {
    if (!IMGED.drag) return;
    const p = imgedPoint(e);
    IMGED.drag.x1 = p.x; IMGED.drag.y1 = p.y;
    imgedRender();
  });
  canvas.addEventListener('pointerup', () => {
    const d = IMGED.drag;
    IMGED.drag = null;
    if (!d) return;
    const big = Math.abs(d.x1 - d.x0) > 6 || Math.abs(d.y1 - d.y0) > 6;
    if (!big) { imgedRender(); return; }
    imgedPushHistory();
    if (IMGED.tool === 'crop') {
      const r = normRect({ x: d.x0, y: d.y0, w: d.x1 - d.x0, h: d.y1 - d.y0 });
      IMGED.crop = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
      setImgedTool('arrow'); // vágás után jellemzően jelölés jön
    } else {
      IMGED.objects.push(dragToObject(d));
    }
    imgedRender();
  });
  // Ctrl+V a képszerkesztőben: a kép cseréje a vágólapon lévőre
  document.addEventListener('paste', e => {
    if (!document.getElementById('imged-backdrop').classList.contains('open')) return;
    const file = Array.from((e.clipboardData && e.clipboardData.items) || []).filter(it => it.kind === 'file').map(it => it.getAsFile()).find(f => f && f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    replaceImageWith(file);
  });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('imged-backdrop').classList.contains('open')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); imgedUndo(); }
    if (e.key === 'Escape') closeImageEditor();
  });
}

// ── Mentés: új képfájl + leíró, a hivatkozás cseréje a fejezetben ──
async function saveImageEditor() {
  const proj = IMGED.proj;
  if (!proj || !IMGED.base) return;
  document.getElementById('imged-status').textContent = 'Mentés...';
  let newPath;
  if (!IMGED.objects.length && !IMGED.crop) {
    newPath = IMGED.srcPath; // minden jelölés törölve → vissza az eredetihez
  } else {
    const canvas = document.createElement('canvas');
    renderImgedTo(canvas, IMGED.objects, IMGED.crop);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.92));
    newPath = await uploadImage(proj, blob, { compress: false });
    if (!newPath) { document.getElementById('imged-status').textContent = 'Mentés sikertelen'; return; }
    const side = JSON.stringify({ src: IMGED.srcPath, crop: IMGED.crop, objects: IMGED.objects });
    await cloudUpload(proj.cloudFolder + '/' + sidecarPath(newPath), side, 'application/json');
  }
  replaceImageRefInEditor(IMGED.path, newPath);
  closeImageEditor();
  toast('✓ Kép mentve');
}

// ── Kép cseréje (5): új képernyőkép ugyanoda, a képaláírás marad ──
function pickReplacementImage() { document.getElementById('imged-replace-input').click(); }
async function onReplacementPicked(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (file) await replaceImageWith(file);
}
async function replaceImageWith(file) {
  const proj = IMGED.proj;
  if (!proj) return;
  document.getElementById('imged-status').textContent = 'Új kép feltöltése...';
  const newPath = await uploadImage(proj, file);
  if (!newPath) { document.getElementById('imged-status').textContent = 'Feltöltés sikertelen'; return; }
  const oldPath = IMGED.path;
  replaceImageRefInEditor(oldPath, newPath);
  toast('✓ Kép lecserélve — most jelölheted is');
  // A szerkesztő az új képpel nyílik újra, hogy rögtön lehessen rá nyilat/keretet tenni.
  await openImageEditor(newPath);
}

// Az aktuális fejezetben a régi képhivatkozás(ok) cseréje (visszavonható Ctrl+Z-vel).
function replaceImageRefInEditor(oldPath, newPath) {
  if (!editorView || oldPath === newPath) { schedulePreview(); return; }
  const text = editorView.state.doc.toString();
  const needle = '(' + oldPath + ')';
  const changes = [];
  let i = text.indexOf(needle);
  while (i !== -1) {
    changes.push({ from: i + 1, to: i + 1 + oldPath.length, insert: newPath });
    i = text.indexOf(needle, i + needle.length);
  }
  if (changes.length) editorView.dispatch({ changes });
  schedulePreview();
}

// ── Nem használt képek takarítása (6) ─────────────────────────────────────────
async function cleanupUnusedImages() {
  const proj = currentProj();
  if (!proj) return;
  await saveAllDirty({ quiet: true });
  const entries = ((await cloudList(proj.cloudFolder + '/images', 1000)) || []).filter(isCloudFile);
  if (!entries.length) { toast('Ebben a dokumentumban nincsenek képfájlok.'); return; }

  // Hivatkozott képek: a fejezetekből + a szerkesztett képek eredetijei (a leíró fájlokból).
  const used = new Set();
  proj.fileOrder.forEach(fn => ((proj.files[fn].content || '').match(IMAGE_REF_RE) || []).forEach(p => used.add(p.slice(IMAGE_DIR.length))));
  const names = new Set(entries.map(e => e.name));
  for (const name of [...used]) {
    const side = name.replace(/\.[a-z0-9]+$/i, '.edit.json');
    if (!names.has(side)) continue;
    used.add(side);
    const txt = await cloudDownloadText(proj.cloudFolder + '/images/' + side);
    try { const d = JSON.parse(txt); if (d.src) used.add(d.src.slice(IMAGE_DIR.length)); } catch(e) {}
  }
  // A 10 percnél frissebb fájlokat biztonságból kihagyjuk (lehet, hogy épp most illesztette be valaki).
  const recent = e => {
    const t = Date.parse(e.created_at || e.updated_at || '');
    return t && Date.now() - t < 10 * 60 * 1000;
  };
  const unused = entries.filter(e => !used.has(e.name) && !recent(e));
  if (!unused.length) { toast('✓ Nincs nem használt kép — minden képfájlra hivatkozik valamelyik fejezet.'); return; }
  const size = unused.reduce((n, e) => n + ((e.metadata && e.metadata.size) || 0), 0);
  const sizeTxt = size ? ` (${(size / 1024 / 1024).toFixed(1)} MB)` : '';
  if (!confirm(`${unused.length} képfájlra${sizeTxt} egyik fejezet sem hivatkozik ebben a dokumentumban.\nTörlöd őket a felhőből? Ez nem vonható vissza.`)) return;
  const { error } = await cloudBucket().remove(unused.map(e => proj.cloudFolder + '/images/' + e.name));
  if (error) { toast('⚠ A törlés nem sikerült', 'err'); return; }
  toast(`🧹 ${unused.length} nem használt kép törölve${sizeTxt}`);
}
