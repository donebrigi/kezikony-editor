// ── Szerkesztő ↔ előnézet összekötése ────────────────────────────────────────
//
//  • Görgetés-szinkron: a szerkesztő görgetésekor az előnézet ugyanahhoz a részhez
//    igazodik (a blokkok data-line attribútuma alapján, lásd mdToHtml lines opció).
//  • Kattintás az előnézetben: a szerkesztő a kattintott bekezdés sorára ugrik
//    (teljes dokumentum nézetben szükség esetén a másik fejezetet is megnyitja).
//  A szinkron mindig be van kapcsolva.

function previewDocuments() {
  const docs = [];
  try { const d = document.getElementById('preview-frame').contentDocument; if (d) docs.push(d); } catch(e) {}
  const pop = state.previewWindow && !state.previewWindow.closed ? state.previewWindow : null;
  if (pop) { try { docs.push(pop.document); } catch(e) {} }
  return docs;
}

// Az előnézet görgetése a szerkesztő tetején látható sorhoz.
function syncPreviewToEditor(instant) {
  if (!editorView || !state.currentFile) return;
  const view = editorView;
  const scroller = view.scrollDOM;
  const topBlock = view.lineBlockAtHeight(scroller.scrollTop);
  const topLine = view.state.doc.lineAt(topBlock.from).number - 1;
  // Ha a szerkesztő legfelül van, az előnézet is a fejezet tetejére megy.
  for (const doc of previewDocuments()) {
    const root = doc.querySelector(`[data-fn="${cssEscape(state.currentFile)}"]`);
    if (!root) continue;
    const win = doc.defaultView;
    doc.documentElement.style.scrollBehavior = 'auto';
    if (topLine <= 0 || scroller.scrollTop < 4) {
      win.scrollTo(0, Math.max(0, root.getBoundingClientRect().top + win.scrollY - 12));
      continue;
    }
    // A legutolsó blokk, ami a látható első sor előtt/on kezdődik.
    let best = null;
    root.querySelectorAll('[data-line]').forEach(el => {
      const ln = +el.getAttribute('data-line');
      if (ln <= topLine && (!best || ln >= +best.getAttribute('data-line'))) best = el;
    });
    const target = best || root;
    win.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + win.scrollY - 12));
  }
}

function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
}

let _syncRaf = null;
function onEditorScroll() {
  if (_syncRaf) return;
  _syncRaf = requestAnimationFrame(() => { _syncRaf = null; syncPreviewToEditor(); });
}

// Kattintás az előnézetben → a szerkesztő a megfelelő sorra ugrik.
function attachPreviewInteractions(doc) {
  // (A jelölő egy <style> elem: document.write után eltűnik, így újra felkötjük.)
  if (!doc || doc.getElementById('kk-bound')) return;
  const style = doc.createElement('style');
  style.id = 'kk-bound';
  style.textContent = '[data-line]{cursor:text} [data-line]:hover{outline:1px dashed rgba(124,106,247,.45);outline-offset:3px;border-radius:4px} img[data-path]{cursor:zoom-in}';
  (doc.head || doc.documentElement).appendChild(style);
  // Dupla kattintás egy képen → képszerkesztő
  doc.addEventListener('dblclick', e => {
    const img = e.target.closest('img[data-path]');
    if (!img) return;
    e.preventDefault();
    const section = img.closest('[data-fn]');
    if (section && section.getAttribute('data-fn') !== state.currentFile) openFile(section.getAttribute('data-fn'));
    openImageEditor(img.getAttribute('data-path'));
  });
  doc.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('a, summary, button, input, #docSearchInput')) return;
    const block = t.closest('[data-line]');
    const section = t.closest('[data-fn]');
    if (!block || !section) return;
    const fn = section.getAttribute('data-fn');
    const line = +block.getAttribute('data-line');
    if (fn !== state.currentFile) openFile(fn);
    // Görgetés-szinkron ne ugorjon vissza, amíg a szerkesztő odaér.
    jumpToLine(line);
  });
}
