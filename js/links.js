// ── Belső linkek: javaslatok és hibás hivatkozások jelzése ────────────────────
//
//  • "](" után (pl. a 🔗 Link gomb vagy kézi gépelés) a szerkesztő felajánlja a
//    dokumentum fejezeteit és címsorait (#azonosito formában).
//  • A nem létező #hivatkozások pirosan aláhúzva látszanak a szerkesztőben, a fában
//    pedig ⚠ jelzi, melyik fejezetben van ilyen.

let _anchorCache = null;
function invalidateAnchors() { _anchorCache = null; }

// Az összes érvényes horgony: fejezet-azonosítók + minden fejezet címsorai.
// liveText: a szerkesztőben épp látható (esetleg még el nem tárolt) szöveg az aktív fejezethez.
function getAnchorIndex(liveText) {
  const proj = currentProj();
  if (!proj) return { set: new Set(), list: [] };
  if (_anchorCache && _anchorCache.proj === proj && (liveText == null || _anchorCache.live === liveText)) return _anchorCache;
  const set = new Set();
  const list = [];
  proj.fileOrder.forEach(fn => {
    const f = proj.files[fn];
    if (!f) return;
    const content = (fn === state.currentFile && liveText != null) ? liveText : f.content;
    const id = chapterId(proj, fn);
    set.add(id);
    list.push({ id, label: chapterTitle(proj, fn), detail: 'fejezet', boost: 2 });
    extractHeadings(content).forEach(h => {
      // A fejezet saját "# Cím" sora ne jelenjen meg külön javaslatként.
      if (h.level === 1 && h.text.trim() === chapterTitle(proj, fn).trim()) { set.add(h.id); return; }
      if (!h.id || set.has(h.id)) { set.add(h.id); return; }
      set.add(h.id);
      list.push({ id: h.id, label: h.text.replace(/[*=`]/g, ''), detail: chapterTitle(proj, fn), boost: 0 });
    });
  });
  _anchorCache = { proj, set, list, live: liveText != null ? liveText : (currentFileEntry() || {}).content };
  return _anchorCache;
}

const LINK_RE = /\]\(#([^)\s]*)\)/g;

function brokenLinksIn(content) {
  const { set } = getAnchorIndex();
  const out = [];
  for (const m of (content || '').matchAll(LINK_RE)) {
    let id = m[1];
    try { id = decodeURIComponent(id); } catch(e) {}
    if (!set.has(id)) out.push(id);
  }
  return out;
}

// Szerkesztő-dekoráció: hibás belső link piros hullámos aláhúzással.
function buildLinkDecorations(view) {
  const { set } = getAnchorIndex(view.state.doc.toString());
  const decos = [];
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.length < 5000) {
        for (const m of line.text.matchAll(LINK_RE)) {
          let id = m[1];
          try { id = decodeURIComponent(id); } catch(e) {}
          if (set.has(id)) continue;
          const start = line.from + m.index + 2, end = line.from + m.index + m[0].length - 1;
          decos.push(CM.Decoration.mark({ class: 'cm-kk-badlink', attributes: { title: id ? `Nem létező hivatkozás: #${id}` : 'Üres hivatkozás' } }).range(start, end));
        }
      }
      pos = line.to + 1;
    }
  }
  return CM.Decoration.set(decos, true);
}

// Link-javaslat: "](" vagy "](#…" után.
function linkCompletionSource(ctx) {
  const m = ctx.matchBefore(/\]\(#?[^\s()]*$/);
  if (!m) return null;
  const from = m.from + 2;
  const { list } = getAnchorIndex();
  if (!list.length) return null;
  return {
    from,
    options: list.map(a => ({ label: '#' + a.id, displayLabel: a.label, detail: a.detail === 'fejezet' ? 'fejezet' : '› ' + a.detail, apply: '#' + a.id, boost: a.boost, type: a.detail === 'fejezet' ? 'class' : 'property' })),
    validFor: /^#?[^\s()]*$/
  };
}
