// ── Build: a végleges, önálló HTML ───────────────────────────────────────────
async function buildAndDownload(optimize = false) {
  const proj = currentProj();
  if (!proj) { toast('Nincs megnyitott dokumentum!', 'err'); return; }

  await saveAllDirty({ quiet: true });
  if (hasUnsavedCss()) toast('ℹ A Megjelenés fül nem mentett módosításai nem kerülnek bele.', '', 4000);

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
  root.file('style.css', proj.css || getDefaultCSS());
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
