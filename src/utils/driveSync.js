/**
 * driveSync.js
 * Google Drive publikus mappa olvasás + admin auth
 *
 * Architektúra:
 * - Olvasás: Drive API v3 publikus lekérés (API key-vel, nincs bejelentkezés)
 * - Írás: admin jelszóval védett, Drive API OAuth nélkül →
 *         az admin letölti / feltölti manuálisan VAGY
 *         Google Apps Script webhook-on keresztül (opcionális)
 *
 * A mappa ID a Drive linkből: /folders/FOLDER_ID
 */

export const DRIVE_FOLDER_ID = '1QZRHWec4VW62TLH9vHrNiFa-cQeWKxcM';

// A Drive API publikus lekéréshez kell egy API key (csak olvasás, ingyenes)
// Ezt a Vercel env változóból veszi, vagy ide írhatod
export const DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

const ADMIN_PASSWORD_HASH_KEY = 'szmc_admin_hash';
const ADMIN_SESSION_KEY = 'szmc_admin_session';

// ── Admin Auth ──────────────────────────────────────────────────────────────

/** SHA-256 hash a jelszóból */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'szmc_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Admin jelszó beállítása (első alkalommal) */
export async function setAdminPassword(password) {
  const hash = await hashPassword(password);
  localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, hash);
  return hash;
}

/** Admin bejelentkezés ellenőrzése */
export async function checkAdminPassword(password) {
  const storedHash = localStorage.getItem(ADMIN_PASSWORD_HASH_KEY);
  if (!storedHash) {
    // Nincs még jelszó beállítva — első bejelentkezés beállítja
    await setAdminPassword(password);
    localStorage.setItem(ADMIN_SESSION_KEY, Date.now().toString());
    return true;
  }
  const inputHash = await hashPassword(password);
  if (inputHash === storedHash) {
    localStorage.setItem(ADMIN_SESSION_KEY, Date.now().toString());
    return true;
  }
  return false;
}

/** Admin session ellenőrzése (8 órás lejárat) */
export function isAdminLoggedIn() {
  const session = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!session) return false;
  const elapsed = Date.now() - parseInt(session, 10);
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  return elapsed < EIGHT_HOURS;
}

/** Admin kijelentkezés */
export function adminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

// ── Drive olvasás ───────────────────────────────────────────────────────────

/**
 * Drive mappa fájllistájának lekérése
 * Csak publikusan megosztott mappáknál működik API key-vel
 */
export async function listDriveFolder(folderId = DRIVE_FOLDER_ID) {
  if (!DRIVE_API_KEY) {
    throw new Error('VITE_GOOGLE_API_KEY nincs beállítva');
  }
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${DRIVE_API_KEY}&fields=files(id,name,mimeType,size,modifiedTime,webContentLink,webViewLink)`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive API hiba: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

/**
 * Drive fájl tartalmának letöltése (publikus)
 */
export async function downloadDriveFile(fileId) {
  if (!DRIVE_API_KEY) throw new Error('VITE_GOOGLE_API_KEY nincs beállítva');
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${DRIVE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Letöltési hiba: ${res.status}`);
  return res;
}

/**
 * book_events.json betöltése a Drive mappából
 */
export async function loadBookDataFromDrive(folderId = DRIVE_FOLDER_ID) {
  const files = await listDriveFolder(folderId);
  const jsonFile = files.find(f =>
    f.name === 'book_events.json' ||
    f.name === 'bookdata.json' ||
    f.mimeType === 'application/json'
  );
  if (!jsonFile) throw new Error('Nem találtam book_events.json fájlt a Drive mappában');

  const res = await downloadDriveFile(jsonFile.id);
  const text = await res.text();
  return JSON.parse(text);
}

/**
 * Kép URL generálása Drive fájlból (publikus thumbnail / direct link)
 * A Drive direct image link: https://drive.google.com/uc?export=view&id=FILE_ID
 */
export function getDriveImageUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function getDriveThumbnailUrl(fileId, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * Képfájlok listázása egy almappából
 */
export async function listDriveImages(folderId) {
  const files = await listDriveFolder(folderId);
  return files
    .filter(f => f.mimeType?.startsWith('image/'))
    .map(f => ({
      id: f.id,
      name: f.name,
      url: getDriveImageUrl(f.id),
      thumbnail: getDriveThumbnailUrl(f.id),
    }));
}
