// ── Megjelenés oldal (projekt téma) ──────────────────────────────────────────
// Teljes oldalas nézet: balra a beállítások (csak színek + pár méret), jobbra egy minta
// kézikönyv-oldal, amin MINDEN formázás megtalálható — így egy pillantással látszik,
// mire hat egy-egy szín. A beállítás a projekt összes dokumentumára érvényes.

const TV = { projectId: null, projectName: '', vars: null, saved: null, returnTo: null, timer: null };

// Minta tartalom: minden formázási elem egy helyen.
const THEME_SAMPLE = {
  intro: `# Minta kézikönyv

Ez egy **minta oldal**: itt látszik, hogyan fognak kinézni a projekt dokumentumai. A bekezdésben van *dőlt*, **félkövér**, ==kiemelt szöveg==, \`kód\` és egy [belső link](#hasznalat).

> Kiemelt doboz: fontos tudnivaló vagy figyelmeztetés a felhasználónak.

## Címsor 2

### Címsor 3

#### Címsor 4

##### Címsor 5`,
  usage: `# Használat

## Lépések

1. Nyisd meg a felületet :house:
2. Kattints a **Beállítások** gombra :settings:
3. Mentsd el a módosításokat :check:

- Felsorolás első eleme
- Második elem ==kiemeléssel==

![Minta képernyőkép](SAMPLE_IMG)
*Képaláírás a kép alatt*

| Mező | Leírás |
|---|---|
| Név | A felhasználó teljes neve |
| E-mail | Belépéshez használt cím |

<!-- accordion -->
+++ Gyakori kérdés: hogyan lépek be?
A bejelentkező oldalon add meg az e-mail címed és a jelszavad.

+++ Mi van, ha elfelejtettem a jelszavam?
Kattints az **Elfelejtett jelszó** linkre.
<!-- /accordion -->

\`\`\`
Példa kódblokk
\`\`\``,
  faq: `# Gyakori kérdések

Rövid bekezdés a harmadik fejezetben, egy [külső hivatkozással](https://example.com).`,
};

function sampleImageDataUrl(v) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="360"><rect width="800" height="360" fill="#eef1f5"/><rect x="0" y="0" width="800" height="44" fill="${v.accent}"/><rect x="24" y="72" width="220" height="264" rx="10" fill="#ffffff"/><rect x="268" y="72" width="508" height="120" rx="10" fill="#ffffff"/><rect x="268" y="212" width="508" height="124" rx="10" fill="#ffffff"/><text x="400" y="140" font-family="sans-serif" font-size="22" fill="#9aa3af" text-anchor="middle">Képernyőkép</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function buildThemeSampleHtml(vars) {
  const v = normalizeThemeVars(vars);
  const files = {};
  const mk = (id, title, content) => ({ meta: { id, title }, content: content.replace('SAMPLE_IMG', sampleImageDataUrl(v)) });
  files['01.md'] = mk('bevezetes', 'Minta kézikönyv', THEME_SAMPLE.intro);
  files['02.md'] = mk('hasznalat', 'Használat', THEME_SAMPLE.usage);
  files['03.md'] = mk('gyik', 'Gyakori kérdések', THEME_SAMPLE.faq);
  const fake = {
    name: '__sample', config: { title: TV.projectName || 'Minta', subtitle: TV.projectName || 'Minta kézikönyv', description: 'Minta oldal a megjelenéshez',
      nav_groups: [{ name: 'Első lépések', sections: ['hasznalat', 'gyik'], subgroups: [] }] },
    fileOrder: ['01.md', '02.md', '03.md'], files, logo: ''
  };
  return buildPreviewHtml(fake, buildAllSectionsHtml(fake, { showNotes: true }), true, composeThemeCss(v));
}

// ── Megnyitás / bezárás ──
async function openThemeView(projectId, returnTo) {
  if (!projectId) { toast('Ehhez a dokumentumhoz nem tartozik projekt.', 'err'); return; }
  if (state.uiView === 'editor' && hasUnsavedWork()) await saveAllDirty({ quiet: true });
  TV.projectId = projectId;
  TV.returnTo = returnTo || state.uiView;
  const meta = (state.homeProjects || []).find(p => p.id === projectId) || state.currentTopProjectMeta || await cloudGetProjectMeta(projectId);
  TV.projectName = (meta && meta.id === projectId && meta.name) || (meta && meta.name) || projectId;

  let vars = await cloudGetProjectTheme(projectId);
  let migrated = false;
  if (!vars) {
    // Még nincs projekt téma: a projekt első olyan dokumentumából indulunk, aminek volt saját színe.
    for (const d of await cloudListDocuments(projectId)) {
      const css = await cloudDownloadText(projectId + '/' + d.id + '/style.css');
      const legacy = themeVarsFromLegacyCss(css);
      if (legacy) { vars = legacy; migrated = true; break; }
    }
  }
  TV.vars = normalizeThemeVars(vars || {});
  TV.saved = JSON.stringify(TV.vars);

  state.uiView = 'theme';
  ['view-home', 'view-project'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('main').style.display = 'none';
  document.getElementById('view-theme').classList.add('active');
  updateTopbarToolsVisibility();
  document.getElementById('breadcrumb-row').classList.add('visible');
  document.getElementById('breadcrumb-bar').innerHTML = `<span class="crumb" onclick="closeThemeView()">${escapeHtml(TV.projectName)}</span><span class="crumb-sep">/</span><span class="crumb-current">Megjelenés</span>`;
  document.getElementById('theme-project-name').textContent = TV.projectName;
  renderThemeForm();
  renderThemePreview();
  updateThemeDirty();
  if (migrated) toast('A projekt még nem kapott közös megjelenést — egy meglévő dokumentum színeiből indultunk. Mentéssel ez lesz a projekt témája.', 'ok', 6000);
}

async function closeThemeView() {
  if (isThemeDirty()) {
    if (confirm('A megjelenésen nem mentett módosítások vannak. Elmented őket?\n\nOK = mentés, Mégse = elvetés')) {
      if (!await saveThemeView()) return;
    }
  }
  document.getElementById('view-theme').classList.remove('active');
  const back = TV.returnTo;
  TV.vars = null;
  if (back === 'editor' && currentProj()) {
    enterEditorView();
    renderPreview();
  } else if (back === 'home') {
    showHomeView();
  } else {
    showProjectView(TV.projectId);
  }
}

function isThemeDirty() { return !!TV.vars && JSON.stringify(TV.vars) !== TV.saved; }
function updateThemeDirty() {
  const el = document.getElementById('theme-dirty');
  el.textContent = isThemeDirty() ? '● Nem mentett módosítás' : 'Minden mentve';
  el.classList.toggle('unsaved', isThemeDirty());
}

async function saveThemeView() {
  const ok = await cloudSaveProjectTheme(TV.projectId, TV.vars);
  if (!ok) { toast('⚠ A mentés nem sikerült', 'err'); return false; }
  TV.saved = JSON.stringify(TV.vars);
  updateThemeDirty();
  // A megnyitott dokumentum (ha ebbe a projektbe tartozik) azonnal megkapja az új témát.
  const p = currentProj();
  if (p && p.topProjectId === TV.projectId) p.themeVars = normalizeThemeVars(TV.vars);
  toast('✓ Megjelenés mentve — a projekt minden dokumentumára érvényes');
  return true;
}

function resetThemeView() {
  if (!confirm('Visszaállítod az alapértelmezett megjelenést? (A Mentés gombbal lesz végleges.)')) return;
  TV.vars = normalizeThemeVars({});
  renderThemeForm();
  onThemeChanged();
}

// ── Beállító űrlap ──
function renderThemeForm() {
  const host = document.getElementById('theme-form-fields');
  const v = TV.vars;
  let html = '';
  THEME_GROUPS.forEach(g => {
    html += `<div class="tf-group"><div class="tf-title">${escapeHtml(g.title)}</div>`;
    g.fields.forEach(f => {
      const isAuto = f.auto && !v[f.key];
      const shown = themeColor(v, f.key);
      html += `<div class="tf-row${isAuto ? ' is-auto' : ''}" data-key="${f.key}">
        <label>${escapeHtml(f.label)}${f.hint ? ` <span class="tf-hint">${escapeHtml(f.hint)}</span>` : ''}</label>
        <input type="color" value="${shown}" oninput="onThemeColor('${f.key}', this.value)" title="${isAuto ? 'Automatikus — kattints a saját szín megadásához' : shown}"/>
        <input type="text" class="tf-hex" value="${isAuto ? '' : shown}" placeholder="${isAuto ? '(auto)' : ''}" oninput="onThemeHex('${f.key}', this.value)"/>
        ${f.auto ? `<button class="tf-auto" onclick="setThemeAuto('${f.key}')" title="Igazodjon ehhez: ${f.auto === 'accent' ? 'Kiemelő szín' : 'Szöveg'}" ${isAuto ? 'disabled' : ''}>auto</button>` : '<span class="tf-auto-spacer"></span>'}
      </div>`;
    });
    if (g.title === 'Ikonok') {
      html += `<div class="tf-row"><label>Ikonok mérete</label><input type="number" min="10" max="64" value="${v.iconSize}" oninput="onThemeNum('iconSize', this.value)" class="tf-num"/><span class="tf-unit">px</span><span></span></div>
        <div class="tf-row"><label>Ikonok vonalvastagsága</label><input type="number" min="0.5" max="4" step="0.25" value="${v.iconStroke}" oninput="onThemeNum('iconStroke', this.value)" class="tf-num"/><span class="tf-unit">px</span><span></span></div>`;
    }
    html += `</div>`;
  });
  html += `<div class="tf-group"><div class="tf-title">Szöveg</div>
    <div class="tf-row"><label>Bekezdés betűmérete</label><input type="number" min="12" max="24" value="${v.fsP}" oninput="onThemeNum('fsP', this.value)" class="tf-num"/><span class="tf-unit">px</span><span></span></div>
  </div>`;
  html += `<div class="tf-group tf-fixed"><div class="tf-title">Egységes (nem állítható)</div>
    <div class="tf-note">Betűtípus: <b>Inter</b> (szöveg) + <b>Lexend</b> (címsorok)<br>
    Címsorméretek: Címsor 1–5 = ${THEME_FIXED.headingSizes.join(' / ')} px<br>
    Sarkok lekerekítése: ${THEME_FIXED.radius}</div></div>`;
  host.innerHTML = html;
}

function onThemeColor(key, val) {
  TV.vars[key] = val;
  const row = document.querySelector(`.tf-row[data-key="${key}"]`);
  if (row) {
    row.classList.remove('is-auto');
    row.querySelector('.tf-hex').value = val;
    const btn = row.querySelector('.tf-auto'); if (btn) btn.disabled = false;
  }
  // Az "automatikus" mezők színmintája az alapszínnel együtt változik.
  if (key === 'accent' || key === 'text') refreshAutoSwatches();
  onThemeChanged();
}
function onThemeHex(key, val) { if (isHexColor(val)) { const row = document.querySelector(`.tf-row[data-key="${key}"] input[type=color]`); if (row) row.value = val; onThemeColor(key, val); } }
function onThemeNum(key, val) { TV.vars[key] = val; onThemeChanged(); }
function setThemeAuto(key) { TV.vars[key] = null; renderThemeForm(); onThemeChanged(); }
function refreshAutoSwatches() {
  document.querySelectorAll('.tf-row.is-auto').forEach(row => { row.querySelector('input[type=color]').value = themeColor(TV.vars, row.dataset.key); });
}

function onThemeChanged() {
  updateThemeDirty();
  clearTimeout(TV.timer);
  TV.timer = setTimeout(renderThemePreview, 120);
}

function renderThemePreview() {
  const frame = document.getElementById('theme-preview-frame');
  let y = 0;
  try { y = frame.contentWindow.scrollY || 0; } catch(e) {}
  frame.onload = () => {
    try { const d = frame.contentDocument; d.documentElement.style.scrollBehavior = 'auto'; d.documentElement.scrollTop = y; } catch(e) {}
  };
  frame.srcdoc = buildThemeSampleHtml(TV.vars);
}

// A szerkesztőből: a megnyitott dokumentum projektjének témája.
function openThemeForCurrentDoc() {
  const p = currentProj();
  if (!p) return;
  openThemeView(p.topProjectId, 'editor');
}
