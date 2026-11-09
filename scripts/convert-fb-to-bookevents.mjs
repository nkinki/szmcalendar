// convert-fb-to-bookevents.mjs
// Facebook export → book_events.json konverter
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const FB_JSON = 'C:/Users/Teacher/.gemini/calendar/face/facebook-szentmihalyiskola-2026. 08. 24.-Y98ZWp2p/your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json';
const OUT = 'C:/Users/Teacher/.gemini/calendar/public/book_events.json';

// Mojibake javítás (Facebook latin-1 kódolás)
function fixMojibake(str) {
  if (typeof str !== 'string' || !/[ÃÂ]/.test(str)) return str;
  try {
    const bytes = Uint8Array.from(str, c => c.charCodeAt(0) & 0xff);
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return fixed.includes('') ? str : fixed;
  } catch {
    return str;
  }
}

function fixAll(val) {
  if (Array.isArray(val)) return val.map(fixAll);
  if (val && typeof val === 'object') return Object.fromEntries(Object.entries(val).map(([k,v]) => [k, fixAll(v)]));
  return typeof val === 'string' ? fixMojibake(val) : val;
}

function getSchoolYear(ts) {
  const d = new Date(ts * 1000);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 9 ? `${y}/${y+1}` : `${y-1}/${y}`;
}

const raw = JSON.parse(readFileSync(FB_JSON, 'utf8'));
const posts = Array.isArray(raw) ? raw : [raw];

const FILLER = [
  /megosztott egy bejegyzést/i,
  /megosztott egy posztot/i,
  /új fényképet töltött fel/i,
  /fényképeket töltött fel/i,
  /új bejegyzést írt/i,
  /feltöltött egy videót/i,
  /^Szent Mihály$/i,
];

function cleanText(text) {
  if (!text) return '';
  const lines = text.split('\n').filter(line => {
    const t = line.trim();
    return t && !FILLER.some(p => p.test(t));
  });
  return lines.join('\n').trim();
}

const events = [];

for (const post of posts) {
  const fixed = fixAll(post);
  const ts = fixed.timestamp || fixed.creation_timestamp;
  if (!ts) continue;

  const date = new Date(ts * 1000);
  const dateSort = date.toISOString().split('T')[0];
  const dateHu = date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  const schoolYear = getSchoolYear(ts);

  // Szöveg összegyűjtése
  const textParts = [];
  if (fixed.title) textParts.push(fixed.title);
  if (fixed.data) {
    const items = Array.isArray(fixed.data) ? fixed.data : Object.values(fixed.data);
    for (const item of items) {
      if (item.post) textParts.push(item.post);
      if (item.text) textParts.push(item.text);
    }
  }
  const rawText = textParts.join('\n\n');
  const text = cleanText(rawText);

  // Képek összegyűjtése (csak Drive-ra kerülők URI-jai)
  const imageUris = [];
  if (fixed.attachments) {
    const atts = Array.isArray(fixed.attachments) ? fixed.attachments : [fixed.attachments];
    for (const att of atts) {
      const attData = Array.isArray(att.data) ? att.data : Object.values(att.data || {});
      for (const item of attData) {
        if (item.media?.uri) imageUris.push(item.media.uri);
      }
    }
  }

  if (!text && imageUris.length === 0) continue;

  events.push({
    id: `fb_${ts}_${events.length}`,
    schoolYear,
    date: dateHu,
    dateSort,
    text,
    images: [], // képek Drive-on lesznek, később töltjük be
    imageUris,  // eredeti FB URI-k (referencia)
  });
}

// Tanév szerinti rendezés
events.sort((a, b) => b.dateSort.localeCompare(a.dateSort));

console.log(`✅ ${events.length} esemény konvertálva`);
const years = [...new Set(events.map(e => e.schoolYear))].sort();
years.forEach(y => {
  const count = events.filter(e => e.schoolYear === y).length;
  console.log(`   ${y}: ${count} esemény`);
});

writeFileSync(OUT, JSON.stringify(events, null, 2), 'utf8');
console.log(`\n📁 Mentve: ${OUT}`);
console.log(`📊 Fájl méret: ${(JSON.stringify(events).length / 1024).toFixed(1)} KB`);
