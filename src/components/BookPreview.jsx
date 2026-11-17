/**
 * BookPreview — 2 oldal egymás mellett, lapozható
 * Ugyanaz a layout mint a PrintBook, de kattintható/szerkeszthető.
 * Jobb oldali panel: szöveg szerkesztés, képválasztás, 2. cikk opció.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, ZoomIn, ZoomOut, Search } from 'lucide-react';
import { PageContent } from './Editor';
import { getVisibleEventImages, normalizeEventImages, cleanEventText, getEventImageGrid, splitEventTitle, renderMarkdown } from '../utils/media';

// Inline helper — nem importálunk InteractiveCanvas-t (körkörös import elkerülése)
function isElemHiddenLocal(page, elemId, bookData) {
  if (!page) return false;
  return bookData?.pageLayouts?.[page.id]?.hidden?.[elemId] === true;
}

// ── Custom elemek overlay — feliratok, hozzáadott képek ──────────────────────
export function CustomElementsOverlay({ page, bookData }) {
  const elems = bookData?.pageLayouts?.[page?.id]?.customElements || [];
  if (!elems.length) return null;
  return (
    <>
      {elems.map(elem => (
        <div key={elem.id} style={{
          position: 'absolute',
          left: `${elem.x}%`, top: `${elem.y}%`,
          width: `${elem.w}%`, height: `${elem.h}%`,
          zIndex: (elem.zIndex || 10) + 50,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          display: 'flex', alignItems: 'center',
          justifyContent: elem.textAlign === 'center' ? 'center' : elem.textAlign === 'right' ? 'flex-end' : 'flex-start',
        }}>
          {elem.type === 'image' && elem.src && (
            <img src={elem.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {elem.type === 'text' && (
            <div style={{
              fontSize:      elem.fontSize ? `${elem.fontSize}px` : '14px',
              color:         elem.color         || '#1f2937',
              fontFamily:    elem.fontFamily     || "'Inter', sans-serif",
              fontWeight:    elem.fontWeight     || (elem.bold ? 700 : 400),
              fontStyle:     elem.fontStyle      || (elem.italic ? 'italic' : 'normal'),
              textAlign:     elem.textAlign      || 'left',
              letterSpacing: elem.letterSpacing  || 'normal',
              textShadow:    elem.textShadow     || 'none',
              background:    elem.background     || 'transparent',
              padding:       elem.padding        || 0,
              borderRadius:  elem.borderRadius   || 0,
              border:        elem.border         || 'none',
              width: '100%', height: '100%',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.4,
              display: 'flex', alignItems: 'center',
              justifyContent: elem.textAlign === 'center' ? 'center' : elem.textAlign === 'right' ? 'flex-end' : 'flex-start',
              boxSizing: 'border-box',
            }}>{elem.text}</div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Byzantine (görögkatolikus) kereszt — alapértelmezett jelképes logó ──────
export function ByzantineCross({ size = 24, color = '#f59e0b' }) {
  return <span style={{ fontSize: size, color }}>✝</span>;
}

const monthOrder = [6, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 7];
function sortEventsDesc(events) {
  return [...events].sort((a, b) => {
    const ma = new Date(a.dateSort || '').getMonth() + 1, mb = new Date(b.dateSort || '').getMonth() + 1;
    const oa = monthOrder.indexOf(ma), ob = monthOrder.indexOf(mb);
    if (oa !== ob) return oa - ob;
    return (b.dateSort || '').localeCompare(a.dateSort || '');
  });
}
function getSchoolYears(events) {
  // Legfrissebb tanév elöl (pl. 2025/2026 -> 2024/2025)
  return [...new Set(events.map(e => e.schoolYear).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

export function isShortEvent(evt) {
  if (!evt) return false;
  const len = (evt.text || '').length;
  const imgs = (evt.images || []).length;
  return len <= 280 && imgs <= 2;
}

// Build flat ordered page list — same order as PrintBook
export function buildPages(bookData) {
  const pages = [];
  pages.push({ id: 'cover', type: 'cover' });
  pages.push({ id: 'principal', type: 'principal' });
  
  // Faculty staff page — csak akkor jelenik meg, ha van pedagógus
  if ((bookData.teachers || []).length > 0) pages.push({ id: 'teachers', type: 'teachers' });

  // Class pages
  (bookData.classes || []).forEach(cls => {
    pages.push({ id: `class_${cls.id}`, type: 'class', classId: cls.id });
  });

  [...bookData.graduationPages].sort((a, b) => b.year - a.year).forEach(g =>
    pages.push({ id: `grad_${g.id}`, type: 'graduation', data: g })
  );

  // Build a set of paired event IDs from dualPairs
  const dualPairs = bookData.dualPairs || [];
  const pairedIds = new Set(dualPairs.flat());

  getSchoolYears(bookData.events).forEach(sy => {
    pages.push({ id: `div_${sy}`, type: 'divider', schoolYear: sy });
    const syEvents = sortEventsDesc((bookData.events || []).filter(e => e.schoolYear === sy));

    // Build a map: eventId -> paired partner id (from dualPairs)
    const pairMap = {};
    dualPairs.forEach(([a, b]) => { pairMap[a] = b; pairMap[b] = a; });

    const usedIds = new Set();
    syEvents.forEach(evt => {
      if (usedIds.has(evt.id)) return;
      // Check if this event is the FIRST of a pair
      const partnerId = pairMap[evt.id];
      const partner = partnerId ? syEvents.find(e => e.id === partnerId) : null;
      if (partner && !usedIds.has(partner.id)) {
        pages.push({
          id: `dual_${evt.id}_${partner.id}`,
          type: 'dual_event',
          eventIds: [evt.id, partner.id],
          event1: evt,
          event2: partner,
          schoolYear: sy,
        });
        usedIds.add(evt.id);
        usedIds.add(partner.id);
      } else {
        pages.push({ id: evt.id, type: 'event', eventId: evt.id });
        usedIds.add(evt.id);
      }
    });
  });
  return pages;
}

// Pair pages into spreads: [left, right]
function buildSpreads(pages) {
  const spreads = [];
  spreads.push([pages[0], null]); // cover alone
  let i = 1;
  while (i < pages.length) {
    spreads.push([pages[i] || null, pages[i + 1] || null]);
    i += 2;
  }
  return spreads;
}

export default function BookPreview({ bookData, setBookData, setViewMode }) {
  const pages = buildPages(bookData);
  const spreads = buildSpreads(pages);
  const [spreadIdx, setSpreadIdx] = useState(0);
  const [editingId, setEditingId] = useState(null); // event id being edited
  const [zoom, setZoom] = useState(1);
  const [lensEnabled, setLensEnabled] = useState(true);

  const goNext = useCallback(() => setSpreadIdx(i => Math.min(spreads.length - 1, i + 1)), [spreads.length]);
  const goPrev = useCallback(() => setSpreadIdx(i => Math.max(0, i - 1)), []);
  const zoomIn = useCallback(() => setZoom(z => Math.min(3, Math.round((z + 0.25) * 100) / 100)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100)), []);
  const zoomReset = useCallback(() => setZoom(1), []);
  
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomOut(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev, zoomIn, zoomOut, zoomReset]);

  // Egér görgetés: lapozás; Ctrl/Cmd+görgő: zoom (nem-passzív, hogy a böngésző zoomját lehessen tiltani)
  const lastScrollTimeRef = React.useRef(0);
  const rootRef = React.useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      if (e.target.closest('textarea') || e.target.closest('input') || e.target.closest('.preview-editor-panel')) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else if (e.deltaY > 0) zoomOut();
        return;
      }

      // Zoomolt nézetben engedjük a belső scrollt, ne lapozzon
      if (zoom > 1) return;

      const now = Date.now();
      if (now - lastScrollTimeRef.current < 250) return;

      if (e.deltaY > 20 || e.deltaX > 20) {
        lastScrollTimeRef.current = now;
        goNext();
      } else if (e.deltaY < -20 || e.deltaX < -20) {
        lastScrollTimeRef.current = now;
        goPrev();
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [goNext, goPrev, zoom, zoomIn, zoomOut]);

  const [left, right] = spreads[spreadIdx];

  const getEvent = id => (bookData.events || []).find(e => e.id === id);
  const editingEvent = editingId ? getEvent(editingId) : null;

  const updateEvent = (updated) => {
    setBookData(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === updated.id ? updated : e)
    }));
  };

  const handlePageClick = (page) => {
    if (page?.type === 'event') {
      setEditingId(editingId === page.eventId ? null : page.eventId);
    } else if (page?.type === 'dual_event') {
      setEditingId(editingId === page.eventIds?.[0] ? page.eventIds?.[1] : page.eventIds?.[0]);
    } else {
      setEditingId(null);
    }
  };

  return (
    <div
      ref={rootRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0e17', overflow: 'hidden', fontFamily: "'Inter',sans-serif" }}
    >

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56, background: 'rgba(15,14,23,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => setViewMode('editor')} style={topBtn('ghost')}>
          <ArrowLeft size={15} /> Vissza
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {bookData.schoolName} — Évkönyv előnézet
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setViewMode('print')} style={topBtn('ghost')}>
            <Printer size={14} /> Nyomtatás
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Book area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: zoom > 1 ? 'flex-start' : 'center',
          padding: '16px 60px', position: 'relative',
          overflow: zoom !== 1 ? 'auto' : 'hidden',
          gap: 12,
        }}>

          {/* Spread */}
          <div style={{
            display: 'flex', alignItems: 'stretch', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', borderRadius: 3, overflow: 'hidden',
            maxHeight: zoom === 1 ? 'calc(100vh - 130px)' : 'none',
            width: '100%', maxWidth: 980, flexShrink: 0,
            zoom,
          }}>
            <PageSlot page={left} bookData={bookData} isEditing={editingId === left?.eventId} onClick={() => handlePageClick(left)} lensEnabled={lensEnabled} />
            <div style={{ width: 6, background: 'linear-gradient(to right,#0a0914,#1a1830,#0a0914)', flexShrink: 0 }} />
            <PageSlot page={right} bookData={bookData} isEditing={editingId === right?.eventId} onClick={() => handlePageClick(right)} lensEnabled={lensEnabled} />
          </div>

          {/* Nav arrows */}
          <button onClick={goPrev} disabled={spreadIdx === 0} style={{ ...navArrow, left: 12 }}>
            <ChevronLeft size={22} />
          </button>
          <button onClick={goNext} disabled={spreadIdx === spreads.length - 1} style={{ ...navArrow, right: 12 }}>
            <ChevronRight size={22} />
          </button>

          {/* Progress + Zoom */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'sticky', bottom: 0, paddingBottom: 4, zIndex: 5 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {spreads.map((_, i) => (
                <button key={i} onClick={() => setSpreadIdx(i)} style={{ width: i === spreadIdx ? 18 : 6, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: i === spreadIdx ? '#a855f7' : 'rgba(255,255,255,0.15)', padding: 0 }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {spreadIdx + 1} / {spreads.length} · ← →
              </span>
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)' }} />
              <button
                onClick={() => setLensEnabled(v => !v)}
                style={{
                  ...zoomBtn,
                  padding: '0 9px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: lensEnabled ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  borderColor: lensEnabled ? '#a855f7' : 'rgba(255,255,255,0.12)',
                }}
                title="Nagyító lencse ki/be kapcsolása"
              >
                <Search size={13} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>Nagyító {lensEnabled ? 'BE' : 'KI'}</span>
              </button>
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)' }} />
              <button onClick={zoomOut} disabled={zoom <= 0.5} style={{ ...zoomBtn, opacity: zoom <= 0.5 ? 0.35 : 1 }} title="Kicsinyítés (Ctrl+−)">
                <ZoomOut size={14} />
              </button>
              <button onClick={zoomReset} style={{ ...zoomBtn, minWidth: 48, fontSize: 11, fontWeight: 700 }} title="Eredeti méret (Ctrl+0)">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={zoomIn} disabled={zoom >= 3} style={{ ...zoomBtn, opacity: zoom >= 3 ? 0.35 : 1 }} title="Nagyítás (Ctrl++)">
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Editor panel */}
        <div className="preview-editor-panel" style={{ display: 'flex' }}>
          <EditorPanel event={editingEvent} onUpdate={updateEvent} onClose={() => setEditingId(null)} />
        </div>
      </div>
    </div>
  );
}

// ── Page inner content helper — teljes összhang a Szerkesztővel ──────────────
function renderPageInner(page, bookData) {
  if (!page) return null;
  return (
    <>
      <PageContent page={page} bookData={bookData} />
      <CustomElementsOverlay page={page} bookData={bookData} />
    </>
  );
}

// ── Page slot: renders one side of the spread with optional Magnifier Lens ────
function PageSlot({ page, bookData, isEditing, onClick, lensEnabled = true }) {
  const isEmpty = !page;
  const containerRef = React.useRef(null);
  const [lensPos, setLensPos] = React.useState(null); // { x, y, width, height }

  const handleMouseMove = (e) => {
    if (!lensEnabled || isEmpty || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      setLensPos({ x, y, width: rect.width, height: rect.height });
    } else {
      setLensPos(null);
    }
  };

  const handleMouseLeave = () => {
    setLensPos(null);
  };

  const lensSize = 180; // lencse átmérője px-ben
  const zoomFactor = 2.2; // nagyítás mértéke

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        flex: 1, background: isEmpty ? '#1a1830' : '#fff', position: 'relative',
        cursor: page?.type === 'event' ? 'pointer' : 'default',
        outline: isEditing ? '3px solid #a855f7' : 'none',
        outlineOffset: -3,
        minWidth: 0, overflow: 'hidden',
        aspectRatio: '210/297',
        maxWidth: 490,
        zIndex: 1,
      }}
    >
      {isEmpty && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.05)', fontSize: 13 }}>—</span>
        </div>
      )}

      {renderPageInner(page, bookData)}

      {page?.type === 'event' && (
        <div style={{ position: 'absolute', bottom: 6, right: 8, background: isEditing ? '#7c3aed' : 'rgba(124,58,237,0.75)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, pointerEvents: 'none', zIndex: 10 }}>
          {isEditing ? 'SZERKESZTÉS' : '✏ Katt a szerkesztéshez'}
        </div>
      )}

      {/* Magnifier Lens — interaktív nagyító lencse */}
      {lensEnabled && lensPos && !isEmpty && (
        <div
          style={{
            position: 'absolute',
            left: lensPos.x - lensSize / 2,
            top: lensPos.y - lensSize / 2,
            width: lensSize,
            height: lensSize,
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.95)',
            boxShadow: '0 10px 32px rgba(0,0,0,0.75), inset 0 0 20px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 100,
            background: '#fff',
          }}
        >
          {/* Kinagyított belső tartalom pont az egér fókuszában */}
          <div
            style={{
              position: 'absolute',
              width: lensPos.width,
              height: lensPos.height,
              left: -(lensPos.x - lensSize / 2),
              top: -(lensPos.y - lensSize / 2),
              transform: `scale(${zoomFactor})`,
              transformOrigin: `${lensPos.x}px ${lensPos.y}px`,
              pointerEvents: 'none',
            }}
          >
            {renderPageInner(page, bookData)}
          </div>
          {/* Lencse tükröződés és optikai keret hatás */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 45%, rgba(0,0,0,0.12) 100%)',
              pointerEvents: 'none',
              boxShadow: 'inset 0 0 10px rgba(124,58,237,0.25)',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Page content — same styles as Editor.jsx & PrintBook ──────────────────────
export function CoverContent({ bookData }) {
  const g = [...bookData.graduationPages].sort((a, b) => b.year - a.year)[0];
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #090d16 0%, #17153a 45%, #2a1147 100%)', color: '#fff', display: 'flex', flexDirection: 'column', padding: '8%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
      {/* Byzantine Filigree Gold Border Frame */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, border: '2px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, border: '1px solid rgba(245, 158, 11, 0.25)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'auto', position: 'relative', zIndex: 1 }}>
        {bookData.schoolLogo
          ? <img src={bookData.schoolLogo} alt="" style={{ height: 20, objectFit: 'contain' }} />
          : <ByzantineCross size={20} color="#fbbf24" />}
        <span style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff' }}>{bookData.schoolName}</span>
      </div>
      <div style={{ flex: 1, margin: '6% 0', borderRadius: 8, overflow: 'hidden', maxHeight: '55%', position: 'relative', zIndex: 1, isolation: 'isolate' }}>
        {/* Gold border overlay on photo */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, border: '2px solid #d97706', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.3), 0 8px 24px rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: 10 }} />
        {g?.image
          ? <img src={g.image} alt="" style={{
              position: 'absolute', inset: 0,
              width: `${bookData.coverPhotoZoom || 100}%`,
              height: `${bookData.coverPhotoZoom || 100}%`,
              objectFit: 'cover', objectPosition: 'center',
              left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              display: 'block',
            }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(124, 58, 237, 0.15))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ByzantineCross size={42} color="#fbbf24" />
              <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>Iskolai Évkönyv</span>
            </div>}
      </div>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '30pt', fontWeight: 900, background: 'linear-gradient(135deg, #fef08a, #f59e0b, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.08em', lineHeight: 1 }}>ÉVKÖNYV</div>
        <div style={{ fontSize: '9pt', fontWeight: 700, color: '#fef3c7', background: 'rgba(217, 119, 6, 0.3)', padding: '3px 14px', borderRadius: 12, border: '1px solid #d97706', marginTop: 6, letterSpacing: '0.1em', display: 'inline-block' }}>{bookData.currentYear - 1} / {bookData.currentYear} TANÉV</div>
      </div>
    </div>
  );
}

export function PrincipalContent({ bookData }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '8% 8% 6%', flexShrink: 0, borderBottom: '3px solid #f59e0b' }}>
        <div style={{ fontSize: '6pt', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 4 }}>{bookData.schoolName}</div>
        <div style={{ fontSize: '16pt', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Igazgatói<br />köszöntő</div>
      </div>
      <div style={{ flex: 1, padding: '6% 8%', display: 'flex', gap: '5%', overflow: 'hidden' }}>
        {bookData.principalPhoto && <img src={bookData.principalPhoto} alt="" style={{ width: 50, height: 65, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '2px solid #d97706', background: '#fef3c7' }} />}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '7pt', lineHeight: 1.8, color: '#1e293b', borderLeft: '4px solid #d97706', paddingLeft: 6, fontStyle: 'italic', overflow: 'hidden', background: 'linear-gradient(135deg, #fffcf5 0%, #fef9c3 100%)', border: '1px solid #fef08a', borderLeftWidth: 4, borderRadius: '0 8px 8px 0', padding: '5px 8px' }}>{bookData.principalQuote || <span style={{ opacity: 0.3 }}>Üzenet...</span>}</div>
          {bookData.principalName && (
            <div style={{ fontSize: '6pt', fontWeight: 800, color: '#b45309', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
              {bookData.showPrincipalCross && <ByzantineCross size={8} color="#b45309" />}
              {bookData.showPrincipalCross && ' — '}
              {bookData.principalName}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '2% 6%', borderTop: '1px solid #f1f5f9', fontSize: '6pt', color: '#64748b' }}>{bookData.schoolName}</div>
    </div>
  );
}

export function TeachersContent({ bookData }) {
  const teachers = bookData.teachers || [];
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '8% 8% 6%', flexShrink: 0, borderBottom: '3px solid #f59e0b' }}>
        <div style={{ fontSize: '6pt', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 4 }}>{bookData.schoolName}</div>
        <div style={{ fontSize: '16pt', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Tanári Kar</div>
      </div>
      <div style={{ flex: 1, padding: '6% 8%', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4%', alignContent: 'start' }}>
        {teachers.map(t => (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #fef08a', borderRadius: 8, padding: 6, background: 'linear-gradient(135deg, #fffcf5, #fefce8)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ width: '48px', height: '62px', borderRadius: '6px', background: '#fef3c7', overflow: 'hidden', border: '1.5px solid #d97706', marginBottom: '4px', flexShrink: 0 }}>
              {t.photo ? <img src={t.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ByzantineCross size={18} color="#d97706" /></div>}
            </div>
            <div style={{ fontSize: '7px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{t.name || 'Név...'}</div>
            <div style={{ fontSize: '6px', color: '#b45309', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{t.subject || 'Szak...'}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '2% 6%', borderTop: '1px solid #f1f5f9', fontSize: '6pt', color: '#64748b' }}>{bookData.schoolName}</div>
    </div>
  );
}

export function ClassContent({ classData, bookData }) {
  if (!classData) return <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', color: '#ccc' }}>Osztály nem található</div>;
  const students = classData.students || [];
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '6% 8% 5%', flexShrink: 0, borderBottom: '3px solid #f59e0b' }}>
        <div style={{ fontSize: '5.5pt', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 2 }}>{bookData.schoolName} • Osztálytabló</div>
        <div style={{ fontSize: '14pt', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{classData.className} Osztály</div>
      </div>

      <div style={{ flex: 1, padding: '4% 6%', display: 'flex', flexDirection: 'column', gap: '3%', minHeight: 0, overflow: 'hidden' }}>
        {/* Top: Class teacher & Group Photo */}
        <div style={{ display: 'flex', gap: '4%', height: '35%', flexShrink: 0 }}>
          {/* Teacher */}
          <div style={{ width: '32%', display: 'flex', gap: '8px', border: '1.5px solid #f59e0b', borderRadius: '8px', padding: '6px', background: 'linear-gradient(135deg, #fffcf5, #fefce8)', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '36px', height: '48px', borderRadius: '5px', background: '#fef3c7', overflow: 'hidden', border: '1px solid #d97706', flexShrink: 0 }}>
              {classData.classTeacherPhoto ? <img src={classData.classTeacherPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ByzantineCross size={14} color="#d97706" /></div>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '4.5px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Osztályfőnök</div>
              <div style={{ fontSize: '6.5px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{classData.classTeacherName || 'Név...'}</div>
            </div>
          </div>

          {/* Group Photo */}
          <div style={{ flex: 1, borderRadius: '8px', background: '#fefce8', overflow: 'hidden', border: '1.5px solid #d97706' }}>
            {classData.groupPhoto ? <img src={classData.groupPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#b45309' }}>Közös osztálykép helye</div>}
          </div>
        </div>

        {/* Bottom: Students Grid */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3%', alignContent: 'start' }}>
          {students.map(s => (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #fef08a', borderRadius: 6, padding: 4, background: '#fffcf5' }}>
              <div style={{ width: '36px', height: '44px', borderRadius: '4px', background: '#fef3c7', overflow: 'hidden', border: '1px solid #f59e0b', marginBottom: '3px' }}>
                {s.photo ? <img src={s.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ByzantineCross size={12} color="#f59e0b" /></div>}
              </div>
              <div style={{ fontSize: '6px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{s.name || 'Tanuló...'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '2% 6%', borderTop: '1px solid #f1f5f9', fontSize: '6pt', color: '#64748b' }}>{bookData.schoolName}</div>
    </div>
  );
}

export function GradContent({ grad, bookData }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '6% 8% 5%', flexShrink: 0, borderBottom: '3px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '6pt', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 3 }}>{bookData.schoolName} • Ballagás</div>
          <div style={{ fontSize: '16pt', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{grad.caption}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: '#000', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', padding: '3px 10px', borderRadius: 6, letterSpacing: '0.05em' }}>
          {grad.year}
        </span>
      </div>
      <div style={{ flex: 1, margin: '4% 8%', borderRadius: 8, overflow: 'hidden', minHeight: 0, border: '2.5px solid #d97706', background: '#fefce8' }}>
        {grad.image
          ? <img src={grad.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', border: '2px dashed #f59e0b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fffdf5' }}>
              <ByzantineCross size={40} color="#f59e0b" />
              <span style={{ color: '#b45309', fontSize: '7pt', fontWeight: 800 }}>Tabló kép helye</span>
            </div>}
      </div>
      <div style={{ padding: '2% 6%', borderTop: '1px solid #f1f5f9', fontSize: '6pt', color: '#64748b' }}>{bookData.schoolName}</div>
    </div>
  );
}

export function DividerContent({ schoolYear, bookData }) {
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #090d16 0%, #17153a 45%, #2a1147 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
      {bookData.schoolLogo
        ? <img src={bookData.schoolLogo} alt="" style={{ height: 32, objectFit: 'contain', opacity: 0.7, marginBottom: 10 }} />
        : <ByzantineCross size={34} color="#fbbf24" />}
      <div style={{ fontSize: '9pt', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fbbf24', fontWeight: 800 }}>Tanév Eseményei</div>
      <div style={{ fontSize: '32pt', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{schoolYear}</div>
      <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, #f59e0b, #ec4899)', borderRadius: 2, marginTop: 6 }} />
      <div style={{ fontSize: '7pt', opacity: 0.7, color: '#fef08a', marginTop: 4 }}>{bookData.schoolName}</div>
    </div>
  );
}

export function EventContent({ event, bookData }) {
  if (!event) return <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '8pt' }}>Esemény nem található</div>;
  const imgs = getVisibleEventImages(event);
  // Fix 3: respect event.imageLayout
  function getGridByLayout(layout, count) {
    if (layout === 'hero') return { cols: 2, rows: 2, hero: true, single: false };
    if (layout === 'rows') return { cols: 1, rows: count, hero: false, single: count === 1 };
    return getEventImageGrid(count); // 'grid', 'auto', or unset
  }
  const grid = getGridByLayout(event.imageLayout, imgs.length);
  const { title, body } = splitEventTitle(event.text);
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', padding: '6%', gap: '4%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f59e0b', paddingBottom: '3%', flexShrink: 0, background: '#fffcf5', padding: '0 2% 3%' }}>
        <span style={{ fontSize: '6pt', fontWeight: 800, color: '#1e1b4b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{bookData.schoolName}</span>
        <span style={{ fontSize: '6pt', color: '#b45309', fontWeight: 700 }}>{event.date}</span>
      </div>
      {imgs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: grid.hero ? '1.6fr 1fr' : `repeat(${grid.cols}, 1fr)`,
          gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
          gap: '2%',
          flex: '0 0 46%',
          minHeight: 60,
          borderRadius: 4,
          overflow: 'hidden',
          background: grid.single ? '#f8fafc' : '#f8fafc',
          border: '1px solid #fef08a',
        }}>
          {imgs.map((img, i) => (
            <div key={i} style={{ gridRow: grid.hero && i === 0 ? 'span 2' : 'auto', overflow: 'hidden', background: '#f3f4f6', minHeight: 40, position: 'relative', borderRadius: 3, isolation: 'isolate' }}>
              <img src={img.thumbnail || img.url} referrerPolicy="no-referrer" alt="" style={{
                position: 'absolute', left: '50%', top: '50%',
                width: `${event.imageZoom || 100}%`, height: `${event.imageZoom || 100}%`,
                transform: 'translate(-50%, -50%)',
                objectFit: grid.single ? 'contain' : 'cover',
                display: 'block',
              }} />
              {event.imageBorder === true && (
                <div style={{ position: 'absolute', inset: 0, border: '2px solid #d97706', borderRadius: 3, pointerEvents: 'none', zIndex: 2 }} />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '2%', overflow: 'auto' }}>
        {title && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.2 }}>{title}</div>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg,#d97706,#f59e0b)', margin: '2px auto 0', borderRadius: 2 }} />
          </div>
        )}
        {body && (
          <div style={{
            background: 'linear-gradient(135deg,#fffcf5,#fef9c3)', borderLeft: '3px solid #d97706',
            borderRadius: '0 8px 8px 0', padding: '5px 8px',
            fontSize: event.fontSize ? `${event.fontSize}pt` : '6.5pt',
            lineHeight: event.lineHeight || 1.55,
            color: '#1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            flex: '1 1 0', minHeight: 0, overflowY: 'auto',
          }}>
            {renderMarkdown(body)}
          </div>
        )}
      </div>
      <div style={{ fontSize: '5.5pt', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '2%', textAlign: 'center', flexShrink: 0 }}>
        {bookData.schoolName} • {event.schoolYear} tanév
      </div>
    </div>
  );
}

// ── Editor panel ──────────────────────────────────────────────────────────────
function EditorPanel({ event, onUpdate, onClose }) {
  const [localText, setLocalText] = useState('');
  const [localImages, setLocalImages] = useState([]);
  const [localFontSize, setLocalFontSize] = useState(11);
  const [localLineHeight, setLocalLineHeight] = useState(1.7);

  useEffect(() => {
    if (event) {
      setLocalText(event.text || '');
      setLocalImages(normalizeEventImages(event.images));
      setLocalFontSize(event.fontSize || 11);
      setLocalLineHeight(event.lineHeight || 1.7);
    }
  }, [event?.id]);

  const save = () => {
    onUpdate({ ...event, text: localText, images: localImages, fontSize: localFontSize, lineHeight: localLineHeight });
  };

  const toggleImage = (idx) => {
    const images = normalizeEventImages(event?.images);
    setLocalImages(prev => {
      if (prev.includes(images[idx])) {
        return prev.filter(img => img !== images[idx]);
      } else {
        return [...prev, images[idx]];
      }
    });
  };

  const normalizedImages = normalizeEventImages(event?.images);
  const isSelected = (idx) => localImages.includes(normalizedImages[idx]);
  const selOrder = (idx) => localImages.indexOf(normalizedImages[idx]);

  if (!event) {
    return (
      <div style={{ width: 280, flexShrink: 0, background: '#0c0b14', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✏</div>
          <div style={{ fontSize: 12 }}>Kattints egy esemény<br />oldalra a szerkesztéshez</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 300, flexShrink: 0, background: '#0c0b14', borderLeft: '1px solid rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Oldal szerkesztése</div>
          <div style={{ fontSize: 11, color: '#a855f7', marginTop: 2 }}>{event.date}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#8c88a5', cursor: 'pointer', padding: '4px 8px', fontSize: 13 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {normalizedImages.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8c88a5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Képek (kattints a be/kikapcsoláshoz, max 3)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {normalizedImages.map((img, idx) => {
                const sel = isSelected(idx);
                const ord = selOrder(idx);
                return (
                  <div key={idx} onClick={() => toggleImage(idx)} style={{
                    position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                    cursor: 'pointer', border: `2.5px solid ${sel ? '#a855f7' : 'transparent'}`,
                    opacity: sel ? 1 : 0.35, transition: 'all 0.15s',
                  }}>
                    <img src={img.thumbnail || img.url} referrerPolicy="no-referrer" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {sel && (
                      <div style={{ position: 'absolute', bottom: 3, right: 3, background: '#7c3aed', borderRadius: 4, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800 }}>
                        {ord + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8c88a5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Szöveg
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#8c88a5', marginBottom: 4 }}>Betűméret</div>
              <select
                value={localFontSize}
                onChange={e => setLocalFontSize(Number(e.target.value))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e5e3f0', padding: '6px 8px', fontSize: 12 }}
              >
                {[9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22].map(s => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#8c88a5', marginBottom: 4 }}>Sorköz</div>
              <select
                value={localLineHeight}
                onChange={e => setLocalLineHeight(Number(e.target.value))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e5e3f0', padding: '6px 8px', fontSize: 12 }}
              >
                {[1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0].map(lh => (
                  <option key={lh} value={lh}>{lh}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={localText}
            onChange={e => setLocalText(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', minHeight: 180,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.7,
              color: '#e5e3f0', resize: 'vertical', fontFamily: "'Inter',sans-serif",
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#7c3aed'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            placeholder="Esemény szövege..."
          />
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={save} style={{
          width: '100%', padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none',
          color: '#fff', cursor: 'pointer',
        }}>
          ✓ Mentés
        </button>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function topBtn(type) {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s' };
  if (type === 'primary') return { ...base, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', borderColor: 'transparent', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)' };
  return { ...base, background: '#1e1b2e', color: '#e2e8f0', borderColor: '#2e2a45' };
}
const navArrow = {
  position: 'absolute', top: '45%', transform: 'translateY(-50%)',
  background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(168,85,247,0.4)',
  color: '#a855f7', borderRadius: '50%', width: 44, height: 44,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', backdropFilter: 'blur(8px)', zIndex: 10,
  transition: 'all 0.15s',
};
const zoomBtn = {
  background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(168,85,247,0.4)',
  color: '#a855f7', borderRadius: 8, height: 32, minWidth: 32, padding: '0 8px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', backdropFilter: 'blur(8px)',
};
