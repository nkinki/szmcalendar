// Local storage key for the yearbook project (shared by App + Editor)
export const STORAGE_KEY = 'iskoEvkonyv_bookData';

/** Normalize image entries from both old (string) and new (object) saves. */
export function normalizeEventImages(images = []) {
  return (Array.isArray(images) ? images : [])
    .map(image => {
      const obj = typeof image === 'string' ? { url: image, enabled: true } : { enabled: true, ...image };
      // Drive képeknél mindig proxy URL-t használunk (nincs CORS probléma)
      if (obj.driveId) {
        const proxyUrl = `/api/img?id=${obj.driveId}`;
        obj.url = proxyUrl;
        obj.thumbnail = proxyUrl;
      }
      return obj;
    })
    .filter(image => Boolean(image.url));
}

export function getVisibleEventImages(event) {
  const images = normalizeEventImages(event?.images).filter(image => image.enabled !== false);
  const count = Number(event?.imageCount) || images.length;
  return images.slice(0, Math.max(1, Math.min(count, 6)));
}

// A Facebook export can occasionally be decoded as Latin-1 before it reaches
// the app (e.g. "KÃ¶zÃ©piskola"). Repair only the characteristic mojibake
// sequences and leave correctly encoded Hungarian text untouched.
export function repairMojibake(value) {
  if (typeof value !== 'string' || !/[ÃÂâð]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(value, character => character.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return repaired.includes('�') ? value : repaired;
  } catch {
    return value;
  }
}

export function repairBookData(value) {
  if (Array.isArray(value)) return value.map(repairBookData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairBookData(item)]));
  }
  return repairMojibake(value);
}

// ── Event page helpers (shared by Editor / BookPreview / PrintBook) ─────────

// Facebook export filler lines ("Szent Mihály megosztott egy bejegyzést.",
// "X új fényképet töltött fel.") and broken emoji placeholders (■) look bad
// in the yearbook — strip them for display.
const FILLER_LINE_PATTERNS = [
  /megosztott egy bejegyzést\.?\s*$/i,
  /megosztott egy posztot\.?\s*$/i,
  /új fényképet töltött fel\.?\s*$/i,
  /új képet töltött fel\.?\s*$/i,
  /fényképeket töltött fel\.?\s*$/i,
  /új bejegyzést írt\.?\s*$/i,
  /eseményt hozott létre\.?\s*$/i,
];

export function cleanEventText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[■□▪▫▬◆◇]+/g, '') // broken emoji placeholders from FB export
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !FILLER_LINE_PATTERNS.some(pattern => pattern.test(line)))
    .join('\n');
}

// First meaningful line of an event text acts as its title, the rest as body.
export function splitEventTitle(text) {
  const t = cleanEventText(text);
  const lines = t.split('\n');
  if (lines.length === 0) return { title: '', body: '' };
  return { title: lines[0], body: lines.slice(1).join('\n') };
}

// Cím és törzsszöveg intelligens feloldása:
// Ha az eseménynek explicit event.title értéke van (akár üres string is):
//   - Ha event.title üres string: nincs cím, és a teljes szöveg a törzsben (body) marad (nem olvassa be a posztot címnek!)
//   - Ha event.title nem üres: az lesz a cím, a törzsből levágja a duplikált első sort (ha az megegyezik a címmel)
// Ha nincs explicit event.title: a meglévő splitEventTitle logika fut le.
export function getEventTitleAndBody(event) {
  if (!event) return { title: '', body: '' };
  const rawText = event.text || '';

  if (event.title !== undefined) {
    const title = (event.title || '').trim();
    if (!title) {
      return { title: '', body: rawText };
    }
    const lines = rawText.split('\n');
    if (lines.length > 0 && lines[0].trim().toLowerCase() === title.toLowerCase()) {
      return { title, body: lines.slice(1).join('\n').trim() };
    }
    return { title, body: rawText };
  }

  let { title, body } = splitEventTitle(rawText);
  if (!body && title.length > 80) {
    body = title;
    title = '';
  }
  return { title, body };
}

// Consistent, nice-looking image grid geometry for event pages (1-6 images).
// single=true → the lone photo is shown whole (objectFit: contain), never
// cropped or stretched; grids use cover (crop) which is standard for tiles.
export function getEventImageGrid(count) {
  const n = Math.max(1, Math.min(Number(count) || 1, 6));
  if (n === 1) return { cols: 1, rows: 1, hero: false, single: true };
  if (n === 2) return { cols: 2, rows: 1, hero: false, single: false };
  if (n === 3) return { cols: 2, rows: 2, hero: true, single: false };
  if (n === 4) return { cols: 2, rows: 2, hero: false, single: false };
  return { cols: 3, rows: 2, hero: false, single: false }; // 5-6
}

// Elsőbbségi egységes szövegstílus (sorkizárt, arany betű, átmenetes iniciálé)
export function applyUnifiedTextStyles(events) {
  if (!Array.isArray(events)) return [];
  return events.map(ev => ({
    ...ev,
    textAlign: 'justify',
    textColor: '#b45309',
    color: '#b45309',
    dropCap: ev.dropCap !== undefined ? ev.dropCap : true,
    // NE írjuk felül a felhasználó által beállított iniciálé stílust:
    dropCapStyle: ev.dropCapStyle || 'gradient',
    dropCapColor: ev.dropCapColor || '#b45309',
    dropCapSize: ev.dropCapSize !== undefined ? ev.dropCapSize : 3.2,
    dropCapSpacing: ev.dropCapSpacing !== undefined ? ev.dropCapSpacing : 4,
    dropCapOffsetY: ev.dropCapOffsetY !== undefined ? ev.dropCapOffsetY : 2,
    dropCapFont: ev.dropCapFont || "'Georgia', serif",
    dropCapBg: ev.dropCapBg !== undefined ? ev.dropCapBg : '',
  }));
}

// ── Inline markdown renderelés (**bold**, _italic_), Iniciálé (Drop cap) & Bekezdéskezelés ──
import React from 'react';

export function renderMarkdown(text, options = {}) {
  if (!text) return null;
  const {
    dropCap = true,
    dropCapColor = '#b45309',
    dropCapSize = 3.2,
    dropCapSpacing = 4,
    dropCapOffsetY = 2,
    dropCapStyle = 'gradient',
    dropCapFont = "'Georgia', 'Palatino Linotype', 'Times New Roman', serif",
    dropCapBg = '',
    indent = false,
    paragraphSpacing = true,
  } = (typeof options === 'object' && options !== null ? options : {});

  const parseInline = (line, keyPrefix) => {
    const parts = [];
    let rest = line;
    let key = 0;
    while (rest.length > 0) {
      const boldM = rest.match(/^(.*?)\*\*(.+?)\*\*/s);
      const italicM = rest.match(/^(.*?)_(.+?)_/s);
      const useBold = boldM && (!italicM || boldM[0].length <= italicM[0].length);
      const useItalic = italicM && (!boldM || italicM[0].length < boldM[0].length);
      if (useBold) {
        if (boldM[1]) parts.push(React.createElement('span', { key: `${keyPrefix}_${key++}` }, boldM[1]));
        parts.push(React.createElement('strong', { key: `${keyPrefix}_${key++}` }, boldM[2]));
        rest = rest.slice(boldM[0].length);
      } else if (useItalic) {
        if (italicM[1]) parts.push(React.createElement('span', { key: `${keyPrefix}_${key++}` }, italicM[1]));
        parts.push(React.createElement('em', { key: `${keyPrefix}_${key++}` }, italicM[2]));
        rest = rest.slice(italicM[0].length);
      } else {
        parts.push(React.createElement('span', { key: `${keyPrefix}_${key++}` }, rest));
        rest = '';
      }
    }
    return parts;
  };

  // Ha nincs iniciálé és behúzás se kell, egyszerű vonal-alapú renderelés
  if (!dropCap && !indent && !paragraphSpacing) {
    const lines = text.split('\n');
    return lines.map((line, li) => {
      return React.createElement(React.Fragment, { key: li }, ...parseInline(line, `l_${li}`), li < lines.length - 1 ? '\n' : null);
    });
  }

  // Bekezdés-alapú feldolgozás
  const rawParagraphs = text.includes('\n\n')
    ? text.split(/\n\s*\n/)
    : text.split('\n');
  const paragraphs = rawParagraphs.map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;

  let dropCapUsed = false;

  return paragraphs.map((para, pIdx) => {
    let pContent = [];

    if (dropCap && !dropCapUsed) {
      const match = para.match(/^([„"']?[\p{L}0-9])/u);
      if (match) {
        const initial = match[1];
        const remainder = para.slice(initial.length);
        dropCapUsed = true;

        const sizeEm = Number(dropCapSize) || 3.2;
        const spacingPx = dropCapSpacing !== undefined ? Number(dropCapSpacing) : 4;
        const offsetPx = dropCapOffsetY !== undefined ? Number(dropCapOffsetY) : 2;

        let styleObj = {
          float: 'left',
          fontSize: `${sizeEm}em`,
          lineHeight: dropCapStyle === 'badge' ? '1.15' : '0.78',
          fontFamily: dropCapFont || "'Georgia', 'Palatino Linotype', 'Times New Roman', serif",
          fontWeight: 900,
          marginRight: `${spacingPx}px`,
          marginTop: `${offsetPx}px`,
          padding: '2px 4px 2px 0',
          userSelect: 'none',
        };

        if (dropCapStyle === 'gradient') {
          styleObj = {
            ...styleObj,
            background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 60%, #92400e 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
          };
        } else if (dropCapStyle === 'box') {
          styleObj = {
            ...styleObj,
            color: dropCapColor || '#b45309',
            border: `1.5px solid ${dropCapColor || '#d97706'}`,
            background: dropCapBg || 'rgba(217, 119, 6, 0.08)',
            borderRadius: 5,
            padding: '3px 8px 3px 8px',
            lineHeight: 0.9,
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          };
        } else if (dropCapStyle === 'badge') {
          styleObj = {
            ...styleObj,
            color: dropCapColor || '#ffffff',
            border: '2px solid #f59e0b',
            background: dropCapBg || 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
            borderRadius: '50%',
            width: '1.25em',
            height: '1.25em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            lineHeight: 1,
            padding: 0,
            boxShadow: '0 2px 8px rgba(180,83,9,0.3)',
          };
        } else if (dropCapStyle === 'shadow') {
          styleObj = {
            ...styleObj,
            color: dropCapColor || '#1e1b4b',
            textShadow: '2px 2px 0 #fbbf24, 3px 3px 0 #d97706, 4px 4px 6px rgba(0,0,0,0.15)',
          };
        } else if (dropCapStyle === 'classic') {
          styleObj = {
            ...styleObj,
            color: dropCapColor || '#1e293b',
            textShadow: 'none',
          };
        } else {
          // 'gold' default
          styleObj = {
            ...styleObj,
            color: dropCapColor || '#b45309',
            textShadow: '0 1px 3px rgba(180,83,9,0.25), 0 0 1px #78350f',
          };
        }

        const dropCapEl = React.createElement('span', {
          key: `dropcap_${pIdx}`,
          style: styleObj
        }, initial);

        pContent = [dropCapEl, ...parseInline(remainder, `p_${pIdx}`)];
      } else {
        pContent = parseInline(para, `p_${pIdx}`);
      }
    } else {
      pContent = parseInline(para, `p_${pIdx}`);
    }

    const hasDropCapHere = pIdx === 0 && dropCapUsed;
    const textIndent = (hasDropCapHere) ? 0 : (indent ? '1.4em' : 0);
    const marginTop = (pIdx > 0 && paragraphSpacing) ? '0.65em' : 0;

    return React.createElement('div', {
      key: `para_${pIdx}`,
      style: {
        textIndent,
        marginTop,
        ...(pIdx === paragraphs.length - 1 && dropCapUsed ? { minHeight: `${(Number(dropCapSize) || 3.2) * 0.9}em` } : {})
      }
    }, ...pContent);
  });
}
