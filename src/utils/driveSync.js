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

const ADMIN_PASSWORD_HASH_KEY = 'szmc_admin_hash';
const ADMIN_SESSION_KEY = 'szmc_admin_session';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'szmc_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function setAdminPassword(password) {
  const hash = await hashPassword(password);
  localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, hash);
  return hash;
}

export async function checkAdminPassword(password) {
  const storedHash = localStorage.getItem(ADMIN_PASSWORD_HASH_KEY);
  if (!storedHash) {
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

export function isAdminLoggedIn() {
  const session = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!session) return false;
  const elapsed = Date.now() - parseInt(session, 10);
  return elapsed < 8 * 60 * 60 * 1000;
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}
