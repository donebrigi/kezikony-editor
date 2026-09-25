// ── Képek: külön fájlként a felhőben ──────────────────────────────────────────
//
// A képek NEM base64-szövegként ülnek a markdownban, hanem a Dokumentum mappájában:
//   {projektId}/{dokumentumId}/images/{hash}.webp
// A markdownban csak egy rövid hivatkozás áll:  ![alt](images/3f9a…c2.webp)
//
// • Előnézet: a hivatkozott képeket egyszer letöltjük, és blob: URL-ként gyorsítótárazzuk.
// • Build (⬇ HTML): a képek data: URI-ként beágyazódnak, így a kész HTML önálló marad.
// • Régi dokumentumok: a megnyitáskor talált base64 képeket automatikusan kiszervezzük.
//
// A fájlnév a kép tartalmának hash-e, így ugyanaz a kép kétszer beillesztve sem
// foglal kétszer helyet.

const IMAGE_DIR = 'images/';
const IMG_MAX_WIDTH = 1440;
const IMG_QUALITY = 0.85;
const IMAGE_REF_RE = /images\/[A-Za-z0-9._-]+/g;

// path ('images/x.webp') → { url, promise } — dokumentumonként külön (folderId kulccsal)
const _imageCache = new Map();
function imageCacheKey(proj, path) { return proj.cloudFolder + '|' + path; }

function isImageRef(src) { return typeof src === 'string' && src.startsWith(IMAGE_DIR); }

async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Tömörítés beillesztéskor: raszteres kép → WebP, max 1440px széles. SVG/GIF változatlan.
async function compressImageBlob(file) {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width, h = bitmap.height;
    if (w > IMG_MAX_WIDTH) { h = Math.round(h * IMG_MAX_WIDTH / w); w = IMG_MAX_WIDTH; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const webp = await new Promise(res => canvas.toBlob(res, 'image/webp', IMG_QUALITY));
    // Ha a böngésző nem tud WebP-t kódolni, PNG jön vissza — az is jó (a méretkorlát érvényesült).
    if (webp && webp.size < file.size) return webp;
  } catch(e) {
    console.warn('Kép tömörítés sikertelen, eredeti fájl marad:', e);
  }
  return file;
}

function extForType(type) {
  return ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[type] || 'png';
}

// Egy kép feltöltése a Dokumentum images/ mappájába. Visszatérés: 'images/…' vagy null.
async function uploadImage(proj, fileOrBlob, { compress = true } = {}) {
  if (!proj || !proj.cloudFolder) return null;
  const blob = compress ? await compressImageBlob(fileOrBlob) : fileOrBlob;
  const type = blob.type || 'image/png';
  const path = IMAGE_DIR + (await sha256Hex(blob)).slice(0, 20) + '.' + extForType(type);
  const key = imageCacheKey(proj, path);
  if (!_imageCache.has(key)) {
    const ok = await cloudUpload(proj.cloudFolder + '/' + path, blob, type);
    if (!ok) return null;
    _imageCache.set(key, { url: URL.createObjectURL(blob), blob, promise: Promise.resolve() });
  }
  return path;
}

// A kép blob: URL-je (az előnézethez). Ha még nincs letöltve, elindítja a letöltést.
function getImageUrl(proj, path, onLoaded) {
  const key = imageCacheKey(proj, path);
  let entry = _imageCache.get(key);
  if (!entry) {
    entry = { url: null, blob: null };
    entry.promise = cloudDownloadBlob(proj.cloudFolder + '/' + path).then(blob => {
      if (blob) { entry.blob = blob; entry.url = URL.createObjectURL(blob); }
      else entry.missing = true;
    });
    _imageCache.set(key, entry);
  }
  if (!entry.url && onLoaded) entry.promise.then(onLoaded);
  return entry.url;
}

async function getImageBlob(proj, path) {
  getImageUrl(proj, path);
  const entry = _imageCache.get(imageCacheKey(proj, path));
  await entry.promise;
  return entry.blob;
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const type = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Egy HTML-ben lévő  src="images/…"  hivatkozások cseréje.
//  mode 'preview': blob: URL (ha még nincs meg, egy átlátszó helykitöltő + onLoaded újrarajzol)
//  mode 'build':   data: URI (megvárja a letöltést)
const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
function resolveImagesPreview(html, proj, onLoaded) {
  if (!proj || !proj.cloudFolder) return html;
  return html.replace(/src="(images\/[^"]+)"/g, (m, path) => {
    const url = getImageUrl(proj, path);
    if (url) return `src="${url}" data-path="${path}"`;
    const entry = _imageCache.get(imageCacheKey(proj, path));
    if (entry.missing) return `src="${BLANK_PIXEL}" data-missing="${path}"`;
    // Még töltődik: helykitöltő, és ha megjött, újrarajzolás (a hívó ütemezi/összevonja).
    entry.promise.then(() => onLoaded && onLoaded());
    return `src="${BLANK_PIXEL}"`;
  });
}

async function resolveImagesBuild(html, proj) {
  const paths = [...new Set((html.match(/src="images\/[^"]+"/g) || []).map(m => m.slice(5, -1)))];
  const map = {};
  for (const p of paths) {
    const blob = await getImageBlob(proj, p);
    if (blob) map[p] = await blobToDataUrl(blob);
  }
  return html.replace(/src="(images\/[^"]+)"/g, (m, p) => map[p] ? `src="${map[p]}"` : m);
}

// Markdown szöveg: images/… hivatkozások → beágyazott data: URI (egyedi .md letöltéshez).
async function inlineImagesInMarkdown(md, proj) {
  const paths = [...new Set(md.match(IMAGE_REF_RE) || [])];
  for (const p of paths) {
    const blob = await getImageBlob(proj, p);
    if (!blob) continue;
    const dataUrl = await blobToDataUrl(blob);
    md = md.split('(' + p + ')').join('(' + dataUrl + ')');
  }
  return md;
}

// ── Régi, base64 képek kiszervezése ──────────────────────────────────────────
const DATA_IMG_RE = /\((data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+)\)/g;

function countEmbeddedImages(md) { return ((md || '').match(DATA_IMG_RE) || []).length; }

// Egy markdown szövegben lévő összes base64 képet feltölti és hivatkozásra cseréli.
// Visszatérés: az új szöveg, vagy null, ha bármelyik feltöltés sikertelen volt (ilyenkor
// az eredeti szöveg marad, nehogy adat vesszen el).
async function externalizeImagesInMarkdown(md, proj) {
  const found = [...new Set([...(md || '').matchAll(DATA_IMG_RE)].map(m => m[1]))];
  if (!found.length) return md;
  let out = md;
  for (const dataUrl of found) {
    // Tömörítés nélkül töltjük fel: a régi képek már a beillesztéskor tömörítve lettek.
    const path = await uploadImage(proj, dataUrlToBlob(dataUrl.replace(/\s/g, '')), { compress: false });
    if (!path) return null;
    out = out.split('(' + dataUrl + ')').join('(' + path + ')');
  }
  return out;
}

// Egy másik Dokumentumból átmásolt fejezet képeinek átmásolása ide.
async function copyImagesBetweenDocs(md, fromFolder, toProj) {
  const paths = [...new Set((md || '').match(IMAGE_REF_RE) || [])];
  for (const p of paths) {
    const blob = await cloudDownloadBlob(fromFolder + '/' + p);
    if (blob) await cloudUpload(toProj.cloudFolder + '/' + p, blob, blob.type || guessContentType(p));
  }
}
