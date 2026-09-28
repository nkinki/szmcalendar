import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans); }));
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mbasic.facebook.com/'
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close(); fs.unlink(filepath, () => {});
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close(); fs.unlink(filepath, () => {});
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    request.on('error', (err) => { file.close(); fs.unlink(filepath, () => {}); reject(err); });
    request.setTimeout(20000, () => { request.destroy(); file.close(); fs.unlink(filepath, () => {}); reject(new Error('Timeout')); });
  });
}

async function run() {
  console.log('====================================================');
  console.log('   FACEBOOK SCRAPER v4.0 - mbasic.facebook.com    ');
  console.log('====================================================\n');

  // Get page name from args or ask
  let pageName = process.argv[2];
  let maxPosts = parseInt(process.argv[3], 10) || 50;

  if (!pageName) {
    const input = await askQuestion('Facebook oldal neve vagy URL-je (pl. szentmihaly.iskola): ');
    pageName = input.trim().replace('https://www.facebook.com/', '').replace('https://mbasic.facebook.com/', '').replace(/\/$/, '');
    const mc = await askQuestion('Max hány posztot töltsön le? (alapért.: 50): ');
    maxPosts = parseInt(mc, 10) || 50;
  } else {
    // extract page name from full URL if provided
    pageName = pageName.replace('https://www.facebook.com/', '').replace('https://mbasic.facebook.com/', '').replace(/\/$/, '');
  }

  const mbasicUrl = `https://mbasic.facebook.com/${pageName}`;
  console.log(`\nCél: ${mbasicUrl}`);
  console.log(`Max posztok: ${maxPosts}\n`);

  // Setup dirs
  const publicDir = path.join(__dirname, '..', 'public');
  const imagesDir = path.join(publicDir, 'scraped_images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const userDataDir = path.join(__dirname, '..', 'browser-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  console.log('Böngésző indítása...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-notifications', '--no-sandbox'],
    viewport: { width: 480, height: 800 }, // mobile viewport for mbasic
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    locale: 'hu-HU',
  });

  const page = await context.newPage();

  console.log('mbasic.facebook.com megnyitása...');
  await page.goto(mbasicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if login is needed
  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
    console.log('\n⚠ Bejelentkezés szükséges!');
    console.log('Kérlek jelentkezz be a böngészőben, majd nyomj ENTER-t.');
    await askQuestion('ENTER megnyomása után folytatjuk...');
    await page.goto(mbasicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  // Accept cookies if needed
  try {
    const acceptBtn = await page.$('button[value="1"]');
    if (acceptBtn) { await acceptBtn.click(); await page.waitForTimeout(1000); }
  } catch {}

  console.log('\n----------------------------------------------------');
  console.log('Ha látod az oldal posztjait, nyomj ENTER-t.');
  console.log('----------------------------------------------------');
  await askQuestion('');

  const postsData = [];
  const seenUrls = new Set();
  const dataPath = path.join(publicDir, 'scraped_data.json');
  let totalImages = 0;
  let currentUrl2 = mbasicUrl;

  while (postsData.length < maxPosts) {
    console.log(`\nOldal betöltése... (${postsData.length}/${maxPosts} poszt eddig)`);
    
    if (currentUrl2 !== page.url()) {
      await page.goto(currentUrl2, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    }

    // Extract all post links and data from current mbasic page
    const pageData = await page.evaluate(() => {
      const results = [];

      // mbasic Facebook structure:
      // Each post is in a div with id like "u_0_X" or article tags
      // Post links look like /story.php?story_fbid=... or /permalink/...
      
      // Find all story links (these are the individual post links)
      const storyLinks = new Set();
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href || '';
        if (
          (href.includes('story_fbid') || href.includes('/posts/') || href.includes('permalink')) &&
          !href.includes('comment') &&
          !href.includes('reply') &&
          !href.includes('like') &&
          !href.includes('reaction')
        ) {
          // Clean URL
          try {
            const u = new URL(href);
            // Keep only story_fbid and id params
            const clean = `${u.origin}${u.pathname}?${u.searchParams.get('story_fbid') ? 'story_fbid=' + u.searchParams.get('story_fbid') + '&id=' + u.searchParams.get('id') : u.search.slice(1)}`;
            storyLinks.add(clean.replace('www.facebook.com', 'mbasic.facebook.com'));
          } catch {
            storyLinks.add(href.split('&__')[0].replace('www.facebook.com', 'mbasic.facebook.com'));
          }
        }
      });

      // Find "More posts" / "Korábbi bejegyzések" link for pagination
      let nextPageUrl = null;
      document.querySelectorAll('a').forEach(a => {
        const text = (a.innerText || '').toLowerCase();
        const href = a.href || '';
        if (
          (text.includes('korábbi') || text.includes('more posts') || text.includes('older') || text.includes('következő') || text.includes('see more')) &&
          href.includes('facebook.com')
        ) {
          nextPageUrl = href.replace('www.facebook.com', 'mbasic.facebook.com');
        }
      });

      return { storyLinks: Array.from(storyLinks), nextPageUrl };
    });

    console.log(`  Talált poszt linkek: ${pageData.storyLinks.length}`);

    // Visit each post page to get full content
    for (const storyUrl of pageData.storyLinks) {
      if (seenUrls.has(storyUrl)) continue;
      if (postsData.length >= maxPosts) break;
      seenUrls.add(storyUrl);

      console.log(`\n  📄 Poszt: ${storyUrl.substring(0, 80)}`);

      try {
        await page.goto(storyUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);

        const postContent = await page.evaluate(() => {
          // mbasic has very clean HTML structure
          
          // Date: usually in a span or abbr near the top
          let dateText = '';
          const abbr = document.querySelector('abbr');
          if (abbr) dateText = abbr.innerText || abbr.title || '';
          
          if (!dateText) {
            // Look for date-like text in small/span elements
            document.querySelectorAll('abbr, [data-sigil="timestamp"]').forEach(el => {
              if (!dateText) dateText = el.getAttribute('data-utime') ? 
                new Date(parseInt(el.getAttribute('data-utime')) * 1000).toLocaleDateString('hu-HU') :
                el.innerText || '';
            });
          }

          // Text: main post content
          // In mbasic, post text is usually in a div with class "story_body_container" or similar
          let textContent = '';
          
          // Try finding the main content area
          const storyBody = document.querySelector('[data-sigil="m-story-body"]') ||
                           document.querySelector('.story_body_container') ||
                           document.querySelector('[id^="u_0_"]');
          
          if (storyBody) {
            // Get all text paragraphs, skip navigation elements
            const paras = Array.from(storyBody.querySelectorAll('p, div[dir]'));
            textContent = paras.map(p => p.innerText).filter(t => t && t.length > 5).join('\n');
          }

          // Fallback: largest text block on page
          if (!textContent || textContent.length < 20) {
            const allDivs = Array.from(document.querySelectorAll('div, p'));
            const candidates = allDivs
              .map(d => (d.innerText || '').trim())
              .filter(t => t.length > 30 && t.length < 5000);
            if (candidates.length > 0) {
              textContent = candidates.reduce((a, b) => a.length > b.length ? a : b, '');
            }
          }

          // Images: mbasic shows actual img tags with full URLs
          const images = [];
          const seen = new Set();
          document.querySelectorAll('img').forEach(img => {
            const src = img.src || '';
            if (!src || src.startsWith('data:') || src.endsWith('.gif')) return;
            
            // Skip small images (icons, avatars) - check rendered size
            const w = img.width || img.naturalWidth || 0;
            const h = img.height || img.naturalHeight || 0;
            if ((w > 0 && w < 100) || (h > 0 && h < 100)) return;
            
            // Only Facebook CDN images
            if (!src.includes('fbcdn') && !src.includes('scontent') && !src.includes('fbsbx')) return;
            
            const baseUrl = src.split('?')[0];
            if (seen.has(baseUrl)) return;
            seen.add(baseUrl);
            images.push(src);
          });

          return { date: dateText.trim(), text: textContent.trim(), images };
        });

        console.log(`    📅 ${postContent.date || 'nincs dátum'}`);
        console.log(`    📝 ${postContent.text ? postContent.text.substring(0, 80) + '...' : '(üres)'}`);
        console.log(`    🖼  ${postContent.images.length} kép`);

        // Download images
        const localImages = [];
        for (let idx = 0; idx < postContent.images.length; idx++) {
          const imgUrl = postContent.images[idx];
          const ext = imgUrl.includes('.png') ? '.png' : imgUrl.includes('.webp') ? '.webp' : '.jpg';
          const filename = `post_${Date.now()}_${Math.floor(Math.random() * 9999)}_${idx}${ext}`;
          const filepath = path.join(imagesDir, filename);
          try {
            process.stdout.write(`    -> Kép ${idx + 1} letöltése...`);
            await downloadImage(imgUrl, filepath);
            localImages.push(`scraped_images/${filename}`);
            totalImages++;
            process.stdout.write(' ✓\n');
          } catch (err) {
            process.stdout.write(` ✗ (${err.message})\n`);
          }
        }

        if (postContent.text || localImages.length > 0) {
          postsData.push({
            id: storyUrl,
            url: storyUrl,
            date: postContent.date,
            text: postContent.text,
            images: localImages,
          });

          // Save progress
          fs.writeFileSync(dataPath, JSON.stringify(postsData, null, 2), 'utf-8');
          try {
            fs.writeFileSync(
              path.join(__dirname, '..', 'ai_inputs', 'scraped_data.json'),
              JSON.stringify(postsData, null, 2), 'utf-8'
            );
          } catch {}
        }

      } catch (err) {
        console.error(`    ✗ Hiba: ${err.message}`);
      }

      await page.waitForTimeout(1000 + Math.random() * 500);
    }

    // Go to next page if available
    if (pageData.nextPageUrl && postsData.length < maxPosts) {
      console.log(`\n  → Következő oldal: ${pageData.nextPageUrl.substring(0, 70)}`);
      currentUrl2 = pageData.nextPageUrl;
      await page.waitForTimeout(2000);
    } else {
      console.log('\n  Nincs több oldal vagy elértük a limitet.');
      break;
    }
  }

  console.log('\n====================================================');
  console.log('              LETÖLTÉS KÉSZ!                        ');
  console.log('====================================================');
  console.log(`  Posztok: ${postsData.length}`);
  console.log(`  Képek:   ${totalImages}`);
  console.log('====================================================\n');

  await context.close();
}

run().catch(err => {
  console.error('\nVáratlan hiba:', err.message);
  process.exit(1);
});
