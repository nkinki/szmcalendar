/**
 * PageComposer — drag & drop oldaltervező
 * 
 * Bal oldal: esemény lista (húzható kártyák)
 * Jobb oldal: oldalak listája, ahova húzhatók az események
 * Minden oldalon kiválasztható melyik képek jelenjenek meg
 */
import React, { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, Image as ImageIcon, X, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { normalizeEventImages } from '../utils/media';

const MONTH_ORDER = [6, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 7];

function sortEventsDesc(events) {
  return [...events].sort((a, b) => {
    const ma = new Date(a.dateSort || '').getMonth() + 1;
    const mb = new Date(b.dateSort || '').getMonth() + 1;
    const oa = MONTH_ORDER.indexOf(ma);
    const ob = MONTH_ORDER.indexOf(mb);
    if (oa !== ob) return oa - ob;
    return (b.dateSort || '').localeCompare(a.dateSort || '');
  });
}

function getSchoolYears(events) {
  const years = [...new Set(events.map(e => e.schoolYear).filter(Boolean))];
  return years.sort((a, b) => b.localeCompare(a));
}

// Find which page slot contains this event
function findEventInPages(pages, eventId) {
  for (const page of pages) {
    for (const slot of page.slots) {
      if (slot.eventId === eventId) return page.id;
    }
  }
  return null;
}

export default function PageComposer({ bookData, setBookData, setViewMode }) {
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [dragOverPageId, setDragOverPageId] = useState(null);
  const [expandedYears, setExpandedYears] = useState({});
  const [previewPage, setPreviewPage] = useState(null);
  const [maxSlotsPerPage, setMaxSlotsPerPage] = useState(bookData.maxSlotsPerPage || 2);

  // composedPages: [{ id, slots: [{ eventId, selectedImages: [idx,...] }] }]
  const pages = bookData.composedPages || [];
  const events = bookData.events || [];

  const updatePages = (newPages) => setBookData(prev => ({ ...prev, composedPages: newPages }));

  // Reflow all placed events into pages with given max per page, preserving order
  const reflowPages = (newMax) => {
    setMaxSlotsPerPage(newMax);
    // collect placed events in order of pages and slots
    const placed = [];
    for (const p of pages) {
      for (const s of p.slots) {
        placed.push(s);
      }
    }
    // rebuild pages
    const rebuilt = [];
    let currentPageSlots = [];
    let pageIdCounter = Date.now();
    for (const slot of placed) {
      if (currentPageSlots.length >= newMax) {
        rebuilt.push({ id: `page_${pageIdCounter++}`, slots: [...currentPageSlots] });
        currentPageSlots = [];
      }
      currentPageSlots.push(slot);
    }
    if (currentPageSlots.length > 0) {
      rebuilt.push({ id: `page_${pageIdCounter++}`, slots: [...currentPageSlots] });
    }
    updatePages(rebuilt);
  };

  // Events not yet placed on any page
  const placedEventIds = new Set(pages.flatMap(p => p.slots.map(s => s.eventId)));
  const unplacedEvents = sortEventsDesc(events.filter(e => !placedEventIds.has(e.id)));
  const schoolYears = getSchoolYears(unplacedEvents);

  // ── Page CRUD ──
  const addPage = () => {
    updatePages([...pages, { id: `page_${Date.now()}`, slots: [] }]);
  };

  const deletePage = (pageId) => {
    updatePages(pages.filter(p => p.id !== pageId));
  };

  const movePageUp = (idx) => {
    if (idx === 0) return;
    const next = [...pages];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    updatePages(next);
  };

  const movePageDown = (idx) => {
    if (idx === pages.length - 1) return;
    const next = [...pages];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    updatePages(next);
  };

  // ── Slot CRUD ──
  const removeSlot = (pageId, eventId) => {
    updatePages(pages.map(p => p.id === pageId
      ? { ...p, slots: p.slots.filter(s => s.eventId !== eventId) }
      : p
    ));
  };

  const toggleImage = (pageId, eventId, imgIdx) => {
    updatePages(pages.map(p => {
      if (p.id !== pageId) return p;
      return {
        ...p,
        slots: p.slots.map(s => {
          if (s.eventId !== eventId) return s;
          const sel = s.selectedImages || [];
          const next = sel.includes(imgIdx)
            ? sel.filter(i => i !== imgIdx)
            : [...sel, imgIdx].slice(0, 3); // max 3 képet
          return { ...s, selectedImages: next };
        })
      };
    }));
  };

  // ── Drag & Drop ──
  const handleDragStart = (e, eventId) => {
    setDraggedEventId(eventId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, pageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPageId(pageId);
  };

  const handleDrop = (e, pageId) => {
    e.preventDefault();
    setDragOverPageId(null);
    if (!draggedEventId) return;

    const targetPage = pages.find(p => p.id === pageId);
    if (!targetPage) return;
    if (targetPage.slots.length >= maxSlotsPerPage) return; // max slot/oldal
    if (targetPage.slots.find(s => s.eventId === draggedEventId)) return; // már rajta van

    // Remove from old page if it was placed
    const cleaned = pages.map(p => ({
      ...p,
      slots: p.slots.filter(s => s.eventId !== draggedEventId)
    }));

    // Add to target page
    const evt = events.find(e => e.id === draggedEventId);
    const defaultImages = evt ? evt.images.map((_, i) => i).slice(0, 3) : [];

    updatePages(cleaned.map(p => p.id === pageId
      ? { ...p, slots: [...p.slots, { eventId: draggedEventId, selectedImages: defaultImages }] }
      : p
    ));
    setDraggedEventId(null);
  };

  const handleDragEnd = () => {
    setDraggedEventId(null);
    setDragOverPageId(null);
  };

  // Auto-arrange: put all unplaced events 1 per page
  const autoArrange = () => {
    if (!confirm(`${unplacedEvents.length} esemény automatikus elrendezése? Minden esemény külön oldalra kerül.`)) return;
    const newPages = [...pages];
    for (const evt of unplacedEvents) {
      const defaultImages = evt.images.map((_, i) => i).slice(0, 3);
      newPages.push({ id: `page_${Date.now()}_${evt.id}`, slots: [{ eventId: evt.id, selectedImages: defaultImages }] });
    }
    updatePages(newPages);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: 0 }}>

      {/* ── LEFT: Unplaced events ── */}
      <div style={{
        width: 300, flexShrink: 0, background: '#100f1a',
        borderRight: '1px solid #232035', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #232035', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Elhelyezésre váró események
          </div>
          <div style={{ fontSize: 11, color: '#8c88a5', marginBottom: 8 }}>
            {unplacedEvents.length} esemény • Húzd az oldalakra →
          </div>
          {unplacedEvents.length > 0 && (
            <button onClick={autoArrange} style={{
              width: '100%', padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
              color: '#a855f7', cursor: 'pointer',
            }}>
              ⚡ Auto-elrendezés (1 esemény / oldal)
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {unplacedEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4a4760', fontSize: 12 }}>
              ✓ Minden esemény el van helyezve
            </div>
          )}

          {getSchoolYears(unplacedEvents).map(sy => {
            const syEvents = sortEventsDesc(unplacedEvents.filter(e => e.schoolYear === sy));
            const isOpen = expandedYears[sy] !== false; // default open
            return (
              <div key={sy} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => setExpandedYears(prev => ({ ...prev, [sy]: !isOpen }))}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderRadius: 6, background: 'rgba(168,85,247,0.08)',
                    border: 'none', color: '#a855f7', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 4,
                  }}
                >
                  <span>{sy} tanév</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ opacity: 0.6 }}>{syEvents.length}</span>
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </button>

                {isOpen && syEvents.map(evt => (
                  <EventCard
                    key={evt.id}
                    event={evt}
                    isDragging={draggedEventId === evt.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Page composer ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Oldalak összeállítása</div>
          <div style={{ fontSize: 12, color: '#8c88a5', marginTop: 2 }}>
                {pages.length} oldal • Max {maxSlotsPerPage} esemény/oldal • Drag & drop az esemény kártyákat
              </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ color: '#8c88a5', fontSize: 12 }}>
            Max/oldal:
            <select
              value={maxSlotsPerPage}
              onChange={(e) => reflowPages(Number(e.target.value))}
              style={{
                marginLeft: 4,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 12,
              }}
            >
              {[1,2,3,4].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button onClick={addPage} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={14} /> Új oldal
          </button>
        </div>
      </div>

        {pages.length === 0 && (
          <div style={{
            border: '2px dashed #232035', borderRadius: 12, padding: '48px 24px',
            textAlign: 'center', color: '#4a4760',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#8c88a5', marginBottom: 8 }}>
              Még nincsenek oldalak
            </div>
            <div style={{ fontSize: 12 }}>
              Klikk az "Új oldal" gombra, majd húzd rá az eseményeket
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pages.map((page, idx) => (
            <PageSlot
              key={page.id}
              page={page}
              idx={idx}
              total={pages.length}
              events={events}
              isDragOver={dragOverPageId === page.id}
              onDragOver={(e) => handleDragOver(e, page.id)}
              onDragLeave={() => setDragOverPageId(null)}
              onDrop={(e) => handleDrop(e, page.id)}
              onRemoveSlot={removeSlot}
              onToggleImage={toggleImage}
              onMoveUp={() => movePageUp(idx)}
              onMoveDown={() => movePageDown(idx)}
              onDelete={() => deletePage(page.id)}
              onPreview={() => setPreviewPage(page)}
            />
          ))}
        </div>
      </div>

      {/* ── Page mini-preview modal ── */}
      {previewPage && (
        <PagePreviewModal
          page={previewPage}
          events={events}
          bookData={bookData}
          onClose={() => setPreviewPage(null)}
        />
      )}
    </div>
  );
}

// ── Event Card (draggable) ────────────────────────────────────────────────────
function EventCard({ event, isDragging, onDragStart, onDragEnd }) {
  const images = normalizeEventImages(event.images);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, event.id)}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex', gap: 8, padding: '8px', borderRadius: 8, marginBottom: 4,
        background: isDragging ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isDragging ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.06)'}`,
        cursor: 'grab', opacity: isDragging ? 0.5 : 1, transition: 'all 0.15s',
      }}
    >
      <GripVertical size={14} style={{ color: '#4a4760', flexShrink: 0, marginTop: 2 }} />
      {images[0] && (
        <img src={images[0].url} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 600, marginBottom: 2 }}>{event.date}</div>
        <div style={{ fontSize: 11, color: '#d3d1e0', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {event.text || '(nincs szöveg)'}
        </div>
        <div style={{ fontSize: 10, color: '#4a4760', marginTop: 2 }}>{images.length} kép</div>
      </div>
    </div>
  );
}

// ── Page Slot (drop target) ───────────────────────────────────────────────────
function PageSlot({ page, idx, total, events, isDragOver, onDragOver, onDragLeave, onDrop, onRemoveSlot, onToggleImage, onMoveUp, onMoveDown, onDelete, onPreview }) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        borderRadius: 12,
        border: `2px solid ${isDragOver ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
        background: isDragOver ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8c88a5' }}>
            {idx + 1}. oldal
          </span>
          <span style={{ fontSize: 10, color: '#4a4760' }}>
            ({page.slots.length}/2 esemény)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn onClick={onPreview} title="Előnézet" color="#a855f7"><Eye size={12} /></IconBtn>
          <IconBtn onClick={onMoveUp} disabled={idx === 0} title="Fel"><ChevronUp size={12} /></IconBtn>
          <IconBtn onClick={onMoveDown} disabled={idx === total - 1} title="Le"><ChevronDown size={12} /></IconBtn>
          <IconBtn onClick={onDelete} title="Oldal törlése" color="#f87171"><Trash2 size={12} /></IconBtn>
        </div>
      </div>

      {/* Drop zone / slots */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {page.slots.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '20px', color: '#4a4760', fontSize: 12,
            border: '1px dashed #232035', borderRadius: 8,
          }}>
            {isDragOver ? '⬇ Ide húzd az eseményt' : 'Húzz ide egy eseményt a bal listából'}
          </div>
        )}

        {page.slots.map(slot => {
          const evt = events.find(e => e.id === slot.eventId);
          if (!evt) return null;
          return (
            <SlotItem
              key={slot.eventId}
              event={evt}
              slot={slot}
              onRemove={() => onRemoveSlot(page.id, slot.eventId)}
              onToggleImage={(imgIdx) => onToggleImage(page.id, slot.eventId, imgIdx)}
            />
          );
        })}

{page.slots.length < maxSlotsPerPage && (
           <div style={{
             textAlign: 'center', padding: '10px', color: '#4a4760', fontSize: 11,
             border: '1px dashed #232035', borderRadius: 6,
           }}>
             + Húzz ide még {maxSlotsPerPage - page.slots.length} exemplo{(maxSlotsPerPage - page.slots.length > 1 ? 'k' : '')} (opcionális)
           </div>
         )}
      </div>
    </div>
  );
}

// ── Slot Item (event placed on page) ─────────────────────────────────────────
function SlotItem({ event, slot, onRemove, onToggleImage }) {
  const images = normalizeEventImages(event.images);
  const sel = slot.selectedImages || [];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 600, marginBottom: 2 }}>{event.date}</div>
          <div style={{ fontSize: 11, color: '#d3d1e0', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {event.text || '(nincs szöveg)'}
          </div>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 0 0 8px', flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>

      {/* Image picker */}
      {images.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#8c88a5', marginBottom: 4 }}>
            Képek ({sel.length}/{Math.min(images.length, 3)} kiválasztva):
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
{images.map((img, idx) => {
               const selected = sel.includes(idx);
               return (
                 <div
                   key={idx}
                   onClick={() => onToggleImage(idx)}
                   style={{
                     position: 'relative', width: 52, height: 52, borderRadius: 6, overflow: 'hidden',
                     cursor: 'pointer', border: `2px solid ${selected ? '#a855f7' : 'transparent'}`,
                     opacity: selected ? 1 : 0.4, transition: 'all 0.15s',
                   }}
                 >
                   <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                   {selected && (
                     <div style={{
                       position: 'absolute', bottom: 1, right: 1, background: '#7c3aed',
                       borderRadius: 3, width: 14, height: 14,
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       fontSize: 8, color: '#fff', fontWeight: 700,
                     }}>
                       {sel.indexOf(idx) + 1}
                     </div>
                   )}
                 </div>
               );
             })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page Preview Modal ────────────────────────────────────────────────────────
function PagePreviewModal({ page, events, bookData, onClose }) {
  const getSelectedImages = (slot) => {
    const evt = events.find(e => e.id === slot.eventId);
    if (!evt) return [];
    const sel = slot.selectedImages || [];
    return sel.map(i => evt.images[i]).filter(Boolean);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(420px, 90vw)',
        height: 'min(594px, calc(90vw * 1.414))',
        background: '#fff', borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, sans-serif',
      }}>
        {page.slots.map((slot, slotIdx) => {
          const evt = events.find(e => e.id === slot.eventId);
          if (!evt) return null;
          const imgs = getSelectedImages(slot);
          const isDouble = page.slots.length === 2;
          return (
            <div key={slot.eventId} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              borderBottom: slotIdx === 0 && isDouble ? '2px solid #e5e7eb' : 'none',
              overflow: 'hidden', padding: '4% 5%',
            }}>
              {/* Mini header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3%', flexShrink: 0 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {bookData.schoolName}
                </span>
                <span style={{ fontSize: 7, color: '#9ca3af' }}>{evt.date}</span>
              </div>

{/* Image and text container - let text dictate height */}
               <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                 {/* Images - shrink if needed */}
                 {imgs.length > 0 && (
                   <div style={{ flex: '0 0 auto', marginBottom: '3%' }}>
                     <div style={{
                       display: 'grid',
                       gridTemplateColumns: imgs.length === 1 ? '1fr' : imgs.length === 2 ? '1fr 1fr' : '2fr 1fr',
                       gridTemplateRows: imgs.length === 3 ? '1fr 1fr' : '1fr',
                       gap: 3, borderRadius: 4, overflow: 'hidden',
                     }}>
                       {imgs.map((img, i) => (
                         <div key={i} style={{ gridRow: imgs.length === 3 && i === 0 ? 'span 2' : 'auto', overflow: 'hidden' }}>
                           <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Text - takes remaining space, wraps */}
                 <div style={{ flex: '1 1 auto', fontSize: isDouble ? 6 : 8, lineHeight: 1.7, color: '#374151', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '0 4px', boxSizing: 'border-box' }}>
                   {evt.text || ''}
                 </div>
               </div>
            </div>
          );
        })}

        {page.slots.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>
            Üres oldal
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icon button helper ────────────────────────────────────────────────────────
function IconBtn({ children, onClick, disabled, title, color }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'none', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4, padding: '3px 5px', cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#2a2840' : (color || '#8c88a5'),
        display: 'flex', alignItems: 'center', transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}
