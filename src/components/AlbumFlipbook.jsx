/**
 * AlbumFlipbook — 3D lapozható digitális évkönyv
 *
 * 1) In-app nézet: animált CSS-3D lapozás (nyilak, kattintás, billentyűzet)
 * 2) "Album letöltése (HTML)": önálló, EGYFÁJLOS album a suli weboldalára —
 *    minden kép beágyazva, iframe-be tehető vagy közvetlenül linkelhető.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Download } from 'lucide-react';
import {
  buildPages, CoverContent, PrincipalContent, TeachersContent,
  ClassContent, GradContent, DividerContent, EventContent,
} from './BookPreview';
import { getVisibleEventImages } from '../utils/media';

const BOOK_W = 780, BOOK_H = 550;

function buildSheets(pages) {
  const sheets = [];
  for (let i = 0; i < pages.length; i += 2) sheets.push({ front: pages[i], back: pages[i + 1] || null });
  return sheets;
}

function PageFace({ page, bookData }) {
  if (!page) return <div style={{ width: '100%', height: '100%', background: '#eef0f4' }} />;
  switch (page.type) {
    case 'cover':      return <CoverContent bookData={bookData} />;
    case 'principal':  return <PrincipalContent bookData={bookData} />;
    case 'teachers':   return <TeachersContent bookData={bookData} />;
    case 'class':      return <ClassContent classData={(bookData.classes || []).find(c => c.id === page.classId)} bookData={bookData} />;
    case 'graduation': return <GradContent grad={page.data} bookData={bookData} />;
    case 'divider':    return <DividerContent schoolYear={page.schoolYear} bookData={bookData} />;
    case 'event':      return <EventContent event={(bookData.events || []).find(e => e.id === page.eventId)} bookData={bookData} />;
    default:           return <div style={{ width: '100%', height: '100%', background: '#fff' }} />;
  }
}

export default function AlbumFlipbook({ bookData, setBookData, setViewMode }) {
  const pages = buildPages(bookData);
  const sheets = buildSheets(pages);
  const total = sheets.length;
  const [cur, setCur] = useState(0); // ennyi lap van átfordítva
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportProg, setExportProg] = useState(0);
  const [zoom, setZoom] = useState(1);

  const next = useCallback(() => setCur(i => Math.min(total, i + 1)), [total]);
  const prev = useCallback(() => setCur(i => Math.max(0, i - 1)), []);

  useEffect(() => {
    const h = (e) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth - 60, h = window.innerHeight - 200;
      setScale(Math.max(0.3, Math.min(1, w / BOOK_W, h / BOOK_H)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ── Önálló HTML album generálása ────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportProg(0);
    try {
      // 1) Összegyűjtjük a használt kép-URL-eket (csak ami az albumban látszik)
      const urls = new Set();
      const add = (u) => { if (u && typeof u === 'string' && u) urls.add(u); };
      add(bookData.schoolLogo);
      add(bookData.principalPhoto);
      (bookData.teachers || []).forEach(t => add(t.photo));
      (bookData.classes || []).forEach(c => {
        add(c.classTeacherPhoto); add(c.groupPhoto);
        (c.students || []).forEach(s => add(s.photo));
      });
      (bookData.graduationPages || []).forEach(g => add(g.image));
      (bookData.events || []).forEach(e => getVisibleEventImages(e).forEach(im => add(im.url)));

      // 2) Mindet dataURL-lé alakítjuk (data: már kész, /scraped_images/... letöltve)
      const map = new Map();
      const list = [...urls];
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        if (u.startsWith('data:')) { map.set(u, u); }
        else {
          try {
            const res = await fetch(u);
            const blob = await res.blob();
            const dataUrl = await new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.onerror = () => resolve(u);
              r.readAsDataURL(blob);
            });
            map.set(u, dataUrl);
          } catch { map.set(u, u); }
        }
        setExportProg(Math.round(((i + 1) / list.length) * 90));
      }
      const R = (u) => map.get(u) || u || '';

      // 3) Tiszta adatobjektum a beágyazáshoz (csak látható képek)
      const out = {
        schoolName: bookData.schoolName || 'Iskola',
        currentYear: bookData.currentYear || new Date().getFullYear(),
        schoolLogo: R(bookData.schoolLogo),
        principalName: bookData.principalName || '',
        principalQuote: bookData.principalQuote || '',
        principalPhoto: R(bookData.principalPhoto),
        teachers: (bookData.teachers || []).map(t => ({ name: t.name || '', subject: t.subject || '', photo: R(t.photo) })),
        classes: (bookData.classes || []).map(c => ({
          className: c.className || '',
          classTeacherName: c.classTeacherName || '',
          classTeacherPhoto: R(c.classTeacherPhoto),
          groupPhoto: R(c.groupPhoto),
          students: (c.students || []).map(s => ({ name: s.name || '', photo: R(s.photo) })),
        })),
        graduationPages: (bookData.graduationPages || []).map(g => ({ year: g.year, caption: g.caption || '', image: R(g.image) })),
        events: (bookData.events || []).map(e => ({
          date: e.date || '', dateSort: e.dateSort || '', schoolYear: e.schoolYear || '',
          text: e.text || '',
          images: getVisibleEventImages(e).map(im => ({ url: R(im.url), enabled: true })),
        })),
      };

      const html = buildStandaloneHtml(out);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'digitalis-album-' + String(bookData.schoolName || 'iskola').replace(/[^a-z0-9áéíóöőúüű]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.html';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (err) {
      alert('Az album exportálása nem sikerült: ' + err.message);
    } finally {
      setExporting(false);
      setExportProg(0);
    }
  };

  const label = cur === 0 ? 'Borító' : cur >= total ? 'Vége' : cur + ' / ' + total + ' lap';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'radial-gradient(ellipse at 50% 30%, #1a1530 0%, #0a090e 70%)', overflow: 'hidden', fontFamily: "'Inter',sans-serif" }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56, background: 'rgba(10,9,14,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => setViewMode('editor')} style={topBtn()}>
          <ArrowLeft size={15} /> Vissza
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={17} color="#a855f7" />
          <input
            value={bookData.schoolName || ''}
            onChange={e => setBookData && setBookData(prev => ({ ...prev, schoolName: e.target.value }))}
            title="Iskola neve — ez kerül minden oldal fejlécére (automatikusan mentődik)"
            placeholder="Iskola neve..."
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, padding: '6px 12px', width: 300, outline: 'none' }}
          />
          <input
            type="number"
            value={bookData.currentYear || 2026}
            onChange={e => setBookData && setBookData(prev => ({ ...prev, currentYear: Number(e.target.value) }))}
            title="Tanév vége (évszám)"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, padding: '6px 8px', width: 76, outline: 'none' }}
          />
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>— Digitális Album</span>
        </div>
        <button onClick={handleExport} disabled={exporting} style={{ ...topBtn(), opacity: exporting ? 0.6 : 1 }}>
          <Download size={15} /> {exporting ? `Készítés… ${exportProg}%` : 'Album letöltése (HTML)'}
        </button>
      </div>

      {/* Book — kattintás: nagyítás/kicsinyítés; lapozás: nyilak, gombok */}
      <div
        onClick={() => setZoom(z => z > 1 ? 1 : 1.8)}
        title={zoom > 1 ? 'Kattints a visszakicsinyítéshez' : 'Kattints a nagyításhoz (olvasható szöveg)'}
        style={{
          flex: 1, minHeight: 0, perspective: '1600px',
          overflow: zoom > 1 ? 'auto' : 'hidden',
          display: 'flex', alignItems: zoom > 1 ? 'flex-start' : 'center', justifyContent: 'center',
          cursor: zoom > 1 ? 'zoom-out' : 'zoom-in',
          padding: 16,
        }}
      >
        <div style={{ width: BOOK_W * scale * zoom, height: BOOK_H * scale * zoom, position: 'relative', flexShrink: 0, margin: zoom > 1 ? '12px auto' : 0 }}>
          <div
            className="book"
            style={{ width: BOOK_W, height: BOOK_H, transform: `scale(${scale * zoom})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
          >
            <div className="book-spine-shadow" />
            {sheets.map((sheet, i) => {
              const flipped = cur > i;
              return (
                <div
                  key={i}
                  className={'page page-right' + (flipped ? ' flipped' : '')}
                  style={{ zIndex: flipped ? i + 1 : sheets.length - i }}
                >
                  <div className="page-face page-front"><PageFace page={sheet.front} bookData={bookData} /></div>
                  <div className="page-face page-back"><PageFace page={sheet.back} bookData={bookData} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={prev} disabled={cur === 0} style={{ ...navBtn, opacity: cur === 0 ? 0.3 : 1 }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>{label}</span>
          <button onClick={next} disabled={cur >= total} style={{ ...navBtn, opacity: cur >= total ? 0.3 : 1 }}>
            <ChevronRight size={20} />
          </button>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)' }} />
          <button onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.4) * 10) / 10))} disabled={zoom <= 1} style={{ ...navBtn, width: 36, height: 36, opacity: zoom <= 1 ? 0.3 : 1 }}>−</button>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, minWidth: 46, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.4) * 10) / 10))} disabled={zoom >= 3} style={{ ...navBtn, width: 36, height: 36, opacity: zoom >= 3 ? 0.3 : 1 }}>+</button>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          Lapozás: nyilak vagy gombok · Nagyítás: kattintás a könyvre, +/− gombok · ← →
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ÖNÁLLÓ HTML ALBUM GENERÁTOR — egyfájlos, beágyazható a suli weboldalába
// ══════════════════════════════════════════════════════════════════════════════
function buildStandaloneHtml(B) {
  const json = JSON.stringify(B).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

  const css = `
    html,body{margin:0;padding:0;height:100%;background:radial-gradient(ellipse at 50% 30%,#1a1530 0%,#0a090e 70%);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden}
    .topbar{display:flex;align-items:center;justify-content:center;padding:12px 16px;color:#fff;font-weight:700;font-size:15px;gap:8px}
    .topbar .yr{color:#a855f7}
    .stage{position:fixed;top:52px;bottom:64px;left:0;right:0;display:flex;align-items:center;justify-content:center;perspective:1600px;cursor:zoom-in;overflow:auto}
    .book{position:relative;width:780px;height:550px;transform-style:preserve-3d;box-shadow:0 30px 80px rgba(0,0,0,.75);border-radius:4px;margin:auto;flex-shrink:0}
    .page{position:absolute;width:50%;height:100%;top:0;right:0;transform-style:preserve-3d;transform-origin:left center;transition:transform .75s cubic-bezier(.4,0,.2,1)}
    .page-face{position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:#fff;color:#333;box-sizing:border-box;overflow:hidden;box-shadow:inset -5px 0 20px rgba(0,0,0,.08)}
    .page-back{transform:rotateY(180deg);box-shadow:inset 5px 0 20px rgba(0,0,0,.08)}
    .flipped{transform:rotateY(-180deg)}
    .spine{position:absolute;top:0;left:50%;transform:translateX(-50%);width:30px;height:100%;background:linear-gradient(to right,rgba(0,0,0,.15),rgba(0,0,0,0) 50%,rgba(0,0,0,.15));z-index:999;pointer-events:none}
    .controls{position:fixed;bottom:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:center;gap:16px}
    .nbtn{width:44px;height:44px;border-radius:50%;border:1px solid rgba(168,85,247,.4);background:rgba(124,58,237,.25);color:#a855f7;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
    .nbtn:hover{background:rgba(124,58,237,.45)}
    .nbtn:disabled{opacity:.25;cursor:default}
    .pos{color:rgba(255,255,255,.55);font-size:13px;font-weight:600;min-width:90px;text-align:center}
    .hint{position:fixed;bottom:4px;left:0;right:0;text-align:center;color:rgba(255,255,255,.25);font-size:11px}
    img{max-width:none}
  `;

  // A beágyazott JS szándékosan ES5 stílusú, sablonliterálok nélkül.
  const js = [
    "var BOOK = " + json + ";",
    "var MO=[6,5,4,3,2,1,12,11,10,9,8,7];",
    "function mIdx(d){var t=new Date(d||'').getTime();if(!t||isNaN(t))return 12;var m=new Date(d).getMonth()+1;var i=MO.indexOf(m);return i<0?12:i;}",
    "function esc(s){return String(s==null?'':s).replace(/&/g,'\\u0026amp;').replace(/</g,'\\u0026lt;').replace(/>/g,'\\u0026gt;');}",
    "function cleanText(t){if(typeof t!=='string')return '';return t.replace(/[\\u25A0\\u25A1\\u25AA\\u25AB\\u25AC\\u25C6\\u25C7]+/g,'').split('\\n').map(function(l){return l.trim();}).filter(Boolean).filter(function(l){return !/(megosztott egy bejegyz\\u00e9st\\.?|megosztott egy posztot\\.?|\\u00faj f\\u00e9nyk\\u00e9pet t\\u00f6lt\\u00f6tt fel\\.?|\\u00faj k\\u00e9pet t\\u00f6lt\\u00f6tt fel\\.?|f\\u00e9nyk\\u00e9peket t\\u00f6lt\\u00f6tt fel\\.?|\\u00faj bejegyz\\u00e9st \\u00edrt\\.?|esem\\u00e9nyt hozott l\\u00e9tre\\.?)$/i.test(l);}).join('\\n');}",
    "function visImgs(ev){var imgs=(ev.images||[]).map(function(x){return typeof x==='string'?{url:x,enabled:true}:{enabled:true,url:'',...x};}).filter(function(x){return x.url&&x.enabled!==false;});var cnt=Number(ev.imageCount)||imgs.length;return imgs.slice(0,Math.max(1,Math.min(cnt,6)));}",
    "function gridGeom(n){n=Math.max(1,Math.min(n||1,6));if(n===1)return{c:1,r:1,hero:false,single:true};if(n===2)return{c:2,r:1};if(n===3)return{c:2,r:2,hero:true};if(n===4)return{c:2,r:2};return{c:3,r:2};}",
    "function crossSvg(s,c){return '<svg width=\"'+s+'\" height=\"'+s+'\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M12 2V22M7 6H17M8 11H16M7 18L17 15\" stroke=\"'+c+'\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>';}",
    "function splitTitle(t){var ls=t.split('\\n');if(!ls.length)return{title:'',body:''};return{title:ls[0],body:ls.slice(1).join('\\n')};}",
    "",
    "function coverHtml(B){var g=[].concat(B.graduationPages||[]).sort(function(a,b){return b.year-a.year;})[0];",
    " return '<div style=\"width:100%;height:100%;background:linear-gradient(135deg,#1a1830,#0e0c1a);color:#fff;display:flex;flex-direction:column;padding:8%;box-sizing:border-box\">'+",
    " '<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:auto\">'+(B.schoolLogo?'<img src=\"'+B.schoolLogo+'\" style=\"height:22px;object-fit:contain\">':crossSvg(20,'#fbbf24'))+'<span style=\"font-size:8pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;opacity:.7\">'+esc(B.schoolName)+'</span></div>'+",
    " '<div style=\"flex:1;margin:6% 0;border-radius:8px;overflow:hidden;max-height:55%;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center\">'+(g&&g.image?'<img src=\"'+g.image+'\" style=\"width:100%;height:100%;object-fit:cover\">':'<span style=\"opacity:.3;font-size:8pt\">Ballag\\u00e1si fot\\u00f3</span>')+'</div>'+",
    " '<div style=\"text-align:center\"><div style=\"font-size:30pt;font-weight:900;color:#a855f7;line-height:1\">\\u00c9VK\\u00d6NYV</div><div style=\"font-size:10pt;opacity:.5;margin-top:4px\">'+(B.currentYear-1)+'/'+B.currentYear+'</div></div></div>';}",
    "",
    "function principalHtml(B){return '<div style=\"width:100%;height:100%;background:#fff;display:flex;flex-direction:column;box-sizing:border-box\">'+",
    " '<div style=\"background:#7c3aed;padding:7% 8% 5%;flex-shrink:0\"><div style=\"font-size:6pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:4px\">'+esc(B.schoolName)+'</div><div style=\"font-size:16pt;font-weight:900;color:#fff;line-height:1.1\">Igazgat\\u00f3i<br>k\\u00f6sz\\u00f6nt\\u0151</div></div>'+",
    " '<div style=\"flex:1;padding:5% 8%;display:flex;gap:5%;overflow:hidden\">'+(B.principalPhoto?'<img src=\"'+B.principalPhoto+'\" style=\"width:52px;height:68px;object-fit:cover;border-radius:4px;flex-shrink:0\">':'')+'<div style=\"flex:1;overflow:hidden\"><div style=\"font-size:7.5pt;line-height:1.8;color:#374151;border-left:2px solid #7c3aed;padding-left:6px;font-style:italic;overflow:hidden;white-space:pre-wrap\">'+esc(B.principalQuote||'')+'</div>'+(B.principalName?'<div style=\"font-size:6pt;font-weight:700;color:#7c3aed;margin-top:6px\">\\u2014 '+esc(B.principalName)+'</div>':'')+'</div></div>'+",
    " '<div style=\"padding:2% 6%;border-top:1px solid #f3f4f6;font-size:6pt;color:#d1d5db\">'+esc(B.schoolName)+'</div></div>';}",
    "",
    "function teachersHtml(B){var ts=B.teachers||[];",
    " var cards=ts.map(function(t){return '<div style=\"display:flex;flex-direction:column;align-items:center;text-align:center\"><div style=\"width:46px;height:60px;border-radius:4px;background:#f3f4f6;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:4px;flex-shrink:0\">'+(t.photo?'<img src=\"'+t.photo+'\" style=\"width:100%;height:100%;object-fit:cover\">':'')+'</div><div style=\"font-size:7px;font-weight:700;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%\">'+esc(t.name||'N\\u00e9v...')+'</div><div style=\"font-size:6px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%\">'+esc(t.subject||'')+'</div></div>';}).join('');",
    " return '<div style=\"width:100%;height:100%;background:#fff;display:flex;flex-direction:column;box-sizing:border-box\">'+",
    " '<div style=\"background:#7c3aed;padding:7% 8% 5%;flex-shrink:0\"><div style=\"font-size:6pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:4px\">'+esc(B.schoolName)+'</div><div style=\"font-size:16pt;font-weight:900;color:#fff;line-height:1.1\">Nevel\\u0151test\\u00fclet</div></div>'+",
    " '<div style=\"flex:1;padding:5% 8%;overflow:hidden;display:grid;grid-template-columns:repeat(4,1fr);gap:4%;align-content:start\">'+cards+'</div>'+",
    " '<div style=\"padding:2% 6%;border-top:1px solid #f3f4f6;font-size:6pt;color:#d1d5db\">'+esc(B.schoolName)+'</div></div>';}",
    "",
    "function classHtml(c,B){if(!c)return '<div style=\"width:100%;height:100%;background:#fff\"></div>';",
    " var studs=(c.students||[]).map(function(s){return '<div style=\"display:flex;flex-direction:column;align-items:center;text-align:center\"><div style=\"width:34px;height:44px;border-radius:3px;background:#f3f4f6;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:3px\">'+(s.photo?'<img src=\"'+s.photo+'\" style=\"width:100%;height:100%;object-fit:cover\">':'')+'</div><div style=\"font-size:6px;font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%\">'+esc(s.name||'')+'</div></div>';}).join('');",
    " return '<div style=\"width:100%;height:100%;background:#fff;display:flex;flex-direction:column;box-sizing:border-box\">'+",
    " '<div style=\"background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:5% 8% 4%;flex-shrink:0\"><div style=\"font-size:5.5pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:2px\">'+esc(B.schoolName)+' \\u2022 Oszt\\u00e1lytabl\\u00f3</div><div style=\"font-size:14pt;font-weight:900;color:#fff;line-height:1\">'+esc(c.className)+' oszt\\u00e1ly</div></div>'+",
    " '<div style=\"flex:1;padding:3% 6%;display:flex;flex-direction:column;gap:3%;min-height:0;overflow:hidden\">'+",
    " '<div style=\"display:flex;gap:4%;height:32%;flex-shrink:0\"><div style=\"width:34%;display:flex;gap:8px;border:1px solid #f3f4f6;border-radius:6px;padding:6px;background:#faf9fe;align-items:center\"><div style=\"width:32px;height:42px;border-radius:4px;background:#e5e7eb;overflow:hidden;flex-shrink:0\">'+(c.classTeacherPhoto?'<img src=\"'+c.classTeacherPhoto+'\" style=\"width:100%;height:100%;object-fit:cover\">':'')+'</div><div style=\"min-width:0\"><div style=\"font-size:5px;font-weight:700;color:#7c3aed;text-transform:uppercase\">Oszt\\u00e1lyf\\u0151n\\u00f6k</div><div style=\"font-size:6.5px;font-weight:700;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+esc(c.classTeacherName||'')+'</div></div></div><div style=\"flex:1;border-radius:6px;background:#f3f4f6;overflow:hidden;border:1px solid #e5e7eb\">'+(c.groupPhoto?'<img src=\"'+c.groupPhoto+'\" style=\"width:100%;height:100%;object-fit:cover\">':'')+'</div></div>'+",
    " '<div style=\"flex:1;overflow:hidden;display:grid;grid-template-columns:repeat(5,1fr);gap:3%;align-content:start\">'+studs+'</div></div>'+",
    " '<div style=\"padding:2% 6%;border-top:1px solid #f3f4f6;font-size:6pt;color:#d1d5db\">'+esc(B.schoolName)+'</div></div>';}",
    "",
    "function gradHtml(g,B){return '<div style=\"width:100%;height:100%;background:#fff;display:flex;flex-direction:column;box-sizing:border-box\">'+",
    " '<div style=\"background:linear-gradient(135deg,#1a1830,#2d1b4e);padding:6% 8% 5%;flex-shrink:0\"><div style=\"font-size:6pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:3px\">'+esc(B.schoolName)+' \\u2022 Ballag\\u00e1s</div><div style=\"font-size:15pt;font-weight:900;color:#fff;line-height:1\">'+esc(g.caption)+'</div></div>'+",
    " '<div style=\"flex:1;margin:4% 8%;border-radius:6px;overflow:hidden;min-height:0;background:#f5f3ff\">'+(g.image?'<img src=\"'+g.image+'\" style=\"width:100%;height:100%;object-fit:cover\">':'')+'</div>'+",
    " '<div style=\"padding:2% 6%;border-top:1px solid #f3f4f6;font-size:6pt;color:#d1d5db\">'+esc(B.schoolName)+'</div></div>';}",
    "",
    "function dividerHtml(sy,B){return '<div style=\"width:100%;height:100%;background:linear-gradient(135deg,#1a1830,#0e0c1a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-sizing:border-box\">'+",
    " (B.schoolLogo?'<img src=\"'+B.schoolLogo+'\" style=\"height:34px;object-fit:contain;opacity:.7;margin-bottom:10px\">':crossSvg(34,'#fbbf24'))+'<div style=\"font-size:7pt;letter-spacing:.3em;text-transform:uppercase;opacity:.4;color:#fff\">Tan\\u00e9v</div><div style=\"font-size:32pt;font-weight:900;color:#a855f7;line-height:1\">'+esc(sy)+'</div><div style=\"width:36px;height:2px;background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:2px;margin-top:6px\"></div><div style=\"font-size:7pt;opacity:.3;color:#fff;margin-top:4px\">'+esc(B.schoolName)+'</div></div>';}",
    "",
    "function eventHtml(ev,B){if(!ev)return '<div style=\"width:100%;height:100%;background:#fff\"></div>';",
    " var imgs=visImgs(ev);var g=gridGeom(imgs.length);var sp=splitTitle(cleanText(ev.text));var ti=sp.title,bd=sp.body;",
    " var cells=imgs.map(function(im,i){return '<div style=\"grid-row:'+(g.hero&&i===0?'span 2':'auto')+';overflow:hidden;background:#f3f4f6\"><img src=\"'+im.url+'\" style=\"width:100%;height:100%;object-fit:'+(g.single?'contain':'cover')+';display:block\"></div>';}).join('');",
    " return '<div style=\"width:100%;height:100%;background:#fff;display:flex;flex-direction:column;padding:6%;gap:3%;box-sizing:border-box\">'+",
    " '<div style=\"display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:2%;flex-shrink:0\"><span style=\"font-size:6.5pt;font-weight:700;color:#7c3aed;letter-spacing:.1em;text-transform:uppercase\">'+esc(B.schoolName)+'</span><span style=\"font-size:6.5pt;color:#6b7280;font-weight:600\">'+esc(ev.date)+'</span></div>'+",
    " (imgs.length?'<div style=\"display:grid;grid-template-columns:'+(g.hero?'1.6fr 1fr':'repeat('+g.c+',1fr)')+';grid-template-rows:repeat('+g.r+',1fr);gap:2%;height:46%;border-radius:6px;overflow:hidden;flex-shrink:0;background:'+(g.single?'#f3f4f6':'transparent')+'\">'+cells+'</div>':'')+'",
    " '<div style=\"flex:1;min-height:0;display:flex;flex-direction:column;gap:3%;overflow:hidden\">'+(ti?'<div style=\"flex-shrink:0;text-align:center\"><div style=\"font-size:9.5pt;font-weight:800;color:#1e1b4b;line-height:1.3\">'+esc(ti)+'</div><div style=\"width:46px;height:2px;background:linear-gradient(90deg,#d97706,#f59e0b);margin:3px auto 0;border-radius:2px\"></div></div>':'')+(bd?'<div style=\"flex:1;min-height:0;background:linear-gradient(135deg,#fffcf5,#fef9c3);border-left:3px solid #d97706;border-radius:0 8px 8px 0;padding:6px 9px;font-size:7.5pt;line-height:1.8;color:#1e293b;white-space:pre-wrap;word-break:break-word;overflow:hidden\">'+esc(bd)+'</div>':'')+'</div>'+",
    " '<div style=\"font-size:6pt;color:#d1d5db;border-top:1px solid #f3f4f6;padding-top:2%;text-align:center;flex-shrink:0\">'+esc(B.schoolName)+' \\u2022 '+esc(ev.schoolYear)+' tan\\u00e9v</div></div>';}",
    "",
    "function pageHtml(p){if(!p)return '<div style=\"width:100%;height:100%;background:#eef0f4\"></div>';",
    " if(p.type==='cover')return coverHtml(BOOK);if(p.type==='principal')return principalHtml(BOOK);if(p.type==='teachers')return teachersHtml(BOOK);",
    " if(p.type==='class')return classHtml((BOOK.classes||[])[p.idx],BOOK);",
    " if(p.type==='graduation')return gradHtml(p.data,BOOK);if(p.type==='divider')return dividerHtml(p.schoolYear,BOOK);",
    " if(p.type==='event')return eventHtml((BOOK.events||[]).find(function(e){return e.id===p.eventId;}),BOOK);",
    " return '<div style=\"width:100%;height:100%;background:#fff\"></div>';}",
    "",
    "var pages=[{id:'cover',type:'cover'},{id:'principal',type:'principal'}];",
    "if((BOOK.teachers||[]).length>0)pages.push({id:'teachers',type:'teachers'});",
    "(BOOK.classes||[]).forEach(function(c,i){pages.push({id:'class_'+i,type:'class',idx:i});});",
    "[].concat(BOOK.graduationPages||[]).sort(function(a,b){return b.year-a.year;}).forEach(function(g,i){pages.push({id:'grad_'+i,type:'graduation',data:g});});",
    "var years=[];(BOOK.events||[]).forEach(function(e){if(e.schoolYear&&years.indexOf(e.schoolYear)<0)years.push(e.schoolYear);});",
    "years.sort(function(a,b){return b.localeCompare(a);});",
    "years.forEach(function(sy){pages.push({id:'div_'+sy,type:'divider',schoolYear:sy});",
    " (BOOK.events||[]).filter(function(e){return e.schoolYear===sy;}).sort(function(a,b){var oa=mIdx(a.dateSort),ob=mIdx(b.dateSort);if(oa!==ob)return oa-ob;return (b.dateSort||'').localeCompare(a.dateSort||'');}).forEach(function(ev){pages.push({id:ev.id,type:'event',eventId:ev.id});});",
    "});",
    "var sheets=[];for(var i=0;i<pages.length;i+=2){sheets.push({front:pages[i],back:pages[i+1]||null});}",
    "",
    "var bookEl=document.getElementById('book');",
    "sheets.forEach(function(sh,i){",
    " var d=document.createElement('div');d.className='page';d.setAttribute('data-i',i);",
    " var f=document.createElement('div');f.className='page-face';f.innerHTML=pageHtml(sh.front);",
    " var b=document.createElement('div');b.className='page-face page-back';b.innerHTML=pageHtml(sh.back);",
    " d.appendChild(f);d.appendChild(b);bookEl.appendChild(d);",
    "});",
    "var flipped=0;",
    "function update(){",
    " var ps=bookEl.querySelectorAll('.page');",
    " for(var i=0;i<ps.length;i++){var on=flipped>i;ps[i].classList.toggle('flipped',on);ps[i].style.zIndex=on?(i+1):(sheets.length-i);}",
    " document.getElementById('pos').textContent=flipped===0?'Bor\\u00edt\\u00f3':(flipped>=sheets.length?'V\\u00e9ge':flipped+' / '+sheets.length+' lap');",
    " document.getElementById('prev').disabled=flipped===0;",
    " document.getElementById('next').disabled=flipped>=sheets.length;",
    "}",
    "function next(){if(flipped<sheets.length){flipped++;update();}}",
    "function prev(){if(flipped>0){flipped--;update();}}",
    "document.getElementById('next').onclick=function(e){e.stopPropagation();next();};",
    "document.getElementById('prev').onclick=function(e){e.stopPropagation();prev();};",
    "document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')next();if(e.key==='ArrowLeft')prev();});",
    "var zoom=1;",
    "document.getElementById('stage').addEventListener('click',function(){zoom=zoom>1?1:1.8;this.style.cursor=zoom>1?'zoom-out':'zoom-in';fit();});",
    "function fit(){var s=Math.min(1,(innerWidth-40)/780,(innerHeight-150)/550)*zoom;bookEl.style.transform='scale('+s+')';}",
    "window.addEventListener('resize',fit);fit();update();",
  ].join("\n");

  const title = (B.schoolName || 'Iskola') + ' — Digitális Évkönyv ' + (B.currentYear || '');

  return '<!DOCTYPE html>\n<html lang="hu">\n<head>\n<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + title.replace(/</g, '&' + 'lt;') + '</title>\n' +
    '<style>' + css + '</style>\n</head>\n<body>\n' +
    '<div class="topbar">📖 <span>' + (B.schoolName || '').replace(/</g, '&' + 'lt;') + '</span><span class="yr">' +
    ((B.currentYear || 2026) - 1) + '/' + (B.currentYear || 2026) + '</span></div>\n' +
    '<div class="stage" id="stage"><div class="book" id="book"><div class="spine"></div></div></div>\n' +
    '<div class="controls"><button class="nbtn" id="prev">&#10094;</button><span class="pos" id="pos">Borító</span>' +
    '<button class="nbtn" id="next">&#10095;</button></div>\n' +
    '<div class="hint">Lapozás: nyilak vagy gombok · Nagyítás: kattintás a könyvre</div>\n' +
    '<script>\n' + js + '\n<\/script>\n</body>\n</html>';
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function topBtn() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
    borderRadius: 8, fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
    border: '1px solid #2e2a45', background: '#1e1b2e', color: '#e2e8f0', transition: 'all 0.15s',
  };
}
const navBtn = {
  width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)',
  background: 'rgba(124,58,237,0.25)', color: '#a855f7', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
};