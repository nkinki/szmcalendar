/**
 * Facebook ZIP import script
 * 
 * Feldolgozza a Facebook "Adatok letöltése" ZIP tartalmát és
 * létrehozza a public/scraped_data.json fájlt az app számára.
 * 
 * Használat:
 *   node scripts/import_facebook.js <facebook_zip_mappa>
 * 
 * Példa:
 *   node scripts/import_facebook.js "C:\Users\Teacher\.gemini\calendar\face"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix Facebook's broken UTF-8 encoding (they export Latin1 as UTF-8)
function fixEncoding(str) {
  if (!str) return '';
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

// Convert Unix timestamp to ISO date string
function tsToDate(ts) {
  return new Date(ts * 1000).toISOString().split('T')[0]; // YYYY-MM-DD
}

// Convert Unix timestamp to Hungarian display date
function tsToHuDate(ts) {
  const d = new Date(ts * 1000);
  const months = ['január','február','március','április','május','június',
                  'július','augusztus','szeptember','október','november','december'];
  return `${d.getFullYear()}. ${months[d.getMonth()]} ${d.getDate()}.`;
}

// Determine school year from date
function schoolYear(dateStr) {
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 9 ? `${y}/${y+1}` : `${y-1}/${y}`;
}

// Copy image to public/scraped_images and return relative path
function copyImage(srcPath, destDir) {
  if (!fs.existsSync(srcPath)) return null;
  const ext = path.extname(srcPath) || '.jpg';
  const filename = `fb_${Date.now()}_${Math.floor(Math.random()*99999)}${ext}`;
  const destPath = path.join(destDir, filename);
  try {
    fs.copyFileSync(srcPath, destPath);
    return `scraped_images/${filename}`;
  } catch {
    return null;
  }
}

async function run() {
  const faceDir = process.argv[2] || path.join(__dirname, '..', 'face');
  
  if (!fs.existsSync(faceDir)) {
    console.error(`❌ Nem található a mappa: ${faceDir}`);
    console.error('Használat: node scripts/import_facebook.js <facebook_zip_mappa>');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('   FACEBOOK ZIP IMPORTÁLÓ                          ');
  console.log('====================================================');
  console.log(`📁 Forrás mappa: ${faceDir}\n`);

  // Setup output dirs
  const publicDir = path.join(__dirname, '..', 'public');
  const imagesDir = path.join(publicDir, 'scraped_images');
  fs.mkdirSync(imagesDir, { recursive: true });

  // Find all JSON post files — support both old and new Facebook export formats
  let postsDir = path.join(faceDir, "this_profile's_activity_across_facebook", 'posts');
  if (!fs.existsSync(postsDir)) {
    postsDir = path.join(faceDir, 'your_facebook_activity', 'posts');
  }

  if (!fs.existsSync(postsDir)) {
    console.error(`❌ Nem található a posts mappa egyik formátumban sem:`);
    console.error(`   - ${path.join(faceDir, "this_profile's_activity_across_facebook", 'posts')}`);
    console.error(`   - ${path.join(faceDir, 'your_facebook_activity', 'posts')}`);
    process.exit(1);
  }

  // Collect all post JSON files
  const jsonFiles = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.json') && !f.includes('uncategorized') && !f.includes('editor'))
    .map(f => path.join(postsDir, f));

  // Also check album subfolder
  const albumDir = path.join(postsDir, 'album');
  if (fs.existsSync(albumDir)) {
    fs.readdirSync(albumDir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => jsonFiles.push(path.join(albumDir, f)));
  }

  console.log(`📄 Feldolgozandó JSON fájlok: ${jsonFiles.length}`);

  const allPosts = [];
  const seenTs = new Set();

  for (const jsonFile of jsonFiles) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    } catch (e) {
      console.warn(`  ⚠ Nem olvasható: ${path.basename(jsonFile)}`);
      continue;
    }

    if (!Array.isArray(data)) continue;

    for (const post of data) {
      const ts = post.timestamp;
      if (!ts || seenTs.has(ts)) continue;
      seenTs.add(ts);

      // Extract text - try multiple field names
      let text = '';
      if (post.title) text = fixEncoding(post.title);
      if (post.data) {
        // data can be array or object
        const dataArr = Array.isArray(post.data) ? post.data : Object.values(post.data);
        for (const item of dataArr) {
          if (item.post) { text = fixEncoding(item.post); break; }
          if (item.text) { text = fixEncoding(item.text); break; }
        }
      }

      // Extract image URIs from attachments
      const imageUris = [];
      if (post.attachments) {
        for (const att of post.attachments) {
          if (!att.data) continue;
          const attData = Array.isArray(att.data) ? att.data : Object.values(att.data);
          for (const item of attData) {
            if (item.media && item.media.uri) {
              imageUris.push(item.media.uri);
            }
          }
        }
      }

      // Copy images to public/scraped_images
      const localImages = [];
      for (const uri of imageUris.slice(0, 6)) { // max 6 per post
        // URI is relative to the faceDir
        const srcPath = path.join(faceDir, uri);
        const localPath = copyImage(srcPath, imagesDir);
        if (localPath) {
          localImages.push(localPath);
          process.stdout.write('.');
        }
      }

      // Skip posts with no meaningful content
      if (!text && localImages.length === 0) continue;

      // Skip very short "filler" titles like "X új fényképet töltött fel"
      const isAutoTitle = /\d+\s+(új|new)\s+/i.test(text) && localImages.length > 0;

      const dateSort = tsToDate(ts);
      const date = tsToHuDate(ts);
      const sy = schoolYear(dateSort);

      allPosts.push({
        id: `fb_${ts}`,
        url: '',
        date,
        dateSort,
        schoolYear: sy,
        text: isAutoTitle ? '' : text, // clear auto-generated titles
        images: localImages,
      });
    }
  }

  // ── Merge with previously imported data (don't lose older exports) ──────────
  const outPath = path.join(publicDir, 'scraped_data.json');
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (Array.isArray(prev)) {
        const knownIds = new Set(allPosts.map(p => p.id));
        const kept = prev.filter(p => p && p.id && !knownIds.has(p.id));
        if (kept.length > 0) {
          console.log(`\n🔗 Meglévő adatlap megőrizve: ${kept.length} korábbi poszt`);
          allPosts.push(...kept);
        }
      }
    } catch {
      console.warn('⚠ Korábbi scraped_data.json nem olvasható, felülíródik.');
    }
  }

  // Sort by date descending
  allPosts.sort((a, b) => b.dateSort.localeCompare(a.dateSort));

  console.log(`\n\n✅ Feldolgozott posztok: ${allPosts.length}`);
  
  // Count images
  const totalImages = allPosts.reduce((sum, p) => sum + p.images.length, 0);
  console.log(`🖼  Másolt képek: ${totalImages}`);

  // Show school years breakdown
  const syMap = {};
  allPosts.forEach(p => { syMap[p.schoolYear] = (syMap[p.schoolYear] || 0) + 1; });
  console.log('\n📅 Tanévek:');
  Object.entries(syMap).sort((a,b) => b[0].localeCompare(a[0])).forEach(([sy, count]) => {
    console.log(`   ${sy}: ${count} poszt`);
  });

  // Save to public/scraped_data.json
  fs.writeFileSync(outPath, JSON.stringify(allPosts, null, 2), 'utf-8');
  console.log(`\n💾 Mentve: ${outPath}`);

  // Also save the book-ready format for direct localStorage import
  // Generate the bookData events array
  const bookEvents = allPosts.map(p => ({
    id: p.id,
    schoolYear: p.schoolYear,
    date: p.date,
    dateSort: p.dateSort,
    text: p.text,
    images: p.images,
  }));

  const bookDataPath = path.join(publicDir, 'book_events.json');
  fs.writeFileSync(bookDataPath, JSON.stringify(bookEvents, null, 2), 'utf-8');
  console.log(`💾 Könyv adatok: ${bookDataPath}`);

  console.log('\n====================================================');
  console.log('  IMPORT KÉSZ! Nyisd meg az appot és töltsd be.    ');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Váratlan hiba:', err.message);
  process.exit(1);
});
