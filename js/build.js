// ── Build & Download ──────────────────────────────────────────────────────────
async function buildAndDownload(optimize = false) {
  const proj = currentProj();
  if (!proj) { toast('Nincs betöltve projekt!', 'err'); return; }

  // Mentetlen fejezetek mentése. HIBAJAVÍTÁS: korábban ehhez átállította a
  // state.currentFile-t minden mentetlen fejezetre, így a build után a szerkesztő
  // más fejezetet mutatott, mint amibe a gépelés ténylegesen íródott.
  // A mentés helye itt is ugyanaz, mint máshol (felhő / mappa / csak böngésző).
  const dirty = proj.fileOrder.filter(fn => proj.files[fn] && proj.files[fn].dirty);
  for (const fn of dirty) await saveChapterSilently(proj, fn);
  if (dirty.length) { await persistProject(proj); renderSidebar(); }

  // Ha a Megjelenés fülön van nem mentett piszkozat, a build a MENTETT CSS-t használja.
  if (hasUnsavedCss()) toast('ℹ A Megjelenés fül nem mentett módosításai nem kerülnek bele a buildbe.', '', 4000);

  let html = buildPreviewHtml(proj, buildAllSectionsHtml(proj), true);
  const outputName = proj.config.output || (proj.docId || proj.name) + '.html';

  if (optimize) {
    toast('Képek optimalizálása...', 'ok', 4000);
    html = await optimizeHtmlImages(html);
    toast(`✓ Optimalizálva — ${Math.round(html.length / 1024)} KB`, 'ok', 3000);
  }

  // 0. Felhő Dokumentum: a legenerált HTML a Storage-ba is felkerül (ez frissíti a
  // publikált oldalt, amire a megosztható link és a gyors ⬇ HTML gomb épül).
  if (proj.cloudFolder) {
    const ok1 = await cloudSaveOutput(proj, outputName, html);
    const ok2 = await cloudSaveOutput(proj, PUBLISH_HTML_NAME, html);
    if (ok1 && ok2) toast('✓ HTML elmentve a felhőbe: ' + outputName);
  }

  // 1–2. Közvetlen írás a projekt mappájába (ha van írási jog)
  if (await writeRootFile(proj, outputName, 'outputHandle', html)) {
    toast('✓ HTML elmentve: ' + outputName);
    return;
  }

  // 3. Mentés másként dialóg, 4. végső esetben sima letöltés
  const fh = await saveAsWithPicker(html, outputName, 'HTML dokumentum', 'text/html', '.html');
  if (fh === null) return;
  if (fh) { proj.outputHandle = fh; toast('✓ HTML mentve: ' + fh.name); return; }
  downloadText(html, outputName, 'text/html');
  toast('✓ HTML letöltve!');
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
