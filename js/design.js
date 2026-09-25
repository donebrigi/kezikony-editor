// ── Egyszerű megjelenés-szerkesztő (design form) ──────────────────────────────
// A cél, hogy a nyers CSS kód helyett néhány magyar nyelvű mezővel (szín, sarok
// lekerekítés, betűtípus) is be lehessen állítani a kézikönyv kinézetét. A
// kiválasztott értékeket NEM a meglévő CSS-be írjuk bele (az bármi lehet, akár
// kézzel írt egyedi kód is) — helyette egy jól elkülöníthető, jelölt :root blokkot
// fűzünk a CSS végére, ami a CSS cascade szabályai szerint felülírja a korábbi
// (azonos nevű) egyéni tulajdonságokat. Így a haladó CSS kód is megmarad érintetlenül.
const FONT_PAIRS = {
  modern:   { label: 'Modern (Inter + Lexend)',        font: `'Inter',ui-sans-serif,system-ui,sans-serif`,                head: `'Lexend',ui-sans-serif,system-ui,sans-serif`,                google: 'family=Inter:wght@400;500;600;700&family=Lexend:wght@500;600;700' },
  friendly: { label: 'Barátságos (Nunito + Poppins)',  font: `'Nunito',ui-sans-serif,system-ui,sans-serif`,                head: `'Poppins',ui-sans-serif,system-ui,sans-serif`,               google: 'family=Nunito:wght@400;600;700&family=Poppins:wght@600;700' },
  classic:  { label: 'Klasszikus (Georgia)',           font: `Georgia,'Times New Roman',serif`,                            head: `Georgia,'Times New Roman',serif`,                            google: null },
  clean:    { label: 'Letisztult (rendszer betűtípus)', font: `ui-sans-serif,system-ui,-apple-system,sans-serif`,          head: `ui-sans-serif,system-ui,-apple-system,sans-serif`,           google: null },
  mono:     { label: 'Gépelt (monospace)',             font: `'JetBrains Mono',ui-monospace,monospace`,                    head: `'JetBrains Mono',ui-monospace,monospace`,                    google: 'family=JetBrains+Mono:wght@400;500;600;700' }
};

const DESIGN_BLOCK_RE = /\/\*\s*@kezikonyv-design-start(?:\s+font-pair=(\w+))?\s*\*\/[\s\S]*?\/\*\s*@kezikonyv-design-end\s*\*\//;

// Az ÖSSZES design-blokkot eltávolítja (ha kézi szerkesztéssel több is került a CSS-be,
// korábban csak az első tűnt el, és a régi blokk a végén felülírta az újat).
const DESIGN_BLOCK_RE_ALL = new RegExp(DESIGN_BLOCK_RE.source, 'g');
function stripDesignBlock(cssText) {
  return (cssText || '').replace(DESIGN_BLOCK_RE_ALL, '').trim();
}

function parseDesignBlock(cssText) {
  const m = (cssText || '').match(DESIGN_BLOCK_RE);
  if (!m) return null;
  const body = m[0];
  const grab = (name) => {
    const mm = body.match(new RegExp('--' + name + '\\s*:\\s*([^;]+);'));
    return mm ? mm[1].trim() : null;
  };
  const vars = {
    accent: grab('accent'),
    bg: grab('bg'),
    card: grab('bg-card'),
    text: grab('text'),
    muted: grab('muted'),
    border: grab('border'),
    radius: grab('radius'),
    fsP: grab('fs-p'),
    fsH1: grab('fs-h1'),
    fsH2: grab('fs-h2'),
    fsH3: grab('fs-h3'),
    fsH4: grab('fs-h4'),
    fsH5: grab('fs-h5'),
    // A --callout-bg egy linear-gradient(...) — a színválasztóba ebből NEM lehet visszatölteni.
    // Korábban ez a teljes gradient-szöveg került a <input type=color>-ba, ami #000000-ra
    // esett vissza, így a következő mentéskor a kiemelt doboz fekete lett. Most a
    // választott alapszín külön (--callout-tint) is el van mentve; régi blokkoknál a
    // gradient első hex színét vesszük.
    calloutBg: grab('callout-tint') || firstHex(grab('callout-bg')),
    calloutText: grab('callout-text'),
    hlColor: grab('hl-color'),
    h1Color: grab('h1-color'),
    h2Color: grab('h2-color'),
    h3Color: grab('h3-color'),
    h4Color: grab('h4-color'),
    h5Color: grab('h5-color'),
    iconColor: grab('icon-color'),
    iconStrokeWidth: grab('icon-stroke-width'),
    iconWidth: grab('icon-width'),
    iconHeight: grab('icon-height')
  };
  Object.keys(vars).forEach(k => { if (vars[k] === null) delete vars[k]; });
  return { vars, fontPair: m[1] || 'modern' };
}

function firstHex(text) {
  const m = (text || '').match(/#[0-9a-fA-F]{6}\b/);
  return m ? m[0] : null;
}

// Számhoz px mértékegységet fűz, ha még nincs rajta (radius/betűméret mezőknél).
function withPx(val, fallback) {
  const v = val || fallback;
  return /px|em|rem|%/.test(v) ? v : v + 'px';
}

function buildDesignBlock(vars, fontPairKey) {
  const fp = FONT_PAIRS[fontPairKey] || FONT_PAIRS.modern;
  const radius = withPx(vars.radius, '14');
  const fsP = withPx(vars.fsP, '16');
  const fsH1 = withPx(vars.fsH1, '24');
  const fsH2 = withPx(vars.fsH2, '22');
  const fsH3 = withPx(vars.fsH3, '15');
  const fsH4 = withPx(vars.fsH4, '14');
  const fsH5 = withPx(vars.fsH5, '13');
  // A kiemelt doboz háttere egy lágy színátmenet: a választott alapszíntől (calloutTint)
  // a kártya-háttérszín felé fut ki. Mivel a #fff helyett a téma tényleges kártya-hátterét
  // (vars.card) használja végponti színnek, sötét témánál is automatikusan olvasható marad —
  // csak az alapszínt kell megadni, a lágyítást a color-mix végzi.
  const calloutTint = vars.calloutBg || vars.accent;
  const calloutBgGradient = `linear-gradient(135deg,color-mix(in srgb, ${calloutTint} 35%, ${vars.card}) 0%,color-mix(in srgb, ${calloutTint} 12%, ${vars.card}) 55%,${vars.card} 100%)`;
  const calloutText = vars.calloutText || vars.text;
  // Kiemelt szöveg (== szöveg == jelölés) és a címsorok szín alapból a Kiemelő színt (accent)
  // vagy a H4/H5-nél a normál szöveg színét öröklik, de mindegyik külön is felülírható.
  const hlColor = vars.hlColor || vars.accent;
  const h1Color = vars.h1Color || vars.accent;
  const h2Color = vars.h2Color || vars.accent;
  const h3Color = vars.h3Color || vars.accent;
  const h4Color = vars.h4Color || vars.text;
  const h5Color = vars.h5Color || vars.text;
  // Lucide ikon (:ikon-nev: jelölés) megjelenése — külön szín/vastagság/méret, alapból a
  // szöveg színét és a Lucide gyári 2px vonalvastagságát/24px méretét közelítő 20px-et örökli.
  const iconColor = vars.iconColor || vars.text;
  const iconStrokeWidth = vars.iconStrokeWidth || '2';
  const iconWidth = withPx(vars.iconWidth, '20');
  const iconHeight = withPx(vars.iconHeight, '20');
  return `/* @kezikonyv-design-start font-pair=${fontPairKey} */
:root{
  --bg:${vars.bg};
  --bg-elev:${vars.card};
  --bg-card:${vars.card};
  --text:${vars.text};
  --muted:${vars.muted};
  --accent:${vars.accent};
  --brand-pink-deep:${vars.accent};
  --brand-pink:color-mix(in srgb, ${vars.accent} 75%, white);
  --accent-soft:color-mix(in srgb, ${vars.accent} 12%, ${vars.card});
  --border:${vars.border};
  --radius:${radius};
  --font:${fp.font};
  --font-head:${fp.head};
  --fs-p:${fsP};
  --fs-h1:${fsH1};
  --fs-h2:${fsH2};
  --fs-h3:${fsH3};
  --fs-h4:${fsH4};
  --fs-h5:${fsH5};
  --callout-tint:${calloutTint};
  --callout-bg:${calloutBgGradient};
  --callout-text:${calloutText};
  --callout-border:${vars.accent};
  --hl-color:${hlColor};
  --h1-color:${h1Color};
  --h2-color:${h2Color};
  --h3-color:${h3Color};
  --h4-color:${h4Color};
  --h5-color:${h5Color};
  --icon-color:${iconColor};
  --icon-stroke-width:${iconStrokeWidth};
  --icon-width:${iconWidth};
  --icon-height:${iconHeight};
}
main p{font-size:var(--fs-p)}
.hero h1,main h1{font-size:var(--fs-h1)}
main h2{font-size:var(--fs-h2)}
main h3{font-size:var(--fs-h3)}
main h4{font-size:var(--fs-h4)}
main h5{font-size:var(--fs-h5)}
.callout{background:${calloutBgGradient};color:${calloutText};border-left-color:${vars.accent}}
.hl{color:${hlColor}}
main h1{color:${h1Color}}
main h2{color:${h2Color}}
main h3{color:${h3Color}}
main h4{color:${h4Color}}
main h5{color:${h5Color}}
.mdi svg{width:${iconWidth};height:${iconHeight};stroke:${iconColor};stroke-width:${iconStrokeWidth};color:${iconColor}}
/* @kezikonyv-design-end */`;
}

// Alapértelmezett kinézet megközelítő hex/px értékei (az eredeti CSS oklch-alapú
// színskálájának hozzávetőleges megfelelői), csak addig, amíg a projekt még nem
// kapott saját design-blokkot. A h3/h4/h5 alapértékek (15/14/13px) a getDefaultCSS()
// tényleges alapértelmezett méreteivel egyeznek.
const DESIGN_FALLBACK_VARS = {
  accent: '#c40075', bg: '#fafafa', card: '#ffffff',
  text: '#1e2433', muted: '#6b7280', border: '#e2e5ea', radius: '14',
  fsP: '16', fsH1: '24', fsH2: '22', fsH3: '15', fsH4: '14', fsH5: '13'
};

// ── Munkapéldány (piszkozat) a CSS-hez ───────────────────────────────────────
// A Megjelenés fülön végzett módosítások élőben látszanak az előnézetben, de a
// projekt CSS-ét (proj.css) csak a Mentés/Alkalmaz gomb írja felül. Korábban minden
// mezőváltozás azonnal proj.css-t módosította, amit a gépelés közbeni automentés az
// IndexedDB-be is kiírt — a felhőbe/mappába viszont nem. Így a böngészőben "megvolt"
// a módosítás, máshol (vagy a felhőből újranyitva) viszont az alapértelmezett látszott.
function getWorkingCss(proj) {
  if (!proj) return '';
  const d = state.cssDraft;
  return (d && d.project === proj.name) ? d.css : (proj.css || getDefaultCSS());
}
function setCssDraft(css) {
  const proj = currentProj();
  if (!proj) return;
  state.cssDraft = { project: proj.name, css };
  updateCssDirtyHint();
}
function discardCssDraft() {
  state.cssDraft = null;
  updateCssDirtyHint();
}
function hasUnsavedCss() {
  const proj = currentProj();
  return !!(proj && state.cssDraft && state.cssDraft.project === proj.name && state.cssDraft.css !== proj.css);
}
function updateCssDirtyHint() {
  document.querySelectorAll('.css-dirty-hint').forEach(el => {
    el.textContent = hasUnsavedCss() ? '● Nem mentett módosítás' : 'A módosítások élőben frissítik az előnézetet.';
    el.classList.toggle('unsaved', hasUnsavedCss());
  });
}

// A piszkozat véglegesítése és mentése mindenhová (böngésző + felhő / mappa).
async function commitCss() {
  const proj = currentProj();
  if (!proj) return;
  if (state.cssDraft && state.cssDraft.project === proj.name) proj.css = state.cssDraft.css;
  discardCssDraft();
  const { ok } = await saveProjectCss(proj);
  renderPreview();
  toast(ok ? '✓ Megjelenés mentve a felhőbe' : '⚠ A megjelenés mentése nem sikerült — próbáld újra', ok ? 'ok' : 'err', ok ? 2500 : 5000);
}

// Modal bezárásakor: nem mentett CSS esetén rákérdezünk.
async function resolveUnsavedCssOnClose() {
  if (!hasUnsavedCss()) { discardCssDraft(); return; }
  if (confirm('A megjelenésen nem mentett módosítások vannak. Elmented őket?\n\nOK = mentés, Mégse = elvetés')) {
    await commitCss();
  } else {
    discardCssDraft();
    renderPreview();
  }
}

function setCssMode(mode) {
  document.getElementById('css-mode-simple-btn').classList.toggle('active', mode === 'simple');
  document.getElementById('css-mode-code-btn').classList.toggle('active', mode === 'code');
  document.getElementById('css-simple-panel').style.display = mode === 'simple' ? '' : 'none';
  document.getElementById('css-code-panel').style.display = mode === 'code' ? '' : 'none';
  const proj = currentProj();
  if (!proj) return;
  if (mode === 'simple') loadDesignForm();
  else document.getElementById('proj-css-editor').value = getWorkingCss(proj);
}

const DESIGN_COLOR_FIELDS = ['accent','bg','card','text','muted','border','callout-bg','callout-text','hl-color','h1-color','h2-color','h3-color','h4-color','h5-color','icon-color'];

function isHex(v) { return /^#[0-9a-fA-F]{6}$/.test(v || ''); }

function loadDesignForm() {
  const proj = currentProj();
  if (!proj) return;
  const parsed = parseDesignBlock(getWorkingCss(proj));
  const vars = Object.assign({}, DESIGN_FALLBACK_VARS, parsed ? parsed.vars : {});
  const setColorField = (id, hex, fallback) => {
    const v = isHex(hex) ? hex : fallback;
    document.getElementById(id).value = v;
    document.getElementById(id + '-hex').value = v;
  };
  const F = DESIGN_FALLBACK_VARS;
  setColorField('df-accent', vars.accent, F.accent);
  setColorField('df-bg', vars.bg, F.bg);
  setColorField('df-card', vars.card, F.card);
  setColorField('df-text', vars.text, F.text);
  setColorField('df-muted', vars.muted, F.muted);
  setColorField('df-border', vars.border, F.border);
  const accent = isHex(vars.accent) ? vars.accent : F.accent;
  const text = isHex(vars.text) ? vars.text : F.text;
  const radiusNum = parseInt(vars.radius, 10);
  const r = isNaN(radiusNum) ? 14 : radiusNum;
  document.getElementById('df-radius').value = r;
  document.getElementById('df-radius-val').textContent = r + 'px';
  document.getElementById('df-fontpair').value = (parsed && FONT_PAIRS[parsed.fontPair]) ? parsed.fontPair : 'modern';
  document.getElementById('df-fs-p').value = parseInt(vars.fsP, 10) || 16;
  document.getElementById('df-fs-h1').value = parseInt(vars.fsH1, 10) || 24;
  document.getElementById('df-fs-h2').value = parseInt(vars.fsH2, 10) || 22;
  document.getElementById('df-fs-h3').value = parseInt(vars.fsH3, 10) || 15;
  document.getElementById('df-fs-h4').value = parseInt(vars.fsH4, 10) || 14;
  document.getElementById('df-fs-h5').value = parseInt(vars.fsH5, 10) || 13;
  // A "nincs külön beállítva" mezők a Kiemelő színt / a szöveg színét mutatják.
  setColorField('df-callout-bg', vars.calloutBg, accent);
  setColorField('df-callout-text', vars.calloutText, text);
  setColorField('df-hl-color', vars.hlColor, accent);
  setColorField('df-h1-color', vars.h1Color, accent);
  setColorField('df-h2-color', vars.h2Color, accent);
  setColorField('df-h3-color', vars.h3Color, accent);
  setColorField('df-h4-color', vars.h4Color, text);
  setColorField('df-h5-color', vars.h5Color, text);
  setColorField('df-icon-color', vars.iconColor, text);
  document.getElementById('df-icon-stroke-width').value = parseFloat(vars.iconStrokeWidth) || 2;
  document.getElementById('df-icon-width').value = parseInt(vars.iconWidth, 10) || 20;
  document.getElementById('df-icon-height').value = parseInt(vars.iconHeight, 10) || 20;
  updateCssDirtyHint();
}

function onHexChange(field, val) {
  if (isHex(val)) {
    document.getElementById('df-' + field).value = val;
    onDesignFieldChange();
  }
}

function onDesignFieldChange() {
  // A színválasztó és a mellette lévő hex mező mindig szinkronban marad.
  DESIGN_COLOR_FIELDS.forEach(k => {
    const hexEl = document.getElementById('df-' + k + '-hex');
    if (document.activeElement !== hexEl) hexEl.value = document.getElementById('df-' + k).value;
  });
  document.getElementById('df-radius-val').textContent = document.getElementById('df-radius').value + 'px';
  clearTimeout(state._designTimer);
  state._designTimer = setTimeout(() => applyDesignForm(false), 150);
}

function readDesignForm() {
  const v = id => document.getElementById(id).value;
  return {
    accent: v('df-accent'), bg: v('df-bg'), card: v('df-card'), text: v('df-text'),
    muted: v('df-muted'), border: v('df-border'), radius: v('df-radius'),
    fsP: v('df-fs-p'), fsH1: v('df-fs-h1'), fsH2: v('df-fs-h2'), fsH3: v('df-fs-h3'),
    fsH4: v('df-fs-h4'), fsH5: v('df-fs-h5'),
    calloutBg: v('df-callout-bg'), calloutText: v('df-callout-text'), hlColor: v('df-hl-color'),
    h1Color: v('df-h1-color'), h2Color: v('df-h2-color'), h3Color: v('df-h3-color'),
    h4Color: v('df-h4-color'), h5Color: v('df-h5-color'),
    iconColor: v('df-icon-color'), iconStrokeWidth: v('df-icon-stroke-width'),
    iconWidth: v('df-icon-width'), iconHeight: v('df-icon-height')
  };
}

// doSave=false: csak élő előnézet (piszkozat); doSave=true: mentés mindenhová.
async function applyDesignForm(doSave) {
  const proj = currentProj();
  if (!proj) return;
  clearTimeout(state._designTimer);
  const base = stripDesignBlock(getWorkingCss(proj));
  const css = base + '\n' + buildDesignBlock(readDesignForm(), document.getElementById('df-fontpair').value);
  setCssDraft(css);
  const codeEditor = document.getElementById('proj-css-editor');
  if (codeEditor) codeEditor.value = css;
  if (doSave) await commitCss();
  else renderPreview();
}

// ── CSS szerkesztő (haladó nézet) ────────────────────────────────────────────
function loadCssEditor() {
  const editor = document.getElementById('proj-css-editor');
  const proj = currentProj();
  if (!proj) {
    editor.value = '/* Nincs aktív projekt */';
    editor.disabled = true;
    return;
  }
  document.getElementById('css-proj-name').textContent = projectDisplayTitle(proj);
  editor.value = getWorkingCss(proj);
  editor.disabled = false;
  // A tab megnyitásakor mindig az egyszerű, magyar nyelvű felületet mutatjuk alapból.
  setCssMode('simple');
}

async function saveCss() {
  if (!currentProj()) return;
  clearTimeout(state._cssTimer);
  setCssDraft(document.getElementById('proj-css-editor').value);
  await commitCss();
}

async function resetToDefaultCss() {
  if (!currentProj()) return;
  if (!confirm('Visszaállítja az alapértelmezett megjelenést? (Ez azonnal mentésre is kerül.)')) return;
  document.getElementById('proj-css-editor').value = getDefaultCSS();
  await saveCss();
  loadDesignForm();
}

document.getElementById('proj-css-editor').addEventListener('input', () => {
  if (!currentProj()) return;
  clearTimeout(state._cssTimer);
  state._cssTimer = setTimeout(() => {
    setCssDraft(document.getElementById('proj-css-editor').value);
    renderPreview();
  }, 600);
});
