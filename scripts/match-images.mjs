// match-images.mjs
// Drive fájl ID-k összekapcsolása a Facebook posztok képeivel
import { readFileSync, writeFileSync } from 'fs';

const EVENTS_FILE = 'C:/Users/Teacher/.gemini/calendar/public/book_events.json';
const DRIVE_FILES = 'C:/Users/Teacher/.gemini/calendar/scripts/drive_files.json';
const OUT = 'C:/Users/Teacher/.gemini/calendar/public/book_events.json';

const events = JSON.parse(readFileSync(EVENTS_FILE, 'utf8'));
const driveFiles = JSON.parse(readFileSync(DRIVE_FILES, 'utf8'));

// Drive fájlok map: path (kisbetűs) -> id
const driveMap = new Map();
for (const f of driveFiles) {
  const normalized = f.path.toLowerCase().replace(/\\/g, '/');
  driveMap.set(normalized, f.id);
  // Csak fájlnév alapján is
  const basename = f.name.toLowerCase();
  if (!driveMap.has(basename)) driveMap.set(basename, f.id);
}

let matched = 0;
let notFound = 0;

const updated = events.map(evt => {
  if (!evt.imageUris || evt.imageUris.length === 0) return evt;

  const images = [];
  for (const uri of evt.imageUris) {
    // Csak képek, videók nélkül
    if (uri.match(/\.(mp4|mov|avi|mkv)$/i)) continue;

    const normalized = uri.toLowerCase().replace(/\\/g, '/');
    
    // Teljes path egyezés
    let driveId = driveMap.get('/' + normalized) || driveMap.get(normalized);
    
    // Csak fájlnév alapján
    if (!driveId) {
      const basename = normalized.split('/').pop();
      driveId = driveMap.get(basename);
    }

    if (driveId) {
      images.push({
        url: `https://drive.google.com/uc?export=view&id=${driveId}`,
        thumbnail: `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`,
        driveId,
        enabled: true,
      });
      matched++;
    } else {
      notFound++;
    }
  }

  return { ...evt, images, imageUris: undefined };
});

// imageUris eltávolítása (csak belső referencia volt)
const clean = updated.map(e => {
  const { imageUris, ...rest } = e;
  return rest;
});

writeFileSync(OUT, JSON.stringify(clean, null, 2), 'utf8');

console.log('✅ Kész!');
console.log(`   Egyezett: ${matched} kép`);
console.log(`   Nem talált: ${notFound} kép`);
console.log(`   Képes posztok: ${clean.filter(e => e.images?.length > 0).length}`);
console.log(`   Fájl méret: ${(JSON.stringify(clean).length / 1024).toFixed(1)} KB`);
