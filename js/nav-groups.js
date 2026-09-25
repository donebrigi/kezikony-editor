// Nav groups editor — csoport → alcsoport → fejezetek
// Drag & drop state
const _dnd = { dragging: null }; // { id, fromGroup, fromSub }

function renderNavGroupsEditor() {
  if (!state.currentProject || !state.projects[state.currentProject]) return;
  const proj = state.projects[state.currentProject];
  if (!proj.config.nav_groups) proj.config.nav_groups = [];
  const groups = proj.config.nav_groups;

  const allSections = proj.fileOrder.map(fn => ({
    fn, id: proj.files[fn].meta.id || fn, title: proj.files[fn].meta.title || fn
  }));

  // Collect all placed ids
  const usedIds = new Set();
  groups.forEach(g => {
    (g.sections || []).forEach(id => usedIds.add(id));
    (g.subgroups || []).forEach(sg => (sg.sections || []).forEach(id => usedIds.add(id)));
  });
  const ungrouped = allSections.filter(s => !usedIds.has(s.id));

  const container = document.getElementById('nav-groups-editor');
  container.innerHTML = '';

  // ── Ungrouped pool ──────────────────────────────────────────────────────────
  const poolBox = document.createElement('div');
  poolBox.style.cssText = 'margin-bottom:12px;padding:8px;background:var(--bg3);border-radius:var(--radius);border:2px dashed var(--border2)';
  poolBox.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600">CSOPORTON KÍVÜL — húzd a csoportba</div>';
  const poolArea = makeDropArea('ungrouped', null);
  ungrouped.forEach(s => poolArea.appendChild(makeChip(s, 'ungrouped', null)));
  if (!ungrouped.length) poolArea.innerHTML = '<span style="font-size:11px;color:var(--text3);padding:4px">Mind el van helyezve ✓</span>';
  poolBox.appendChild(poolArea);
  container.appendChild(poolBox);

  // ── Groups ──────────────────────────────────────────────────────────────────
  groups.forEach((g, gi) => {
    const groupDiv = document.createElement('div');
    groupDiv.style.cssText = 'margin-bottom:10px;border:1px solid var(--border2);border-radius:var(--radius);overflow:visible';

    // Group header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg3);border-bottom:1px solid var(--border);border-radius:var(--radius) var(--radius) 0 0';
    header.innerHTML = `
      <input type="text" value="${g.name}" placeholder="Csoport neve"
        style="flex:1;background:var(--bg);border:1px solid var(--border2);color:var(--text);padding:4px 8px;border-radius:5px;font-size:13px"
        oninput="updateGroupName(${gi}, this.value)"/>
      <button class="btn-sm" onclick="moveGroup(${gi},-1)" title="Csoport feljebb" style="font-size:12px">↑</button>
      <button class="btn-sm" onclick="moveGroup(${gi},1)" title="Csoport lejjebb" style="font-size:12px">↓</button>
      <button class="btn-sm" onclick="addSubgroup(${gi})" title="+ Alcsoport" style="font-size:11px;white-space:nowrap">+ Alcs.</button>
      <button class="btn-sm del" onclick="removeNavGroup(${gi})">🗑</button>`;
    groupDiv.appendChild(header);

    const groupBody = document.createElement('div');
    groupBody.style.cssText = 'padding:8px;background:var(--bg4);border-radius:0 0 var(--radius) var(--radius)';

    // Direct drop area
    const directLabel = document.createElement('div');
    directLabel.style.cssText = 'font-size:10px;color:var(--text3);margin-bottom:4px;font-weight:600';
    directLabel.textContent = 'KÖZVETLEN FEJEZETEK:';
    groupBody.appendChild(directLabel);

    const directArea = makeDropArea(gi, null);
    (g.sections || []).forEach(id => {
      const s = allSections.find(s => s.id === id);
      if (s) directArea.appendChild(makeChip(s, gi, null));
    });
    groupBody.appendChild(directArea);

    // Subgroups
    (g.subgroups || []).forEach((sg, si) => {
      const sgDiv = document.createElement('div');
      sgDiv.style.cssText = 'border:1px solid var(--border2);border-radius:6px;overflow:visible;margin-top:8px';

      const sgHeader = document.createElement('div');
      sgHeader.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg3);border-bottom:1px solid var(--border);border-radius:6px 6px 0 0';
      sgHeader.innerHTML = `
        <span style="font-size:11px;color:var(--text3)">↳</span>
        <input type="text" value="${sg.name}" placeholder="Alcsoport neve"
          style="flex:1;background:var(--bg);border:1px solid var(--border2);color:var(--text);padding:3px 7px;border-radius:5px;font-size:12px"
          oninput="updateSubgroupName(${gi}, ${si}, this.value)"/>
        <button class="btn-sm" onclick="moveSubgroup(${gi},${si},-1)" title="Feljebb" style="font-size:12px">↑</button>
        <button class="btn-sm" onclick="moveSubgroup(${gi},${si},1)" title="Lejjebb" style="font-size:12px">↓</button>
        <button class="btn-sm del" onclick="removeSubgroup(${gi},${si})" style="font-size:11px">🗑</button>`;
      sgDiv.appendChild(sgHeader);

      const sgArea = makeDropArea(gi, si);
      (sg.sections || []).forEach(id => {
        const s = allSections.find(s => s.id === id);
        if (s) sgArea.appendChild(makeChip(s, gi, si));
      });
      sgDiv.appendChild(sgArea);
      groupBody.appendChild(sgDiv);
    });

    groupDiv.appendChild(groupBody);
    container.appendChild(groupDiv);
  });
}

// ── Drop area factory ─────────────────────────────────────────────────────────
function makeDropArea(gi, si) {
  const area = document.createElement('div');
  area.dataset.gi = gi;
  area.dataset.si = si === null ? '' : si;
  area.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;min-height:34px;padding:6px;border:2px dashed transparent;border-radius:6px;transition:all .15s;background:var(--bg4)';

  area.addEventListener('dragenter', e => {
    e.preventDefault();
    area.style.borderColor = 'var(--accent)';
    area.style.background = 'var(--accent-soft)';
  });
  area.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  area.addEventListener('dragleave', e => {
    // Only reset if leaving the area itself, not a child
    if (!area.contains(e.relatedTarget)) {
      area.style.borderColor = 'transparent';
      area.style.background = 'var(--bg4)';
    }
  });
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.style.borderColor = 'transparent';
    area.style.background = 'var(--bg4)';
    if (!_dnd.dragging) return;
    const { id, fromGroup, fromSub } = _dnd.dragging;
    const toGroup = gi;
    const toSub = si;
    _dnd.dragging = null;
    moveChipTo(id, fromGroup, fromSub, toGroup, toSub);
  });

  return area;
}

// ── Chip factory ──────────────────────────────────────────────────────────────
function makeChip(s, gi, si) {
  const chip = document.createElement('div');
  chip.draggable = true;
  chip.dataset.id = s.id;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;background:var(--bg2);border:1px solid var(--border2);border-radius:20px;font-size:12px;color:var(--text2);cursor:grab;user-select:none;transition:border-color .1s';

  chip.addEventListener('mouseenter', () => chip.style.borderColor = 'var(--accent)');
  chip.addEventListener('mouseleave', () => chip.style.borderColor = 'var(--border2)');

  chip.addEventListener('dragstart', e => {
    _dnd.dragging = { id: s.id, fromGroup: gi, fromSub: si };
    chip.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', s.id); // required for Firefox
  });
  chip.addEventListener('dragend', () => {
    chip.style.opacity = '1';
    _dnd.dragging = null;
  });

  const label = document.createElement('span');
  label.textContent = s.title;
  chip.appendChild(label);

  // ↑ ↓ buttons
  const btnUp = document.createElement('button');
  btnUp.textContent = '↑'; btnUp.title = 'Feljebb';
  btnUp.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text3);font-size:11px;padding:0 1px;line-height:1';
  btnUp.addEventListener('click', e => { e.stopPropagation(); moveChipOrder(s.id, gi, si, -1); });

  const btnDown = document.createElement('button');
  btnDown.textContent = '↓'; btnDown.title = 'Lejjebb';
  btnDown.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text3);font-size:11px;padding:0 1px;line-height:1';
  btnDown.addEventListener('click', e => { e.stopPropagation(); moveChipOrder(s.id, gi, si, 1); });

  // × remove
  const btnX = document.createElement('button');
  btnX.textContent = '×'; btnX.title = 'Kivétel';
  btnX.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:0 3px;line-height:1;font-weight:bold';
  btnX.addEventListener('mouseover', () => btnX.style.color = 'var(--red)');
  btnX.addEventListener('mouseout', () => btnX.style.color = 'var(--text3)');
  btnX.addEventListener('click', e => { e.stopPropagation(); moveChipTo(s.id, gi, si, 'ungrouped', null); });

  chip.appendChild(btnUp);
  chip.appendChild(btnDown);
  chip.appendChild(btnX);
  return chip;
}

// ── Data manipulation ─────────────────────────────────────────────────────────
function getList(gi, si) {
  const proj = state.projects[state.currentProject];
  const groups = proj.config.nav_groups;
  if (gi === 'ungrouped') return null;
  if (si !== null && si !== undefined && si !== '' && groups[gi]?.subgroups?.[si]) {
    if (!groups[gi].subgroups[si].sections) groups[gi].subgroups[si].sections = [];
    return groups[gi].subgroups[si].sections;
  }
  if (!groups[gi].sections) groups[gi].sections = [];
  return groups[gi].sections;
}

function removeFromList(id, gi, si) {
  if (gi === 'ungrouped') return;
  const list = getList(gi, si);
  if (!list) return;
  const idx = list.indexOf(id);
  if (idx > -1) list.splice(idx, 1);
}

function addToList(id, gi, si) {
  if (gi === 'ungrouped') return;
  const list = getList(gi, si);
  if (!list) return;
  if (!list.includes(id)) list.push(id);
}

function moveChipTo(id, fromGi, fromSi, toGi, toSi) {
  removeFromList(id, fromGi, fromSi);
  addToList(id, toGi, toSi);
  renderNavGroupsEditor();
}

function moveChipOrder(id, gi, si, dir) {
  const list = getList(gi, si);
  if (!list) return;
  const idx = list.indexOf(id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  list.splice(idx, 1);
  list.splice(newIdx, 0, id);
  renderNavGroupsEditor();
}

function addSubgroup(gi) {
  const proj = state.projects[state.currentProject];
  if (!proj?.config?.nav_groups?.[gi]) return;
  if (!proj.config.nav_groups[gi].subgroups) proj.config.nav_groups[gi].subgroups = [];
  proj.config.nav_groups[gi].subgroups.push({ name: 'Új alcsoport', sections: [] });
  renderNavGroupsEditor();
}

function removeSubgroup(gi, si) {
  const proj = state.projects[state.currentProject];
  if (!proj?.config?.nav_groups?.[gi]?.subgroups) return;
  proj.config.nav_groups[gi].subgroups.splice(si, 1);
  renderNavGroupsEditor();
}

function updateSubgroupName(gi, si, name) {
  const proj = state.projects[state.currentProject];
  if (proj?.config?.nav_groups?.[gi]?.subgroups?.[si])
    proj.config.nav_groups[gi].subgroups[si].name = name;
}

function updateGroupName(gi, name) {
  const proj = state.projects[state.currentProject];
  if (proj?.config?.nav_groups?.[gi]) proj.config.nav_groups[gi].name = name;
}

function addNavGroup() {
  const proj = state.projects[state.currentProject];
  if (!proj?.config) return;
  if (!proj.config.nav_groups) proj.config.nav_groups = [];
  proj.config.nav_groups.push({ name: 'Új csoport', sections: [], subgroups: [] });
  renderNavGroupsEditor();
}

function removeNavGroup(idx) {
  const proj = state.projects[state.currentProject];
  if (!proj?.config?.nav_groups) return;
  proj.config.nav_groups.splice(idx, 1);
  renderNavGroupsEditor();
}

function moveGroup(idx, dir) {
  const proj = state.projects[state.currentProject];
  const groups = proj?.config?.nav_groups;
  if (!groups) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= groups.length) return;
  const [moved] = groups.splice(idx, 1);
  groups.splice(newIdx, 0, moved);
  renderNavGroupsEditor();
}

function moveSubgroup(gi, si, dir) {
  const proj = state.projects[state.currentProject];
  const subs = proj?.config?.nav_groups?.[gi]?.subgroups;
  if (!subs) return;
  const newIdx = si + dir;
  if (newIdx < 0 || newIdx >= subs.length) return;
  const [moved] = subs.splice(si, 1);
  subs.splice(newIdx, 0, moved);
  renderNavGroupsEditor();
}
