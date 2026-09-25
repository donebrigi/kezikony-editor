// ── Dokumentum-szerkezet: fa = menü = fejezetsorrend ─────────────────────────
//
// A bal oldali fa egyszerre a végleges oldal menüje ÉS a fejezetek sorrendje:
//
//   (csoport nélküli fejezetek)      → a menü tetején, sima linkként
//   Csoport
//     fejezet, fejezet               → a csoport "közvetlen" fejezetei
//     Alcsoport
//       fejezet, fejezet
//
// Tárolás a config.json-ban (a korábbi formátummal kompatibilisen):
//   nav_groups: [{ name, sections: [id…], subgroups: [{ name, sections: [id…] }] }]
//   fileOrder:  [fájlnév…]  — a fa bejárási sorrendje, ebből épül az oldal

// A fa kiolvasása fájlnevekkel.
function getTree(proj) {
  const idToFn = {};
  proj.fileOrder.forEach(fn => { idToFn[chapterId(proj, fn)] = fn; });
  const used = new Set();
  const mapIds = ids => (ids || []).map(id => idToFn[id]).filter(fn => fn && !used.has(fn) && used.add(fn));
  const groups = (proj.config.nav_groups || []).map(g => ({
    name: g.name || 'Csoport',
    sections: mapIds(g.sections),
    subgroups: (g.subgroups || []).map(sg => ({ name: sg.name || 'Alcsoport', sections: mapIds(sg.sections) }))
  }));
  const ungrouped = proj.fileOrder.filter(fn => !used.has(fn));
  return { ungrouped, groups };
}

// A fa visszaírása: nav_groups (id-kkal) + fileOrder (bejárási sorrend).
function setTree(proj, tree) {
  const ids = list => list.map(fn => chapterId(proj, fn));
  const order = [...tree.ungrouped];
  proj.config.nav_groups = tree.groups.map(g => {
    order.push(...g.sections);
    g.subgroups.forEach(sg => order.push(...sg.sections));
    return { name: g.name, sections: ids(g.sections), subgroups: g.subgroups.map(sg => ({ name: sg.name, sections: ids(sg.sections) })) };
  });
  if (!proj.config.nav_groups.length) delete proj.config.nav_groups;
  proj.fileOrder = order;
}

// Betöltéskor: a fájlsorrend igazítása a fához (hogy a fa és az oldal sorrendje egyezzen).
function normalizeStructure(proj) {
  // Előbb a config.json-ban mentett sorrend (a benne nem szereplő fájlok a végére)…
  const names = Object.keys(proj.files);
  const saved = Array.isArray(proj.config.fileOrder) ? proj.config.fileOrder : [];
  const known = new Set(names);
  const ordered = saved.filter(fn => known.has(fn));
  proj.fileOrder = ordered.concat(names.filter(fn => !ordered.includes(fn)).sort());
  // …majd a fa szerinti bejárás.
  setTree(proj, getTree(proj));
}

// A konténer (fában egy lista) elérése egy "cím" alapján:
//   { kind: 'ungrouped' } | { kind: 'group', gi } | { kind: 'subgroup', gi, si }
function containerList(tree, addr) {
  if (addr.kind === 'ungrouped') return tree.ungrouped;
  if (addr.kind === 'group') return tree.groups[addr.gi].sections;
  return tree.groups[addr.gi].subgroups[addr.si].sections;
}

function findChapter(tree, fn) {
  let i = tree.ungrouped.indexOf(fn);
  if (i > -1) return { addr: { kind: 'ungrouped' }, index: i };
  for (let gi = 0; gi < tree.groups.length; gi++) {
    const g = tree.groups[gi];
    i = g.sections.indexOf(fn);
    if (i > -1) return { addr: { kind: 'group', gi }, index: i };
    for (let si = 0; si < g.subgroups.length; si++) {
      i = g.subgroups[si].sections.indexOf(fn);
      if (i > -1) return { addr: { kind: 'subgroup', gi, si }, index: i };
    }
  }
  return null;
}

// Fejezet áthelyezése egy konténerbe, adott pozícióra (index = beszúrás helye).
function moveChapterInTree(proj, fn, toAddr, toIndex) {
  const tree = getTree(proj);
  const from = findChapter(tree, fn);
  if (from) {
    const list = containerList(tree, from.addr);
    list.splice(from.index, 1);
    if (sameAddr(from.addr, toAddr) && from.index < toIndex) toIndex--;
  }
  const target = containerList(tree, toAddr);
  target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, fn);
  setTree(proj, tree);
}

function sameAddr(a, b) {
  return a.kind === b.kind && a.gi === b.gi && a.si === b.si;
}

// Új fejezet beszúrása a megadott fejezet után (ugyanabba a csoportba), vagy a lista végére.
function insertChapterAfter(proj, fn, afterFn) {
  const tree = getTree(proj);
  const at = afterFn ? findChapter(tree, afterFn) : null;
  if (at) containerList(tree, at.addr).splice(at.index + 1, 0, fn);
  else tree.ungrouped.push(fn);
  setTree(proj, tree);
}

function removeChapterFromTree(proj, fn) {
  const tree = getTree(proj);
  const at = findChapter(tree, fn);
  if (at) containerList(tree, at.addr).splice(at.index, 1);
  setTree(proj, tree);
}

// Fejezet-azonosító cseréje a menü-hivatkozásokban.
function renameChapterIdInNav(proj, oldId, newId) {
  (proj.config.nav_groups || []).forEach(g => {
    g.sections = (g.sections || []).map(id => id === oldId ? newId : id);
    (g.subgroups || []).forEach(sg => { sg.sections = (sg.sections || []).map(id => id === oldId ? newId : id); });
  });
}

// Csoport / alcsoport műveletek (a fa objektumon).
function addGroup(proj, name) {
  const tree = getTree(proj);
  tree.groups.push({ name: name || 'Új csoport', sections: [], subgroups: [] });
  setTree(proj, tree);
}
function addSubgroup(proj, gi, name) {
  const tree = getTree(proj);
  tree.groups[gi].subgroups.push({ name: name || 'Új alcsoport', sections: [] });
  setTree(proj, tree);
}
// Csoport törlése: a benne lévő fejezetek nem vesznek el, a csoport helyére kerülnek.
function removeGroup(proj, gi) {
  const tree = getTree(proj);
  const g = tree.groups[gi];
  const freed = [...g.sections, ...g.subgroups.flatMap(sg => sg.sections)];
  tree.groups.splice(gi, 1);
  tree.ungrouped.push(...freed);
  setTree(proj, tree);
}
function removeSubgroup(proj, gi, si) {
  const tree = getTree(proj);
  const g = tree.groups[gi];
  g.sections.push(...g.subgroups[si].sections);
  g.subgroups.splice(si, 1);
  setTree(proj, tree);
}
function renameGroup(proj, gi, si, name) {
  const tree = getTree(proj);
  if (si == null) tree.groups[gi].name = name;
  else tree.groups[gi].subgroups[si].name = name;
  setTree(proj, tree);
}
// Csoport áthelyezése egy másik elé (toGi = beszúrási index).
function moveGroup(proj, fromGi, toGi) {
  const tree = getTree(proj);
  const [g] = tree.groups.splice(fromGi, 1);
  if (fromGi < toGi) toGi--;
  tree.groups.splice(Math.max(0, Math.min(toGi, tree.groups.length)), 0, g);
  setTree(proj, tree);
}
function moveSubgroup(proj, fromGi, fromSi, toGi, toSi) {
  const tree = getTree(proj);
  const [sg] = tree.groups[fromGi].subgroups.splice(fromSi, 1);
  if (fromGi === toGi && fromSi < toSi) toSi--;
  const subs = tree.groups[toGi].subgroups;
  subs.splice(Math.max(0, Math.min(toSi, subs.length)), 0, sg);
  setTree(proj, tree);
}
