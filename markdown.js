// ── Parsers ───────────────────────────────────────────────────────────────────
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { meta: {}, content: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, content: text };
  const meta = {};
  text.slice(3, end).trim().split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i > -1) meta[line.slice(0,i).trim()] = line.slice(i+1).trim();
  });
  return { meta, content: text.slice(end+4).trim() };
}

// Frontmatter + törzs visszaalakítása egy .md fájl szövegévé. Az id és title mindig
// elöl áll, utána az esetleges egyéb (kézzel felvett) kulcsok változatlanul.
function serializeChapter(meta, content) {
  const m = meta || {};
  if (!Object.keys(m).length) return (content || '');
  const lines = [];
  if (m.id) lines.push('id: ' + m.id);
  if (m.title) lines.push('title: ' + m.title);
  for (const k of Object.keys(m)) if (k !== 'id' && k !== 'title') lines.push(k + ': ' + m[k]);
  return '---\n' + lines.join('\n') + '\n---\n\n' + (content || '').replace(/^\n+/, '') + ((content || '').endsWith('\n') ? '' : '\n');
}

// Soron belüli formázás (félkövér, kiemelés, ikon, kód, link, dőlt).
function mdInline(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/==(.+?)==/g, '<span class="hl">$1</span>')
    .replace(/:([a-z][a-z0-9-]*):/g, '<span class="mdi" data-icon="$1" aria-hidden="true"></span>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
}

// Címsor-azonosító (horgony) képzése — a README-ben leírt szabály szerint.
function mdSlug(t) {
  return t.replace(/<[^>]+>/g,'').toLowerCase()
    .replace(/[^a-z0-9\-áéíóöőúüű]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

// Egy markdown címsor-szöveg HTML azonosítója (ugyanaz, amit mdToHtml ad neki).
function mdHeadingId(text) { return mdSlug(mdInline(text)); }

// A fejezet címsorai (# … ####) a sorszámukkal — a bal oldali fában jelennek meg.
function extractHeadings(content) {
  const out = [];
  let inCode = false;
  (content || '').split('\n').forEach((line, i) => {
    const s = line.trim();
    if (s.startsWith('```')) { inCode = !inCode; return; }
    if (inCode) return;
    const m = s.match(/^(#{1,4})\s+(.+)$/);
    if (m) out.push({ level: m[1].length, text: m[2], line: i, id: mdHeadingId(m[2]) });
  });
  return out;
}

// ── Markdown → HTML ───────────────────────────────────────────────────────────
function mdToHtml(md, opts) {
  if (!md) return '';
  // showNotes: az élő előnézetben (renderPreview) true — ilyenkor a szerkesztői
  // jegyzetek egy vizuálisan elkülönülő buborékban megjelennek. A végleges
  // build/exportálásnál (buildAndDownload) nincs megadva, ezért false marad,
  // és a jegyzetek egyáltalán nem kerülnek bele a legenerált oldalba.
  const showNotes = !!(opts && opts.showNotes);
  // lines: az előnézetben minden blokk kap egy data-line="<sor>" attribútumot — ebből
  // tudja az előnézet, melyik szerkesztősorhoz tartozik (görgetés-szinkron, kattintás).
  const lineMap = !!(opts && opts.lines);
  const lines = md.split('\n');
  const html = [];
  let i = 0, inOl = false, inUl = false, shotStack = false, inAccordion = false, accItemOpen = false;

  const closeLists = () => {
    if (inOl) { html.push('</ol>'); inOl = false; }
    if (inUl) { html.push('</ul>'); inUl = false; }
  };

  const L = () => lineMap ? ` data-line="${i}"` : '';
  const inline = mdInline;
  const slug = mdSlug;

  while (i < lines.length) {
    const line = lines[i], s = line.trim();
    if (s === '<!-- shot-stack -->') { closeLists(); html.push('<figure class="shot shot-stack">'); shotStack=true; i++; continue; }
    if (s === '<!-- /shot-stack -->') { html.push('</figure>'); shotStack=false; i++; continue; }

    // Szerkesztői jegyzet: <!-- jegyzet --> ... <!-- /jegyzet --> (több soros), vagy
    // egy sorban: <!-- jegyzet: rövid szöveg -->. Az élő előnézetben (showNotes) egy
    // elkülönülő buborékban látszik, de a végleges buildelt/exportált oldalra soha
    // nem kerül bele — lásd a showNotes ág fölötti magyarázatot.
    if (s === '<!-- jegyzet -->') {
      closeLists();
      const noteLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '<!-- /jegyzet -->') { noteLines.push(lines[i]); i++; }
      if (i < lines.length) i++; // a záró <!-- /jegyzet --> sor átlépése
      if (showNotes) {
        html.push(`<div class="note-bubble"${L()}><div class="note-bubble-label">📝 Jegyzet</div>${mdToHtml(noteLines.join('\n'), {showNotes:true})}</div>`);
      }
      continue;
    }
    const noteInline = s.match(/^<!--\s*jegyzet\s*:\s*([\s\S]*?)\s*-->$/);
    if (noteInline) {
      closeLists();
      if (showNotes) html.push(`<div class="note-bubble"${L()}><div class="note-bubble-label">📝 Jegyzet</div><p>${inline(noteInline[1])}</p></div>`);
      i++; continue;
    }

    // Accordion (lenyíló/harmonika elemek): <!-- accordion --> ... +++ Cím ... <!-- /accordion -->
    if (s === '<!-- accordion -->') { closeLists(); html.push('<div class="accordion">'); inAccordion=true; accItemOpen=false; i++; continue; }
    if (s === '<!-- /accordion -->') { if (accItemOpen) { html.push('</div></details>'); accItemOpen=false; } html.push('</div>'); inAccordion=false; i++; continue; }
    if (inAccordion && s.startsWith('+++ ')) {
      closeLists();
      if (accItemOpen) html.push('</div></details>');
      const t = inline(s.slice(4));
      html.push(`<details class="acc-item"${L()}><summary>${t}</summary><div class="acc-body">`);
      accItemOpen = true; i++; continue;
    }

    const img = s.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      closeLists();
      if (!shotStack) html.push(`<figure class="shot"${L()}>`);
      html.push(`  <img${lineMap ? ` data-line="${i}"` : ''} src="${img[2]}" alt="${img[1]}" />`);
      if (i+1 < lines.length) {
        const cap = lines[i+1].trim().match(/^\*(.+)\*$/);
        if (cap) {
          html.push(`  <figcaption>${cap[1]}</figcaption>`);
          if (!shotStack) html.push('</figure>'); else { html.push('</figure>'); shotStack=false; }
          i+=2; continue;
        }
      }
      if (!shotStack) html.push('</figure>');
      i++; continue;
    }

    if (line.startsWith('> ')) { closeLists(); html.push(`<div class="callout"${L()}><p>${inline(line.slice(2))}</p></div>`); i++; continue; }
    if (s.startsWith('# ')) { closeLists(); const t=inline(s.slice(2)); html.push(`<h2 id="${slug(t)}"${L()}>${t}</h2>`); i++; continue; }
    if (s.startsWith('## ')) { closeLists(); const t=inline(s.slice(3)); html.push(`<h3 id="${slug(t)}"${L()} style="margin:18px 0 10px">${t}</h3>`); i++; continue; }
    if (s.startsWith('### ')) { closeLists(); const t=inline(s.slice(4)); html.push(`<h4 id="${slug(t)}"${L()} style="margin:14px 0 8px">${t}</h4>`); i++; continue; }
    if (s.startsWith('#### ')) { closeLists(); const t=inline(s.slice(5)); html.push(`<h5 id="${slug(t)}"${L()} style="margin:12px 0 6px">${t}</h5>`); i++; continue; }

    const ol = s.match(/^(\d+)\. (.+)/);
    if (ol) { if(inUl)closeLists(); if(!inOl){html.push('<ol class="steps">');inOl=true;} html.push(`<li${L()}>${inline(ol[2])}</li>`); i++; continue; }

    const ul = s.match(/^[-*] (.+)/);
    if (ul) { if(inOl)closeLists(); if(!inUl){html.push('<ul>');inUl=true;} html.push(`<li${L()}>${inline(ul[1])}</li>`); i++; continue; }

    if (s.includes('|') && i+1<lines.length && /^[\|\-\s:]+$/.test(lines[i+1].trim())) {
      closeLists();
      const heads = s.replace(/^\||\|$/g,'').split('|').map(h=>h.trim());
      html.push(`<table${L()} style="border-collapse:collapse;width:100%;font-size:14px;margin:12px 0"><thead><tr>`);
      heads.forEach(h => html.push(`<th style="border:1px solid var(--border);padding:8px 10px;background:var(--neutral-100);text-align:left">${inline(h)}</th>`));
      html.push('</tr></thead><tbody>');
      i+=2;
      while(i<lines.length && lines[i].includes('|')) {
        const cells = lines[i].replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
        html.push('<tr>'+cells.map(c=>`<td style="border:1px solid var(--border);padding:8px 10px">${inline(c)}</td>`).join('')+'</tr>');
        i++;
      }
      html.push('</tbody></table>'); continue;
    }

    if (s.startsWith('```')) {
      closeLists();
      const codeLine = L();
      const code=[]; i++;
      while(i<lines.length && !lines[i].trim().startsWith('```')){code.push(lines[i]);i++;}
      html.push(`<pre${codeLine}><code>${code.join('\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
      i++; continue;
    }

    if (!s) { closeLists(); i++; continue; }
    closeLists();
    if (s) html.push(`<p${L()}>${inline(s)}</p>`);
    i++;
  }
  closeLists();
  // Ha valaki elfelejtette lezárni az accordion-t, itt biztonságból bezárjuk,
  // nehogy hibás (nyitva maradt) HTML kerüljön az előnézetbe/exportba.
  if (accItemOpen) html.push('</div></details>');
  if (inAccordion) html.push('</div>');
  return html.join('\n');
}
