// ── Preview ───────────────────────────────────────────────────────────────────
function schedulePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreview, 400);
}

function setPreviewMode(mode) {
  state.previewMode = mode;
  document.getElementById('mode-section').className = 'mode-btn' + (mode==='section' ? ' active' : '');
  document.getElementById('mode-full').className = 'mode-btn' + (mode==='full' ? ' active' : '');
  renderPreview();
}

function renderPreview() {
  if (!state.currentProject) return;
  const proj = state.projects[state.currentProject];
  const frame = document.getElementById('preview-frame');
  const info = document.getElementById('preview-info');

  // Gépelés közben ez a függvény ~400ms-enként újratölti az előnézetet (srcdoc/
  // document.write), ami egy vadonatúj dokumentumot hoz létre — ez alapból mindig a
  // lap tetejére ugorna vissza. Ehelyett elmentjük, hol állt a görgetés, és az új
  // tartalom betöltése után oda állunk vissza, hogy a felhasználó a begépelt szöveget
  // ott lássa, ahol éppen dolgozik. Fájlváltáskor (vagy nézetmód-váltáskor) viszont a
  // régi görgetési pozíció más tartalomra nem lenne értelmes, ezért ilyenkor a tetejéről
  // indulunk — ezt a renderKey (fájl + nézetmód) változása jelzi.
  const renderKey = state.previewMode + ':' + (state.previewMode === 'section' ? state.currentFile : state.currentProject);
  const sameAsLastRender = state.previewRenderKey === renderKey;
  state.previewRenderKey = renderKey;

  let scrollX = 0, scrollY = 0;
  if (sameAsLastRender) {
    try {
      if (frame.contentWindow) { scrollX = frame.contentWindow.scrollX || 0; scrollY = frame.contentWindow.scrollY || 0; }
    } catch(e) {}
  }
  let popScrollX = 0, popScrollY = 0;
  const popWin = (state.previewWindow && !state.previewWindow.closed) ? state.previewWindow : null;
  if (popWin && sameAsLastRender) {
    try { popScrollX = popWin.scrollX || 0; popScrollY = popWin.scrollY || 0; } catch(e) {}
  }

  let html;
  if (state.previewMode === 'section') {
    const f = state.currentFile ? proj.files[state.currentFile] : null;
    if (!f) return;
    const sectionHtml = mdToHtml(f.content, {showNotes:true});
    const secId = f.meta.id || 'section';
    html = buildPreviewHtml(proj, `<section class="section" id="${secId}">${sectionHtml}</section>`, false, getWorkingCss(proj));
    info.textContent = f.meta.title || state.currentFile;
  } else {
    html = buildPreviewHtml(proj, buildAllSectionsHtml(proj, { showNotes: true }), true, getWorkingCss(proj));
    info.textContent = 'Teljes dokumentum';
  }

  // A legenerált kézikönyv saját CSS-e "scroll-behavior:smooth"-t állít be (a
  // tartalomjegyzék-linkekhez) — ez a görgetési pozíció bármilyen programozott
  // beállítását animálva futtatná le, a scrollTop tulajdonság közvetlen írását is
  // beleértve, ami gépelés közben, minden újrarenderelésnél zökkenős csúszást
  // okozna. Ezért a visszaállításhoz ideiglenesen "auto"-ra kapcsoljuk, hogy azonnali
  // (nem animált) legyen — a felhasználó így nem is érzékeli, hogy újratöltődött.
  if (scrollX || scrollY) {
    frame.onload = () => {
      frame.onload = null;
      try {
        const d = frame.contentDocument;
        if (d && d.documentElement) {
          d.documentElement.style.scrollBehavior = 'auto';
          d.documentElement.scrollTop = scrollY; d.documentElement.scrollLeft = scrollX;
        }
        if (d && d.body) { d.body.scrollTop = scrollY; d.body.scrollLeft = scrollX; }
      } catch(e) {}
    };
  } else {
    frame.onload = null;
  }
  frame.srcdoc = html;

  // Ha van külön lapra kiugrasztott előnézet ablak (lásd togglePreviewPopout), azt is
  // frissítjük — ugyanaz a friss HTML kerül bele, mint a beépített előnézet iframe-jébe.
  if (popWin) {
    try {
      popWin.document.open();
      popWin.document.write(html);
      popWin.document.close();
      if (popScrollX || popScrollY) {
        // A document.write utáni layout nem mindig kész azonnal (pl. betűtípus-betöltés
        // miatt) — egy rAF-fal várunk egy festési ciklust, mielőtt visszaállítjuk a görgetést.
        requestAnimationFrame(() => {
          try {
            const d = popWin.document;
            if (d && d.documentElement) {
              d.documentElement.style.scrollBehavior = 'auto';
              d.documentElement.scrollTop = popScrollY; d.documentElement.scrollLeft = popScrollX;
            }
            if (d && d.body) { d.body.scrollTop = popScrollY; d.body.scrollLeft = popScrollX; }
          } catch(e) {}
        });
      }
    } catch(e) { console.warn('Külön lapos előnézet frissítése sikertelen:', e); }
  }
}

// ── Előnézet külön böngészőlapon ──────────────────────────────────────────────
// Cél: a szerkesztő felület nagyobb lehessen — az előnézet egy külön (mindig
// ugyanabba a névre nyíló, ezért újranyitáskor újrahasznosított) lapra kerül,
// a beépített előnézet panel pedig eltűnik, a szerkesztő kitölti a helyét.
function togglePreviewPopout() {
  const btn = document.getElementById('btn-preview-popout');
  const previewPane = document.getElementById('preview-pane');
  const resizeHandle = document.getElementById('resize-handle');
  const editorPane = document.getElementById('editor-pane');

  if (state.previewPoppedOut) {
    // Vissza a beépített nézetre — a külön lapot nyitva hagyjuk, ha a felhasználó még nézi.
    state.previewPoppedOut = false;
    previewPane.style.display = 'flex';
    resizeHandle.style.display = '';
    editorPane.style.flex = '';
    editorPane.style.width = '';
    editorPane.style.maxWidth = '';
    btn.textContent = '🡵 Előnézet külön lapon';
    scheduleLineNumsUpdate();
  } else {
    const win = window.open('', 'kk_preview_window');
    if (!win) {
      toast('A böngésző blokkolta a felugró ablakot — engedélyezd a popupokat ehhez az oldalhoz.', 'err', 5000);
      return;
    }
    state.previewWindow = win;
    state.previewPoppedOut = true;
    previewPane.style.display = 'none';
    resizeHandle.style.display = 'none';
    editorPane.style.flex = '1 1 auto';
    editorPane.style.width = 'auto';
    editorPane.style.maxWidth = 'none';
    btn.textContent = '🡴 Vissza a beépített előnézetre';
    renderPreview();
    scheduleLineNumsUpdate();
    win.focus();
  }
}

// Az összes fejezet HTML-je egymás után (az első a "hero" fejléc). Az előnézet és a
// build is ezt használja — korábban két, kissé eltérő másolatban létezett.
function buildAllSectionsHtml(proj, mdOpts) {
  return proj.fileOrder.map((fn, idx) => {
    const f = proj.files[fn];
    if (!f) return '';
    const id = f.meta.id || fn;
    const body = mdToHtml(f.content, mdOpts);
    return idx === 0
      ? `<header class="hero" id="${id}">${body}</header>`
      : `<section class="section" id="${id}">${body}</section>`;
  }).join('\n\n');
}

// cssOverride: az előnézet a Megjelenés fül (még nem mentett) piszkozatát mutatja,
// a build viszont mindig a mentett proj.css-t használja.
function buildPreviewHtml(proj, mainContent, full, cssOverride) {
  const projectCss = cssOverride || proj.css || getDefaultCSS();
  const css = projectCss + getSearchbarCSS();
  const title = proj.config.title || 'Előnézet';
  const subtitle = proj.config.subtitle || title;
  const description = proj.config.description || '';
  const logoTag = proj.logo ? `<img src="${proj.logo}" alt="${proj.config.logo_alt||''}" style="max-height:40px;display:block"/>` : '';
  const navHtml = full ? buildNavHtml(proj) : '';
  const wrapStyle = full ? '' : 'grid-template-columns:1fr;';
  const searchBar = full ? `
      <div class="doc-searchbar" data-doc-search-ui>
        <input id="docSearchInput" type="search" placeholder="Keresés a szövegben…" autocomplete="off"/>
        <div class="doc-searchbar-controls">
          <button class="btn" id="docSearchPrev" type="button" title="Előző találat" aria-label="Előző találat">◀</button>
          <button class="btn" id="docSearchNext" type="button" title="Következő találat" aria-label="Következő találat">▶</button>
          <button class="btn" id="docSearchClear" type="button" title="Keresés törlése" aria-label="Keresés törlése">×</button>
          <span class="meta" id="docSearchMeta">0 találat</span>
        </div>
      </div>` : '';
  const searchScript = full ? ['<scr','ipt>'].join('') + SEARCH_JS + ['</',  'script>'].join('') : '';
  const iconScript = ['<scr','ipt>'].join('') + ICON_HYDRATE_JS + ['</',  'script>'].join('');

  // A betűtípus-link a projekt design-blokkjában kiválasztott betűtípus-párhoz igazodik
  // (lásd az Egyszerű megjelenés-szerkesztőt); rendszer-betűtípusnál nincs szükség Google Fonts-ra.
  const designInfo = parseDesignBlock(projectCss);
  const fontPairForLink = FONT_PAIRS[(designInfo && designInfo.fontPair) || 'modern'] || FONT_PAIRS.modern;
  const fontLinkTag = fontPairForLink.google
    ? `<link href="https://fonts.googleapis.com/css2?${fontPairForLink.google}&display=swap" rel="stylesheet"/>`
    : '';

  return `<!DOCTYPE html>
<html lang="${proj.config.lang||'hu'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
${fontLinkTag}
<style>${css}</style>
</head>
<body>
<div class="wrap" style="${wrapStyle}">
${full ? `<aside>
  <div class="aside-top">
    <div class="brand">
      <div class="brand-logo">${logoTag}</div>
      <h1>${subtitle}</h1>
      <p>${description}</p>
    </div>
    ${searchBar}
  </div>
  <div class="aside-scroll">
    <nav aria-label="Tartalomjegyzék">${navHtml}</nav>
  </div>
</aside>` : ''}
<main>${mainContent}</main>
</div>
${searchScript}
${iconScript}
</body></html>`;
}

function buildNavHtml(proj) {
  const groups = proj.config.nav_groups;
  const idTitle = {};
  proj.fileOrder.forEach(fn => {
    const f = proj.files[fn];
    if (f.meta.id) idTitle[f.meta.id] = f.meta.title || f.meta.id;
  });
  const allIds = new Set(Object.keys(idTitle));

  if (!groups) {
    return '<ul class="nav-acc-root">' +
      proj.fileOrder.map(fn => {
        const f = proj.files[fn];
        const id = f.meta.id || fn;
        const title = f.meta.title || id;
        return `<li><a href="#${id}">${title}</a></li>`;
      }).join('') + '</ul>';
  }

  let html = '<ul class="nav-acc-root">';
  groups.forEach(g => {
    const directSections = (g.sections || []).filter(id => allIds.has(id));
    const subgroups = (g.subgroups || []).map(sg => ({
      ...sg,
      existing: (sg.sections || []).filter(id => allIds.has(id))
    })).filter(sg => sg.existing.length > 0);

    if (!directSections.length && !subgroups.length) return;

    let innerHtml = '';

    // Direct sections
    if (directSections.length) {
      innerHtml += directSections.map(id =>
        `<li><a href="#${id}">${idTitle[id]||id}</a></li>`
      ).join('');
    }

    // Subgroups as nested accordions
    subgroups.forEach(sg => {
      innerHtml += `<li>
        <details class="nav-acc" data-nav-acc open>
          <summary style="font-size:13px;padding:7px 10px">${sg.name}</summary>
          <div class="nav-acc-panel">
            <ul aria-label="${sg.name}">
              ${sg.existing.map(id => `<li><a href="#${id}">${idTitle[id]||id}</a></li>`).join('')}
            </ul>
          </div>
        </details>
      </li>`;
    });

    html += `<li><details class="nav-acc" data-nav-acc open>
      <summary>${g.name}</summary>
      <div class="nav-acc-panel"><ul aria-label="${g.name}">
        ${innerHtml}
      </ul></div></details></li>`;
  });
  html += '</ul>';
  return html;
}
