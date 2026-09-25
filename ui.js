// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type='ok', dur=2500) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = '', dur);
}

// ── Status ────────────────────────────────────────────────────────────────────
function setStatus(msg, cls='') {
  const s = document.getElementById('status');
  s.textContent = msg; s.className = cls;
}

// ── Segéd ──
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatRelativeDate(iso) {
  try {
    const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diffDays <= 0) return 'ma';
    if (diffDays === 1) return 'tegnap';
    if (diffDays < 7) return diffDays + ' napja';
    if (diffDays < 30) return Math.floor(diffDays / 7) + ' hete';
    return Math.floor(diffDays / 30) + ' hónapja';
  } catch(e) { return ''; }
}
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Szöveg letöltése fájlként (fallback, ha nincs írási jog / File System Access API).
function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function flashStatus(msg, cls = 'saved', ms = 2000) {
  setStatus(msg, cls);
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => setStatus(''), ms);
}

// ── Topbar legördülő menük (Letöltés, Profil) ──
// Mindkét menü position:fixed (lásd .dl-menu CSS-t) — a #topbar-nak overflow-y:hidden
// van beállítva, ami levágna egy topbaron belüli, absolute pozicionált lenyíló menüt,
// ezért a helyét (top/left vagy top/right) mindig a gomb tényleges képernyő-pozíciója
// (getBoundingClientRect) alapján, JS-ből számoljuk ki, minden megnyitáskor újra.
function positionFixedMenu(menu, btn, align) {
  const r = btn.getBoundingClientRect();
  const menuWidth = 260;
  menu.style.top = (r.bottom + 6) + 'px';
  if (align === 'right') {
    // Jobbra igazítva (a menü jobb széle essen egybe a gomb jobb szélével) — ez kell
    // a topbar jobb szélén ülő Profil-gombnál, különben a menü kilógna a képernyőből.
    let right = window.innerWidth - r.right;
    right = Math.max(12, right);
    menu.style.right = right + 'px';
    menu.style.left = 'auto';
  } else {
    let left = r.left;
    const maxLeft = window.innerWidth - menuWidth - 12;
    if (left > maxLeft) left = Math.max(12, maxLeft);
    menu.style.left = left + 'px';
    menu.style.right = 'auto';
  }
}

// A korábbi két külön gomb ("Build" / "Build + Optimalizál") helyett egy "Letöltés"
// gomb van, ami egy kis menüt nyit — itt választható a kép-optimalizálás, majd a
// "Letöltés indítása" gombbal fut le ugyanaz a buildAndDownload(), mint eddig.
function toggleDownloadMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('download-menu');
  if (menu.classList.contains('open')) { closeDownloadMenu(); return; }
  closeProfileMenu();
  positionFixedMenu(menu, document.getElementById('btn-download'), 'left');
  menu.classList.add('open');
}
function closeDownloadMenu() {
  document.getElementById('download-menu').classList.remove('open');
}

// A korábban külön látszó email cím + 🔑 Jelszó + Kilépés gombok most egy Profil
// legördülő alá kerültek — ugyanaz a minta, mint a Letöltés menünél.
function toggleProfileMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('profile-menu');
  if (menu.classList.contains('open')) { closeProfileMenu(); return; }
  closeDownloadMenu();
  positionFixedMenu(menu, document.getElementById('btn-profile'), 'right');
  menu.classList.add('open');
}
function closeProfileMenu() {
  document.getElementById('profile-menu').classList.remove('open');
}

document.addEventListener('click', (e) => {
  const dlMenu = document.getElementById('download-menu');
  const dlWrap = document.querySelector('.dl-menu-wrap');
  if (dlMenu && dlMenu.classList.contains('open') && dlWrap && !dlWrap.contains(e.target) && !dlMenu.contains(e.target)) {
    closeDownloadMenu();
  }
  const profMenu = document.getElementById('profile-menu');
  const profWrap = document.querySelector('.profile-menu-wrap');
  if (profMenu && profMenu.classList.contains('open') && profWrap && !profWrap.contains(e.target) && !profMenu.contains(e.target)) {
    closeProfileMenu();
  }
});
// Ha közben görgetik a topbart (vízszintesen, keskeny ablaknál) vagy az oldalt, a
// fixed menük már nem lennének a gombjuk alatt — ilyenkor egyszerűbb bezárni őket,
// mint élőben újraszámolni a pozíciójukat.
document.getElementById('topbar').addEventListener('scroll', () => { closeDownloadMenu(); closeProfileMenu(); });
window.addEventListener('resize', () => { closeDownloadMenu(); closeProfileMenu(); });
async function confirmDownload() {
  const optimize = document.getElementById('dl-optimize-images').checked;
  closeDownloadMenu();
  await buildAndDownload(optimize);
}
async function confirmPrint() {
  closeDownloadMenu();
  await printDocument();
}
async function confirmDownloadZip() {
  closeDownloadMenu();
  await downloadMarkdownZip();
}
