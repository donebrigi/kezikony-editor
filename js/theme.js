// ── Projekt-szintű megjelenés (téma) ─────────────────────────────────────────
//
// A megjelenést nem dokumentumonként, hanem PROJEKTENKÉNT állítjuk: egy projekt minden
// dokumentuma ugyanazt a témát kapja. Tárolás: {projektId}/_theme.json  →  { version, vars }
//
// Kódból rögzített (nem állítható, minden projektben egységes):
//   • betűtípus: Inter (szöveg) + Lexend (címsorok)
//   • címsorméretek: Címsor 1–5 (# … #####) = 32 / 28 / 24 / 20 / 18 px
//   • sarkok lekerekítése: 14px
// Állítható: színek, bekezdés betűmérete, ikonok.

const THEME_FIXED = {
  font: `'Inter',ui-sans-serif,system-ui,sans-serif`,
  head: `'Lexend',ui-sans-serif,system-ui,sans-serif`,
  google: 'family=Inter:wght@400;500;600;700&family=Lexend:wght@500;600;700',
  radius: '14px',
  // Címsor 1–5 = a szerkesztőben #, ##, ###, ####, ##### → HTML h2…h6
  headingSizes: [32, 28, 24, 20, 18],
};

const THEME_DEFAULTS = {
  accent: '#c40075', bg: '#fafafa', card: '#ffffff', text: '#1e2433', muted: '#6b7280', border: '#e2e5ea',
  calloutBg: null, calloutText: null, hlColor: null,
  h1Color: null, h2Color: null, h3Color: null, h4Color: null, h5Color: null,   // null = automatikus
  fsP: 16, iconColor: null, iconSize: 20, iconStroke: 2,
};

// A beállító felület mezői (csoportosítva). auto: mihez igazodik, ha nincs külön megadva.
const THEME_GROUPS = [
  { title: 'Alapszínek', fields: [
    { key: 'accent', label: 'Kiemelő szín', hint: 'linkek, menü, gombok' },
    { key: 'bg', label: 'Oldal háttere' },
    { key: 'card', label: 'Kártyák háttere' },
    { key: 'text', label: 'Szöveg' },
    { key: 'muted', label: 'Másodlagos szöveg', hint: 'képaláírás, leírás' },
    { key: 'border', label: 'Szegélyek' },
  ]},
  { title: 'Kiemelések', fields: [
    { key: 'calloutBg', label: 'Kiemelt doboz színe', hint: '> szöveg', auto: 'accent' },
    { key: 'calloutText', label: 'Kiemelt doboz szövege', auto: 'text' },
    { key: 'hlColor', label: 'Kiemelt szöveg', hint: '==szöveg==', auto: 'accent' },
  ]},
  { title: 'Címsorok színe', fields: [
    { key: 'h1Color', label: 'Címsor 1', hint: '#', auto: 'accent' },
    { key: 'h2Color', label: 'Címsor 2', hint: '##', auto: 'accent' },
    { key: 'h3Color', label: 'Címsor 3', hint: '###', auto: 'accent' },
    { key: 'h4Color', label: 'Címsor 4', hint: '####', auto: 'text' },
    { key: 'h5Color', label: 'Címsor 5', hint: '#####', auto: 'text' },
  ]},
  { title: 'Ikonok', fields: [
    { key: 'iconColor', label: 'Ikonok színe', hint: ':ikon:', auto: 'text' },
  ]},
];

const isHexColor = v => /^#[0-9a-fA-F]{6}$/.test(v || '');

function normalizeThemeVars(v) {
  const out = Object.assign({}, THEME_DEFAULTS);
  Object.keys(THEME_DEFAULTS).forEach(k => {
    if (v && v[k] != null && v[k] !== '') out[k] = v[k];
  });
  ['accent', 'bg', 'card', 'text', 'muted', 'border'].forEach(k => { if (!isHexColor(out[k])) out[k] = THEME_DEFAULTS[k]; });
  ['calloutBg', 'calloutText', 'hlColor', 'h1Color', 'h2Color', 'h3Color', 'h4Color', 'h5Color', 'iconColor'].forEach(k => { if (out[k] && !isHexColor(out[k])) out[k] = null; });
  out.fsP = Math.min(24, Math.max(12, parseInt(out.fsP, 10) || 16));
  out.iconSize = Math.min(64, Math.max(10, parseInt(out.iconSize, 10) || 20));
  out.iconStroke = Math.min(4, Math.max(0.5, parseFloat(out.iconStroke) || 2));
  return out;
}

// Egy mező tényleges színe (az "automatikus" mezők a hozzájuk rendelt alapszínt veszik fel).
function themeColor(v, key) {
  if (v[key]) return v[key];
  const field = THEME_GROUPS.flatMap(g => g.fields).find(f => f.key === key);
  return field && field.auto ? v[field.auto] : v[key];
}

// A téma CSS-e: alap CSS + rögzített tipográfia + a projekt színei.
function composeThemeCss(varsIn) {
  const v = normalizeThemeVars(varsIn);
  const c = k => themeColor(v, k);
  const hs = THEME_FIXED.headingSizes;
  const calloutGrad = `linear-gradient(135deg,color-mix(in srgb, ${c('calloutBg')} 35%, ${v.card}) 0%,color-mix(in srgb, ${c('calloutBg')} 12%, ${v.card}) 55%,${v.card} 100%)`;
  return getDefaultCSS() + `
/* ── Rögzített tipográfia (kódból, minden projektben azonos) ── */
:root{--font:${THEME_FIXED.font};--font-head:${THEME_FIXED.head};--radius:${THEME_FIXED.radius}}
main h2,main h3,main h4,main h5,main h6{font-family:var(--font-head);line-height:1.25;letter-spacing:-0.01em}
main h2{font-size:${hs[0]}px;margin:0 0 14px}
main h3{font-size:${hs[1]}px}
main h4{font-size:${hs[2]}px}
main h5{font-size:${hs[3]}px}
main h6{font-size:${hs[4]}px;margin:12px 0 6px}
/* ── Projekt téma ── */
:root{
  --bg:${v.bg};--bg-elev:${v.card};--bg-card:${v.card};--text:${v.text};--muted:${v.muted};--border:${v.border};
  --accent:${v.accent};--brand-pink-deep:${v.accent};--brand-pink:color-mix(in srgb, ${v.accent} 75%, white);
  --accent-soft:color-mix(in srgb, ${v.accent} 12%, ${v.card});
  --callout-bg:${calloutGrad};--callout-text:${c('calloutText')};--callout-border:${c('calloutBg')};
  --hl-color:${c('hlColor')};
  --icon-color:${c('iconColor')};--icon-stroke-width:${v.iconStroke};--icon-width:${v.iconSize}px;--icon-height:${v.iconSize}px;
}
main p,main ul,main ol{font-size:${v.fsP}px}
.callout{background:${calloutGrad};color:${c('calloutText')};border-left-color:${c('calloutBg')}}
.hl{color:${c('hlColor')}}
main h2{color:${c('h1Color')}}
main h3{color:${c('h2Color')}}
main h4{color:${c('h3Color')}}
main h5{color:${c('h4Color')}}
main h6{color:${c('h5Color')}}
.brand h1{color:${v.accent}}
.mdi svg{width:${v.iconSize}px;height:${v.iconSize}px;stroke:${c('iconColor')};stroke-width:${v.iconStroke};color:${c('iconColor')}}
`;
}

function themeFontLinkTag() {
  return `<link href="https://fonts.googleapis.com/css2?${THEME_FIXED.google}&display=swap" rel="stylesheet"/>`;
}

// ── Régi, dokumentumonkénti megjelenés átvétele ──────────────────────────────
// A korábbi verziók a színeket a dokumentum style.css-ébe írták (@kezikonyv-design blokk).
// Ha a projektnek még nincs témája, ebből indulunk, hogy a meglévő kinézet ne vesszen el.
function themeVarsFromLegacyCss(cssText) {
  const m = (cssText || '').match(/\/\*\s*@kezikonyv-design-start[^*]*\*\/[\s\S]*?\/\*\s*@kezikonyv-design-end\s*\*\//);
  if (!m) return null;
  const grab = name => { const mm = m[0].match(new RegExp('--' + name + '\\s*:\\s*([^;]+);')); return mm ? mm[1].trim() : null; };
  const hex = t => { const mm = (t || '').match(/#[0-9a-fA-F]{6}\b/); return mm ? mm[0] : null; };
  const out = {
    accent: grab('accent'), bg: grab('bg'), card: grab('bg-card'), text: grab('text'), muted: grab('muted'), border: grab('border'),
    calloutBg: grab('callout-tint') || hex(grab('callout-bg')), calloutText: grab('callout-text'), hlColor: grab('hl-color'),
    // régen a "#" a h2-es színt kapta — eggyel eltolva vesszük át
    h1Color: grab('h2-color'), h2Color: grab('h3-color'), h3Color: grab('h4-color'), h4Color: grab('h5-color'),
    fsP: parseInt(grab('fs-p'), 10) || null, iconColor: grab('icon-color'),
    iconSize: parseInt(grab('icon-width'), 10) || null, iconStroke: parseFloat(grab('icon-stroke-width')) || null,
  };
  // A korábbi automatikus értékek (= kiemelő szín / szöveg színe) itt is automatikusak maradnak.
  ['calloutBg', 'hlColor', 'h1Color', 'h2Color', 'h3Color'].forEach(k => { if (out[k] === out.accent) out[k] = null; });
  ['calloutText', 'h4Color', 'iconColor'].forEach(k => { if (out[k] === out.text) out[k] = null; });
  return normalizeThemeVars(out);
}

// ── Felhő ──
async function cloudGetProjectTheme(projectId) {
  if (!projectId) return null;
  const txt = await cloudDownloadText(projectId + '/_theme.json');
  if (!txt) return null;
  try { return normalizeThemeVars(JSON.parse(txt).vars); } catch(e) { return null; }
}
async function cloudSaveProjectTheme(projectId, vars) {
  return cloudUpload(projectId + '/_theme.json', JSON.stringify({ version: 1, vars: normalizeThemeVars(vars) }, null, 2), 'application/json');
}

// Egy dokumentum tényleges témája: projekt téma → (ha nincs) a dokumentum régi színei → alap.
async function resolveDocTheme(topProjectId, legacyCss) {
  return (await cloudGetProjectTheme(topProjectId)) || themeVarsFromLegacyCss(legacyCss) || normalizeThemeVars({});
}

// Az előnézet és a build ezt használja.
function getWorkingCss(proj) {
  return composeThemeCss(proj && proj.themeVars);
}
