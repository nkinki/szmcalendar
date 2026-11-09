// api/img.js — Google Drive kép proxy
// GET /api/img?id=DRIVE_FILE_ID
// Letölti a képet Drive-ról és visszaadja a böngészőnek (nincs CORS probléma)

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).send('Érvénytelen ID');
  }

  // Thumbnail URL — ez nyilvánosan elérhető
  const url = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://drive.google.com/',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(response.status).send('Drive hiba');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 nap cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Proxy hiba: ' + err.message);
  }
}
