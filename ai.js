// ── AI ────────────────────────────────────────────────────────────────────────
//
// Két út a Claude API felé:
//  1. Szerveroldali kulcs (ajánlott): a Supabase "ai-proxy" Edge Function hívja az API-t
//     a titkosan tárolt kulccsal (lásd supabase/functions/ai-proxy). Csak bejelentkezett
//     felhasználó használhatja, és a kulcs soha nem kerül a böngészőbe.
//  2. Saját kulcs (tartalék): ha a függvény nincs telepítve, a böngészőben megadott kulcs.
const AI_MODEL = 'claude-opus-4-5';
const AI_STATE = { apiKey: '', imgBase64: null, imgMime: 'image/png', result: null, proxy: null };

// Megnézi (egyszer), elérhető-e a szerveroldali AI.
async function detectAiProxy() {
  if (AI_STATE.proxy !== null) return AI_STATE.proxy;
  try {
    const { data, error } = await supabaseClient.functions.invoke('ai-proxy', { body: { ping: true } });
    AI_STATE.proxy = !error && !!(data && data.ok);
  } catch(e) { AI_STATE.proxy = false; }
  return AI_STATE.proxy;
}

// Claude API hívás (messages). body: { system, messages, max_tokens }
// Visszatérés: a válasz szövege.
async function callClaude(body) {
  const payload = Object.assign({ model: AI_MODEL, max_tokens: 2048 }, body);
  if (await detectAiProxy()) {
    const { data, error } = await supabaseClient.functions.invoke('ai-proxy', { body: payload });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = (j.error && (j.error.message || j.error)) || msg; } catch(e) {}
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error.message || data.error);
    return (data.content || []).map(c => c.text || '').join('');
  }
  if (!AI_STATE.apiKey) loadApiKey();
  if (!AI_STATE.apiKey) throw new Error('Nincs beállítva AI: a szerveroldali kulcs nincs telepítve, és saját API kulcsot sem adtál meg (✨ AI panel).');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_STATE.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err.error && err.error.message) || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.content || []).map(c => c.text || '').join('');
}

async function openAiPanel() {
  document.getElementById('ai-panel').classList.add('open');
  loadApiKey();
  useCurrentChapterId();
  const proxy = await detectAiProxy();
  document.getElementById('ai-key-section').style.display = proxy ? 'none' : '';
  document.getElementById('ai-proxy-status').style.display = proxy ? '' : 'none';
}
function closeAiPanel() {
  document.getElementById('ai-panel').classList.remove('open');
}

// API Key
function loadApiKey() {
  try {
    const k = localStorage.getItem('claude_api_key') || '';
    AI_STATE.apiKey = k;
    if (k) {
      document.getElementById('ai-api-key').value = k;
      setKeyStatus(true);
    }
  } catch(e) {}
}
function saveApiKey() {
  const k = document.getElementById('ai-api-key').value.trim();
  if (!k.startsWith('sk-')) { toast('Érvénytelen API kulcs formátum!', 'err'); return; }
  AI_STATE.apiKey = k;
  try { localStorage.setItem('claude_api_key', k); } catch(e) {}
  setKeyStatus(true);
  toast('✓ API kulcs mentve');
}
function setKeyStatus(ok) {
  const el = document.getElementById('ai-key-status');
  el.textContent = ok ? '✓ API kulcs beállítva' : 'Nincs API kulcs megadva';
  el.className = 'ai-key-status ' + (ok ? 'ok' : 'missing');
}

// Image handling
function handleAiImgFile(input) {
  const file = input.files[0];
  if (!file) return;
  loadAiImage(file);
  input.value = '';
}
function handleAiImgDrop(e) {
  e.preventDefault();
  document.getElementById('ai-img-zone').classList.remove('drag-over');
  const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
  if (file) loadAiImage(file);
}
function loadAiImage(file) {
  AI_STATE.imgMime = file.type || 'image/png';
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    AI_STATE.imgBase64 = dataUrl.split(',')[1];
    const preview = document.getElementById('ai-img-preview');
    preview.src = dataUrl;
    preview.style.display = 'block';
    document.querySelector('#ai-img-zone .zone-icon').style.display = 'none';
    document.querySelector('#ai-img-zone .zone-text').style.display = 'none';
    toast('✓ Kép betöltve');
  };
  reader.readAsDataURL(file);
}

// Ctrl+V a panelben
document.getElementById('ai-panel').addEventListener('paste', async e => {
  const items = Array.from(e.clipboardData?.items || []);
  const imgItem = items.find(it => it.type.startsWith('image/')) || items.find(it => it.kind === 'file');
  if (!imgItem) return;
  const file = imgItem.getAsFile();
  if (!file) return;
  loadAiImage(file);
});

function useCurrentChapterId() {
  if (!state.currentFile) return;
  const proj = state.projects[state.currentProject];
  if (!proj) return;
  const f = proj.files[state.currentFile];
  if (f?.meta?.id) document.getElementById('ai-chapter-id').value = f.meta.id;
}

// Generate
async function generateWithAI() {
  if (!AI_STATE.imgBase64) { toast('Tölts fel egy screenshotot!', 'err'); return; }

  const context = document.getElementById('ai-context').value.trim();
  const chapterId = document.getElementById('ai-chapter-id').value.trim() || 'fejezet';
  const projTitle = state.currentProject ? (state.projects[state.currentProject]?.config?.title || '') : '';

  // Find existing chapter title if any
  let existingTitle = chapterId;
  if (state.currentProject && state.projects[state.currentProject]) {
    const proj = state.projects[state.currentProject];
    for (const fn of proj.fileOrder) {
      if (proj.files[fn].meta.id === chapterId) {
        existingTitle = proj.files[fn].meta.title || chapterId;
        break;
      }
    }
  }

  const systemPrompt = `Te egy technikai dokumentáció-író vagy. A felhasználó admin felület screenshotokat küld, és te Markdown formátumban megírod a felhasználói kézikönyv megfelelő fejezetét.

Szigorú szabályok:
- Mindig adj YAML frontmatter-t a fájl elejére: ---\nid: [id]\ntitle: [Magyar cím]\n---
- Használj # fejlécet a főcímhez (h2 lesz belőle)
- Alszekciókhoz ## (h3 lesz)
- Lépéslistákhoz számozott lista: 1. 2. 3.
- Kiemelésekhez > blockquote
- Fontos: a képet NE ágyazd be, csak szöveges leírást adj
- Írj tömör, praktikus, magyarul természetes mondatokat
- Ne magyarázkodj, ne adj meta-kommentárt, csak a fejezet md szövegét add vissza`;

  const userMsg = `Projekt: ${projTitle}
Fejezet azonosítója: ${chapterId}
Fejezet neve: ${existingTitle}
${context ? 'A screenshoton látható: ' + context : ''}

Kérlek írd meg a fejezet tartalmát a screenshot alapján!`;

  setAiLoading(true);
  hideAiResult();

  try {
    const mdText = await callClaude({
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: AI_STATE.imgMime, data: AI_STATE.imgBase64 } },
          { type: 'text', text: userMsg }
        ]
      }]
    });
    AI_STATE.result = mdText;
    showAiResult(mdText);
    toast('✓ Generálás kész!');
  } catch(e) {
    toast('AI hiba: ' + e.message, 'err', 5000);
    console.error('AI error:', e);
  } finally {
    setAiLoading(false);
  }
}

function setAiLoading(on) {
  document.getElementById('ai-spinner').classList.toggle('active', on);
  document.getElementById('ai-generate-btn').disabled = on;
  document.getElementById('ai-generate-btn').querySelector('span').textContent =
    on ? 'Generálás...' : '✨ Fejezet generálása';
}

function showAiResult(md) {
  const wrap = document.getElementById('ai-result-wrap');
  document.getElementById('ai-result-preview').textContent = md;
  wrap.style.display = 'flex';
  wrap.scrollIntoView({ behavior: 'smooth' });
}

function hideAiResult() {
  document.getElementById('ai-result-wrap').style.display = 'none';
  AI_STATE.result = null;
}

function resetAiResult() {
  hideAiResult();
}

// A generált fejezet beillesztése: a frontmatterből a cím/azonosító a mezőkbe kerül,
// a szerkesztőbe csak a törzs (visszavonható Ctrl+Z-vel).
function insertAiResult() {
  const proj = currentProj();
  if (!AI_STATE.result || !proj || !state.currentFile) return;
  const chapterIdWanted = document.getElementById('ai-chapter-id').value.trim();
  let targetFn = state.currentFile;
  if (chapterIdWanted) {
    const hit = proj.fileOrder.find(fn => chapterId(proj, fn) === chapterIdWanted);
    if (hit) targetFn = hit;
  }
  const { meta, content } = parseFrontmatter(AI_STATE.result);
  const f = proj.files[targetFn];
  if (meta.title) f.meta.title = meta.title;
  if (targetFn !== state.currentFile) openFile(targetFn);
  replaceChapterContent(targetFn, content);
  updateChapterHeader();
  renderTree();
  toast('✓ Beillesztve: ' + chapterTitle(proj, targetFn));
  closeAiPanel();
  hideAiResult();
}
