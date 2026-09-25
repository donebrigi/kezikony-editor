// ── AI a kijelölt szövegre ───────────────────────────────────────────────────
// A szerkesztő eszköztárának "✨ Szöveg" menüje: a kijelölt részt (vagy kijelölés
// nélkül a kurzor alatti bekezdést) javítja / átfogalmazza / tömöríti. Az eredmény
// egy ablakban jelenik meg az eredeti mellett — csak elfogadás után kerül a szövegbe.

const AI_TEXT_ACTIONS = {
  fix:     { label: 'Helyesírás és nyelvtan javítása', prompt: 'Javítsd a helyesírási, nyelvtani és központozási hibákat. A tartalmon és a stíluson ne változtass.' },
  clarify: { label: 'Érthetőbbé tétel', prompt: 'Fogalmazd át érthetőbben, egyszerű, természetes magyar mondatokkal, egy nem technikai felhasználó számára. A tartalmat ne bővítsd.' },
  shorten: { label: 'Tömörítés', prompt: 'Tömörítsd: maradjon meg minden lényeges információ, de legyen rövidebb és lényegre törőbb.' },
  expand:  { label: 'Bővítés, részletesebb leírás', prompt: 'Bővítsd ki részletesebb, gyakorlatias magyarázattal, ahol hasznos. Ne találj ki a felületről olyan részleteket, amelyek nincsenek a szövegben.' },
  steps:   { label: 'Számozott lépésekké alakítás', prompt: 'Alakítsd át számozott lépések listájává (1. 2. 3.), lépésenként egy teendővel.' },
  formal:  { label: 'Egységes, magázó hangnem', prompt: 'Egységesítsd a hangnemet: udvarias, magázó, tárgyilagos felhasználói kézikönyv stílus.' },
  informal:{ label: 'Egységes, tegező hangnem', prompt: 'Egységesítsd a hangnemet: barátságos, tegező, közvetlen felhasználói kézikönyv stílus.' },
};

const AI_TEXT_SYSTEM = `Magyar nyelvű felhasználói kézikönyvet szerkesztesz. A kapott Markdown-részletet a kérés szerint módosítod.
Szabályok:
- CSAK a módosított szöveget add vissza, magyarázat, bevezető vagy idézőjelek nélkül.
- A Markdown formázást őrizd meg (címsorok, listák, **félkövér**, ==kiemelés==, > kiemelt doboz, [link](#cel)).
- A speciális jelöléseket változatlanul hagyd: képek ![...](images/...), ikonok :ikon-nev:, <!-- ... --> megjegyzések, +++ harmonika-címek.
- A kép alatti *dőlt* sor képaláírás — maradjon a kép alatt.`;

let _aiTextJob = null; // { from, to, original, fn }

function toggleAiTextMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('ai-text-menu');
  if (menu.classList.contains('open')) { menu.classList.remove('open'); return; }
  const btn = document.getElementById('btn-ai-text');
  const r = btn.getBoundingClientRect();
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.left = Math.min(r.left, window.innerWidth - 280) + 'px';
  menu.classList.add('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('ai-text-menu');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target)) menu.classList.remove('open');
});

// A kijelölés, vagy ha nincs, a kurzor alatti bekezdés (üres sorok közötti blokk).
function aiTargetRange() {
  const st = editorView.state;
  const sel = st.selection.main;
  if (!sel.empty) return { from: sel.from, to: sel.to };
  const doc = st.doc;
  let a = doc.lineAt(sel.head).number, b = a;
  if (!doc.line(a).text.trim()) return null;
  while (a > 1 && doc.line(a - 1).text.trim()) a--;
  while (b < doc.lines && doc.line(b + 1).text.trim()) b++;
  return { from: doc.line(a).from, to: doc.line(b).to };
}

async function runAiTextAction(action) {
  document.getElementById('ai-text-menu').classList.remove('open');
  if (!editorView || !state.currentFile) return;
  let instruction = AI_TEXT_ACTIONS[action] && AI_TEXT_ACTIONS[action].prompt;
  if (action === 'custom') {
    instruction = prompt('Mit csináljon az AI a kijelölt szöveggel?', 'Fogalmazd át röviden, lépésenként.');
    if (!instruction) return;
  }
  const range = aiTargetRange();
  if (!range) { toast('Jelölj ki szöveget, vagy állj egy bekezdésbe!', 'err'); return; }
  const original = editorView.state.sliceDoc(range.from, range.to);
  if (original.length > 20000) { toast('A kijelölés túl hosszú — jelölj ki kisebb részt.', 'err'); return; }
  _aiTextJob = { from: range.from, to: range.to, original, fn: state.currentFile };
  editorView.dispatch({ selection: { anchor: range.from, head: range.to } });

  const modal = document.getElementById('ai-text-backdrop');
  document.getElementById('ai-text-title').textContent = action === 'custom' ? 'Egyéni utasítás' : AI_TEXT_ACTIONS[action].label;
  document.getElementById('ai-text-original').value = original;
  const out = document.getElementById('ai-text-result');
  out.value = '';
  out.placeholder = '✨ Dolgozom rajta...';
  document.getElementById('ai-text-accept').disabled = true;
  document.getElementById('ai-text-insert').disabled = true;
  modal.classList.add('open');

  try {
    const proj = currentProj();
    const text = await callClaude({
      max_tokens: 4096,
      system: AI_TEXT_SYSTEM,
      messages: [{ role: 'user', content: `Fejezet: ${chapterTitle(proj, state.currentFile)}\nFeladat: ${instruction}\n\nA szöveg:\n${original}` }]
    });
    if (!modal.classList.contains('open')) return;
    out.value = text.trim();
    document.getElementById('ai-text-accept').disabled = false;
    document.getElementById('ai-text-insert').disabled = false;
  } catch(e) {
    out.placeholder = '';
    out.value = '';
    toast('AI hiba: ' + e.message, 'err', 6000);
    closeAiTextModal();
  }
}

function closeAiTextModal() {
  document.getElementById('ai-text-backdrop').classList.remove('open');
  _aiTextJob = null;
}

// mode: 'replace' (csere) | 'below' (beszúrás az eredeti alá)
function applyAiText(mode) {
  const job = _aiTextJob;
  if (!job || !editorView) return;
  const text = document.getElementById('ai-text-result').value;
  if (job.fn !== state.currentFile) openFile(job.fn);
  // Ha közben változott a szöveg, megkeressük az eredeti részletet.
  let { from, to } = job;
  if (editorView.state.sliceDoc(from, to) !== job.original) {
    const idx = editorView.state.doc.toString().indexOf(job.original);
    if (idx === -1) { toast('Az eredeti szövegrész közben megváltozott — az eredményt a vágólapra tettem.', 'err', 5000); navigator.clipboard && navigator.clipboard.writeText(text); closeAiTextModal(); return; }
    from = idx; to = idx + job.original.length;
  }
  if (mode === 'replace') edReplace(from, to, text, from, from + text.length);
  else edReplace(to, to, '\n\n' + text, to + 2, to + 2 + text.length);
  closeAiTextModal();
  toast(mode === 'replace' ? '✓ Szöveg lecserélve (Ctrl+Z visszavonja)' : '✓ Beszúrva az eredeti alá');
}
