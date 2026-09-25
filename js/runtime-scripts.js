// ── Search JS (injected into built HTML) ─────────────────────────────────────
const SEARCH_JS = `(function () {
      const input = document.getElementById("docSearchInput");
      const meta = document.getElementById("docSearchMeta");
      const prev = document.getElementById("docSearchPrev");
      const next = document.getElementById("docSearchNext");
      const clear = document.getElementById("docSearchClear");
      if (!input || !meta || !prev || !next || !clear) return;

      let hits = [];
      let idx = -1;

      function unwrapMarks() {
        document.querySelectorAll("mark.doc-hit").forEach((m) => {
          const parent = m.parentNode;
          if (!parent) return;
          parent.replaceChild(document.createTextNode(m.textContent || ""), m);
          parent.normalize();
        });
      }

      function walkTextNodes(root) {
        const out = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const p = node.parentElement;
            if (!p) return NodeFilter.FILTER_REJECT;
            if (p.closest("aside, .print-toc")) return NodeFilter.FILTER_REJECT;
            if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        let n;
        while ((n = walker.nextNode())) out.push(n);
        return out;
      }

      function markMatches(q) {
        unwrapMarks();
        hits = [];
        idx = -1;
        if (!q) {
          meta.textContent = "0 találat";
          return;
        }

        const re = new RegExp(q.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"), "gi");
        const nodes = walkTextNodes(document.body);

        for (const node of nodes) {
          const text = node.nodeValue;
          if (!text) continue;
          const matches = [...text.matchAll(re)];
          if (matches.length === 0) continue;

          const frag = document.createDocumentFragment();
          let last = 0;
          for (const m of matches) {
            const start = m.index ?? 0;
            const end = start + (m[0]?.length || 0);
            frag.appendChild(document.createTextNode(text.slice(last, start)));
            const mark = document.createElement("mark");
            mark.className = "doc-hit";
            mark.textContent = text.slice(start, end);
            frag.appendChild(mark);
            hits.push(mark);
            last = end;
          }
          frag.appendChild(document.createTextNode(text.slice(last)));
          node.parentNode.replaceChild(frag, node);
        }

        meta.textContent = \`\${hits.length} találat\`;
        if (hits.length) {
          idx = 0;
          focusHit();
        }
      }

      function focusHit() {
        hits.forEach((h) => h.classList.remove("doc-hit-active"));
        const h = hits[idx];
        if (!h) return;
        h.classList.add("doc-hit-active");
        h.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      input.addEventListener("input", () => markMatches(input.value.trim()));
      next.addEventListener("click", () => { if (!hits.length) return; idx = (idx + 1) % hits.length; focusHit(); });
      prev.addEventListener("click", () => { if (!hits.length) return; idx = (idx - 1 + hits.length) % hits.length; focusHit(); });
      clear.addEventListener("click", () => { input.value = ""; markMatches(""); input.focus(); });
    })();

    (function () {
      function resolveTarget(hash) {
        if (!hash || hash === "#") return null;
        const id = decodeURIComponent(hash.slice(1));
        if (!id) return null;
        return document.getElementById(id);
      }

      function reAlignToHash(hash) {
        const el = resolveTarget(hash);
        if (!el) return;

        // Késleltetett ráigazítás: a képek betöltése (layout shift) el tudja tolni az anchor pozícióját,
        // ezért több hullámban visszaigazítunk.
        const align = () => el.scrollIntoView({ block: "start", behavior: "auto" });
        requestAnimationFrame(align);
        setTimeout(align, 350);
        setTimeout(align, 1100);
      }

      window.addEventListener("hashchange", () => reAlignToHash(location.hash));
      if (location.hash) reAlignToHash(location.hash);
    })();`;

// ── Ikon-behidratáló JS (a legenerált előnézetbe/build HTML-be ágyazva) ────────
// A markdownban lévő :ikon-nev: jelölésekből mdToHtml egy üres <span class="mdi"
// data-icon="ikon-nev"> placeholdert csinál. Ez a script tölti be a valódi <svg>
// tartalmat a Lucide CDN-jéről (unpkg), és a span-be ágyazza — ÍGY az ikon egy
// valódi, a lapba tartozó <svg> lesz, aminek a színét/vastagságát/méretét a
// .mdi svg CSS szabály (lásd getDefaultCSS / buildDesignBlock) tudja szabályozni.
// Egy sima <img src="...svg"> ezt nem tenné lehetővé, mert egy külön dokumentumként
// betöltött kép nem örökli/nem fogadja el a befoglaló oldal CSS-ét.
const ICON_HYDRATE_JS = `(function () {
      var cache = {};
      function hydrate(root) {
        (root || document).querySelectorAll('.mdi[data-icon]').forEach(function (span) {
          if (span.childNodes.length) return;
          var name = span.getAttribute('data-icon');
          if (cache[name]) { span.innerHTML = cache[name]; return; }
          fetch('https://unpkg.com/lucide-static@latest/icons/' + name + '.svg')
            .then(function (r) { return r.ok ? r.text() : ''; })
            .then(function (svg) { if (svg) { cache[name] = svg; span.innerHTML = svg; } })
            .catch(function () {});
        });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { hydrate(); });
      } else {
        hydrate();
      }
      window.__kkHydrateIcons = hydrate;
    })();`;


// ── Nyomtatás: nyomtatás előtt minden lenyíló elem kinyílik, utána visszaáll ───
const PRINT_JS = `(function () {
      var opened = [];
      window.addEventListener('beforeprint', function () {
        opened = [];
        document.querySelectorAll('details:not([open])').forEach(function (d) { d.open = true; opened.push(d); });
      });
      window.addEventListener('afterprint', function () {
        opened.forEach(function (d) { d.open = false; });
      });
    })();`;
