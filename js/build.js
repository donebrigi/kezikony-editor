// ── Build: a végleges, önálló HTML ───────────────────────────────────────────
async function buildAndDownload(optimize = false) {
  const proj = currentProj();
  if (!proj) { toast('Nincs megnyitott dokumentum!', 'err'); return; }

  await saveAllDirty({ quiet: true });

  toast('⚙ HTML összeállítása...', 'ok', 3000);
  let html = buildPreviewHtml(proj, buildAllSectionsHtml(proj), true);
  // A képek beágyazása (data: URI), hogy a letöltött HTML önmagában is teljes legyen.
  html = await resolveImagesBuild(html, proj);
  const outputName = proj.config.output || (proj.docId + '.html');

  if (optimize) {
    toast('Képek optimalizálása...', 'ok', 4000);
    html = await optimizeHtmlImages(html);
  }

  // A felhőbe is felkerül: erre épül a megosztható link és a Projekt nézet ⬇ HTML gombja.
  const ok = await cloudSaveOutput(proj, PUBLISH_HTML_NAME, html);
  downloadText(html, outputName, 'text/html');
  toast(ok ? `✓ HTML letöltve és publikálva (${Math.round(html.length / 1024)} KB)` : '⚠ HTML letöltve, de a felhőbe publikálás nem sikerült', ok ? 'ok' : 'err', 3500);
}

// ── Nyomtatás / PDF ──────────────────────────────────────────────────────────
// A teljes kézikönyvet egy új lapon nyitja meg, és elindítja a nyomtatást — itt a
// "Mentés PDF-ként" célt választva PDF készíthető.
async function printDocument() {
  const proj = currentProj();
  if (!proj) return;
  const win = window.open('', '_blank');
  if (!win) { toast('A böngésző blokkolta az új lapot — engedélyezd a felugró ablakokat.', 'err', 5000); return; }
  win.document.write('<p style="font-family:sans-serif;padding:40px">Nyomtatási nézet előkészítése…</p>');
  await saveAllDirty({ quiet: true });
  let html = buildPreviewHtml(proj, buildAllSectionsHtml(proj), true);
  html = await resolveImagesBuild(html, proj);
  win.document.open(); win.document.write(html); win.document.close();
  // Megvárjuk a képeket, a betűtípusokat és az ikonokat, mielőtt a nyomtatás elindul.
  const imgs = [...win.document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }));
  await Promise.race([Promise.all(imgs), new Promise(r => setTimeout(r, 4000))]);
  try { await Promise.race([win.document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); } catch(e) {}
  // Ebben a nyomtatási lapon a lenyíló elemek eleve nyitva vannak (a letöltött HTML-ben ezt
  // a beágyazott PRINT_JS intézi nyomtatáskor).
  win.document.querySelectorAll('details').forEach(d => { d.open = true; });
  setTimeout(() => { win.focus(); win.print(); }, 700);
}

// ── Markdown + képek egy ZIP-ben (mentés / archiválás / visszaimportálás) ──────
// Szerkezete megegyezik a Dokumentum felhőbeli mappájával, így a kicsomagolt mappa
// a Projekt nézet "📤 Importálás" gombjával újra betölthető.
async function downloadMarkdownZip() {
  const proj = currentProj();
  if (!proj) return;
  await saveAllDirty({ quiet: true });
  toast('📦 ZIP összeállítása...', 'ok', 4000);
  const zip = new CM.JSZip();
  const root = zip.folder(slugify(projectDisplayTitle(proj)) || proj.docId);
  const imagePaths = new Set();
  for (const fn of proj.fileOrder) {
    const f = proj.files[fn];
    rebuildRaw(f);
    root.file('sections/' + fn, f.raw);
    (f.raw.match(IMAGE_REF_RE) || []).forEach(p => imagePaths.add(p));
  }
  for (const p of imagePaths) {
    const blob = await getImageBlob(proj, p);
    if (blob) root.file(p, blob);
  }
  root.file('config.json', serializeConfig(proj));
  root.file('style.css', getWorkingCss(proj)); // tájékoztató: a projekt témájából összeállított CSS
  if (proj.logo) root.file('logo.txt', proj.logo);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (slugify(projectDisplayTitle(proj)) || proj.docId) + '-markdown.zip';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast(`✓ ZIP letöltve (${proj.fileOrder.length} fejezet, ${imagePaths.size} kép)`);
}

// ── HTML kép optimalizáló (Canvas API alapú, WebP konverzió) ─────────────────
async function optimizeHtmlImages(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img[src^="data:image/"]');
  const MAX_WIDTH = 1440;
  const QUALITY = 0.85;

  for (const img of imgs) {
    try {
      const src = img.src;
      const mime = src.split(';')[0].split(':')[1];
      if (mime === 'image/webp') continue; // már optimált

      const origSize = src.length;

      // Load image
      const bitmap = await createImageBitmap(await fetch(src).then(r => r.blob()));

      // Calculate new dimensions
      let w = bitmap.width, h = bitmap.height;
      if (w > MAX_WIDTH) {
        h = Math.round(h * MAX_WIDTH / w);
        w = MAX_WIDTH;
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, w, h);

      // Convert to WebP
      const newSrc = canvas.toDataURL('image/webp', QUALITY);

      // Only use if smaller
      if (newSrc.length < origSize) {
        img.src = newSrc;
      }
    } catch(e) {
      console.warn('Image optimize failed:', e);
    }
  }

  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}
