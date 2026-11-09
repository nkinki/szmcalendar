/**
 * driveSync.js
 * Google Drive betöltés (API key nélkül, publikus fájl) + admin auth
 */

export const DRIVE_FOLDER_ID = '1QZRHWec4VW62TLH9vHrNiFa-cQeWKxcM';
export const DRIVE_BOOK_EVENTS_ID = '1WMaBr4KlnLcvfHOZ-T8QgF1-eWIEix1w';

// ── Drive betöltés (API key nélkül) ────────────────────────────────────────

export async function loadBookDataFromDrive() {
  const url = `https://drive.google.com/uc?export=download&id=${DRIVE_BOOK_EVENTS_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive letöltési hiba: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Érvénytelen adat formátum');
  return data;
}

// ── Admin Auth ──────────────────────────────────────────────────────────────

// Admin jelszó hash — kódba égetett, nem módosítható böngészőből
// Ha jelszót szeretnél változtatni, generálj új hash-t és cseréld le itt
const HARDCODED_ADMIN_HASH = 'efb93c9827841192e228b370fa7b10cf5e923f3cd88407f852116abce943a826';

const ADMIN_SESSION_KEY = 'szmc_admin_session';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'szmc_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function checkAdminPassword(password) {
  const inputHash = await hashPassword(password);
  if (inputHash === HARDCODED_ADMIN_HASH) {
    localStorage.setItem(ADMIN_SESSION_KEY, Date.now().toString());
    return true;
  }
  return false;
}

export async function setAdminPassword(password) {
  // Csak hash megjelenítésre — a kódban kell lecserélni
  return hashPassword(password);
}

export function isAdminLoggedIn() {
  const session = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!session) return false;
  const elapsed = Date.now() - parseInt(session, 10);
  return elapsed < 8 * 60 * 60 * 1000;
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}
