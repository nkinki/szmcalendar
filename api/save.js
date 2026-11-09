// api/save.js — Vercel Serverless Function
// Admin mentés: book_events.json feltöltése GitHub-ra
// POST /api/save { events: [...], adminToken: '...' }

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'nkinki';
const GITHUB_REPO = 'szmcalendar';
const FILE_PATH = 'public/book_events.json';
const BRANCH = 'master';

// Admin token hash ellenőrzés (ugyanaz mint a frontenden)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'szmc_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const ADMIN_HASH = 'efb93c9827841192e228b370fa7b10cf5e923f3cd88407f852116abce943a826';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN nincs beállítva' });
  }

  const { events, adminPassword } = req.body;

  // Admin ellenőrzés
  if (!adminPassword) {
    return res.status(401).json({ error: 'Admin jelszó szükséges' });
  }
  const inputHash = await hashPassword(adminPassword);
  if (inputHash !== ADMIN_HASH) {
    return res.status(401).json({ error: 'Hibás admin jelszó' });
  }

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'Érvénytelen adatok' });
  }

  try {
    const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Jelenlegi fájl SHA lekérése (update-hez kell)
    const getCurrentSha = await fetch(`${apiBase}?ref=${BRANCH}`, { headers });
    let sha = null;
    if (getCurrentSha.ok) {
      const current = await getCurrentSha.json();
      sha = current.sha;
    }

    // Új tartalom base64-ben
    const content = Buffer.from(JSON.stringify(events, null, 2), 'utf8').toString('base64');
    const now = new Date().toISOString().split('T')[0];

    const body = {
      message: `admin: könyv mentése ${now}`,
      content,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    };

    const pushRes = await fetch(apiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      throw new Error(`GitHub API hiba: ${pushRes.status} — ${err.message}`);
    }

    const result = await pushRes.json();
    return res.status(200).json({
      success: true,
      message: 'Mentve és deployolva!',
      commit: result.commit?.sha?.substring(0, 7),
    });

  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({ error: err.message });
  }
}
