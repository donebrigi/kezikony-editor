// ── Dokumentum betöltése a felhőből + importálás ─────────────────────────────

// Hiányzó id/title pótlása a fájlnévből (régi, frontmatter nélküli fejezeteknél).
function ensureChapterMeta(fn, f) {
  const base = fn.replace(/^\d+_?/, '').replace(/\.md$/, '');
  if (!f.meta.id) f.meta.id = slugify(base) || base;
  if (!f.meta.title) {
    const h = (f.content.match(/^#\s+(.+)$/m) || [])[1];
    f.meta.title = h ? h.trim() : base;
  }
}

async function cloudLoadProject(folderId, topProjectId, docId) {
  if (hasUnsavedWork()) await saveAllDirty({ quiet: true });
  toast('☁️ Dokumentum betöltése...', 'ok', 2000);

  const project = {
    name: folderId, cloudFolder: folderId,
    topProjectId: topProjectId || null, docId: docId || folderId,
    config: {}, css: '', logo: '', files: {}, fileOrder: []
  };

  const data = await cloudFetchDocument(folderId);
  project.config = data.config;
  project.css = data.css || getDefaultCSS();
  project.logo = data.logo;
  for (const [fn, raw] of Object.entries(data.files)) {
    const f = makeFileEntry(raw);
    ensureChapterMeta(fn, f);
    project.files[fn] = f;
  }
  normalizeStructure(project);

  // Régi, base64-es képek kiszervezése (egyszeri, automatikus).
  await migrateEmbeddedImages(project);

  if (topProjectId) {
    state.currentTopProject = topProjectId;
    if (!state.currentTopProjectMeta || state.currentTopProjectMeta.id !== topProjectId) {
      state.currentTopProjectMeta = (state.homeProjects || []).find(p => p.id === topProjectId) || await cloudGetProjectMeta(topProjectId);
    }
  }

  // Egyszerre egy Dokumentum van nyitva — a korábbit kivesszük a memóriából.
  Object.keys(state.projects).forEach(k => { if (k !== folderId) delete state.projects[k]; });
  discardCssDraft();
  resetEditorStates();
  state.projects[folderId] = project;
  state.currentProject = folderId;
  state.currentFile = null;
  rememberLastDoc(project);

  enterEditorView();
  renderTree();
  if (project.fileOrder.length) openFile(project.fileOrder[0]);
  else showEmptyDocState();
  flashStatus('Dokumentum betöltve: ' + projectDisplayTitle(project), 'saved', 2500);
}

// A base64-ként beágyazott képeket külön fájlba teszi, és a fejezetet elmenti.
async function migrateEmbeddedImages(project) {
  const affected = project.fileOrder.filter(fn => countEmbeddedImages(project.files[fn].content) > 0);
  if (!affected.length) return;
  const total = affected.reduce((n, fn) => n + countEmbeddedImages(project.files[fn].content), 0);
  toast(`🖼 ${total} beágyazott kép átalakítása külön fájllá — ez csak egyszer történik meg...`, 'ok', 8000);
  let failed = 0;
  for (const fn of affected) {
    const f = project.files[fn];
    const newContent = await externalizeImagesInMarkdown(f.content, project);
    if (newContent === null) { failed++; continue; }
    f.content = newContent;
    if (!await saveChapter(project, fn)) failed++;
  }
  if (failed) toast('⚠ Néhány kép átalakítása nem sikerült — a fejezetben változatlanul megmaradtak.', 'err', 6000);
  else toast(`✓ ${total} kép átalakítva — a fejezetek szövege mostantól rövid és gyors.`, 'ok', 4000);
}

// ── Importálás felhő Dokumentumként ──────────────────────────────────────────
// source: { config, css, logo, files: { fn: raw }, images: { 'images/x.webp': Blob } }
async function importAsCloudDocument(projectId, docId, title, source) {
  const folder = projectId + '/' + docId;
  const target = { name: folder, cloudFolder: folder, config: Object.assign({}, source.config || {}), files: {}, fileOrder: [] };
  if (title) target.config.title = title;
  if (!target.config.title) target.config.title = docId;
  if (!target.config.subtitle) target.config.subtitle = target.config.title;
  target.config.lang = target.config.lang || 'hu';
  target.config.output = docId + '.html';

  // 1. képek a mappából (ZIP-ből kicsomagolt / korábban letöltött "images" mappa)
  for (const [path, blob] of Object.entries(source.images || {})) {
    await cloudUpload(folder + '/' + path, blob, blob.type || guessContentType(path));
  }
  // 2. fejezetek — a beágyazott base64 képek kiszervezésével
  for (const [fn, raw] of Object.entries(source.files || {})) {
    const f = makeFileEntry(raw);
    ensureChapterMeta(fn, f);
    const content = await externalizeImagesInMarkdown(f.content, target);
    if (content !== null) f.content = content;
    target.files[fn] = f;
    rebuildRaw(f);
    if (!await cloudUpload(folder + '/sections/' + fn, f.raw, 'text/markdown')) return false;
  }
  normalizeStructure(target);
  if (!await cloudUpload(folder + '/config.json', serializeConfig(target), 'application/json')) return false;
  await cloudUpload(folder + '/style.css', source.css || getDefaultCSS(), 'text/css');
  if (source.logo) await cloudUpload(folder + '/logo.txt', source.logo, 'text/plain');
  return true;
}

// Egy kiválasztott mappa (webkitdirectory input) beolvasása import-forrássá.
// Elfogadja a régi projektmappát és a "📦 Markdown + képek (ZIP)" kicsomagolt tartalmát is.
async function readFolderSource(fileList) {
  const src = { config: {}, css: '', logo: '', files: {}, images: {} };
  for (const file of Array.from(fileList)) {
    const parts = file.webkitRelativePath.split('/');
    const fname = parts[parts.length - 1];
    const parent = parts.length >= 2 ? parts[parts.length - 2] : '';
    const isRoot = parts.length === 2;
    if (isRoot && fname === 'config.json') {
      try { src.config = JSON.parse(await file.text()); } catch(e) {}
    } else if (isRoot && fname === 'style.css') {
      src.css = await file.text();
    } else if (isRoot && fname === 'logo.txt') {
      src.logo = (await file.text()).trim();
    } else if (parent === 'sections' && isChapterFile(fname)) {
      src.files[fname] = await file.text();
    } else if (parent === 'images' && /\.(webp|png|jpe?g|gif|svg)$/i.test(fname)) {
      src.images['images/' + fname] = file;
    }
  }
  return src;
}
