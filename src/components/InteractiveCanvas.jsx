import React, { useRef, useEffect } from 'react';
import { RotateCcw, Type, Image as ImageIcon, Trash2, EyeOff, Eye, RefreshCcw } from 'lucide-react';

// ── Default layout boxes for standard elements (% of 500x706 A4 canvas) ────────
export const DEFAULT_LAYOUTS = {
  cover: {
    logo:  { x: 6,  y: 6,  w: 88, h: 10, zIndex: 5, fontSize: 12 },
    photo: { x: 6,  y: 18, w: 88, h: 50, zIndex: 1 },
    title: { x: 6,  y: 72, w: 88, h: 22, zIndex: 1, fontSize: 28 },
  },
  principal: {
    header: { x: 0,  y: 0,  w: 100, h: 18, zIndex: 1, fontSize: 16 },
    logo:   { x: 4,  y: 2.5, w: 12, h: 13, zIndex: 5 },
    photo:  { x: 6,  y: 22, w: 32,  h: 35, zIndex: 1 },
    quote:  { x: 42, y: 22, w: 52,  h: 68, zIndex: 1, fontSize: 11 },
    footer: { x: 0,  y: 94, w: 100, h: 6,  zIndex: 1, fontSize: 8  },
  },
  teachers: {
    header:       { x: 0, y: 0,  w: 100, h: 18, zIndex: 1, fontSize: 16 },
    logo:         { x: 4, y: 2.5, w: 12, h: 13, zIndex: 5 },
    teachersGrid: { x: 6, y: 22, w: 88,  h: 70, zIndex: 1, fontSize: 10 },
    footer:       { x: 0, y: 94, w: 100, h: 6,  zIndex: 1, fontSize: 8  },
  },
  class: {
    header:        { x: 0,  y: 0,  w: 100, h: 14, zIndex: 1, fontSize: 14 },
    logo:          { x: 3,  y: 1.5, w: 10, h: 11, zIndex: 5 },
    teacherBox:    { x: 6,  y: 17, w: 38,  h: 25, zIndex: 1, fontSize: 9  },
    groupPhotoBox: { x: 46, y: 17, w: 48,  h: 25, zIndex: 1 },
    studentsGrid:  { x: 6,  y: 45, w: 88,  h: 47, zIndex: 1, fontSize: 9  },
    footer:        { x: 0,  y: 94, w: 100, h: 6,  zIndex: 1, fontSize: 8  },
  },
  graduation: {
    header: { x: 0, y: 0,  w: 100, h: 16, zIndex: 1, fontSize: 16 },
    logo:   { x: 4, y: 2.5, w: 12, h: 11, zIndex: 5 },
    photo:  { x: 6, y: 19, w: 88,  h: 73, zIndex: 1 },
    footer: { x: 0, y: 94, w: 100, h: 6,  zIndex: 1, fontSize: 8  },
  },
  divider: {
    logo:   { x: 15, y: 15, w: 70, h: 12, zIndex: 5 },
    title:  { x: 10, y: 35, w: 80, h: 30, zIndex: 1, fontSize: 32 },
    footer: { x: 10, y: 75, w: 80, h: 10, zIndex: 1, fontSize: 8  },
  },
  event: {
    header: { x: 6, y: 4,  w: 88, h: 8,  zIndex: 1, fontSize: 9  },
    logo:   { x: 7, y: 4.5, w: 8,  h: 7,  zIndex: 5 },
    images: { x: 6, y: 14, w: 88, h: 44, zIndex: 1 },
    text:   { x: 6, y: 60, w: 88, h: 32, zIndex: 1, fontSize: 11 },
    footer: { x: 6, y: 94, w: 88, h: 4,  zIndex: 1, fontSize: 8  },
  },
};

function normalizeEventImages(images = []) {
  return images.map(img => typeof img === 'string' ? { url: img, enabled: true } : ({ enabled: true, ...img }));
}

function getDefaultEventImageBox(page, elemId, bookData) {
  const event = (bookData?.events || []).find(e => e.id === page.eventId);
  if (!event) return { x: 6, y: 14, w: 30, h: 24, zIndex: 1 };

  const visibleCount = Math.min(
    event.imageCount || 4,
    6,
    normalizeEventImages(event.images || []).filter(img => img.enabled).length,
  );
  const index = Number(elemId.replace('eventImg_', ''));
  if (Number.isNaN(index) || index < 0 || index >= visibleCount) return { x: 6, y: 14, w: 30, h: 24, zIndex: 1 };

  const imagesBox = bookData?.pageLayouts?.[page.id]?.elements?.images || DEFAULT_LAYOUTS.event.images;
  const boxes = [];
  const layout = event.imageLayout || 'auto';

  if (layout === 'rows') {
    const h = 100 / visibleCount;
    for (let i = 0; i < visibleCount; i++) {
      boxes.push({ x: 0, y: i * h, w: 100, h, zIndex: 1 });
    }
  } else if (layout === 'hero') {
    if (visibleCount === 1) {
      boxes.push({ x: 0, y: 0, w: 100, h: 100, zIndex: 1 });
    } else if (visibleCount === 2) {
      boxes.push({ x: 0, y: 0, w: 60, h: 100, zIndex: 1 });
      boxes.push({ x: 62, y: 0, w: 38, h: 100, zIndex: 1 });
    } else {
      boxes.push({ x: 0, y: 0, w: 60, h: 100, zIndex: 1 });
      const cols = 1;
      const rows = Math.ceil((visibleCount - 1) / cols);
      const h = 100 / rows;
      for (let i = 1; i < visibleCount; i++) {
        boxes.push({ x: 62, y: (i - 1) * h, w: 38, h, zIndex: 1 });
      }
    }
  } else {
    const cols = Math.min(3, visibleCount);
    const rows = Math.ceil(visibleCount / cols);
    const w = 100 / cols;
    const h = 100 / rows;
    for (let i = 0; i < visibleCount; i++) {
      boxes.push({ x: (i % cols) * w, y: Math.floor(i / cols) * h, w, h, zIndex: 1 });
    }
  }

  const relative = boxes[index] || { x: 0, y: 0, w: 100, h: 100, zIndex: 1 };
  return {
    x: imagesBox.x + (imagesBox.w * relative.x) / 100,
    y: imagesBox.y + (imagesBox.h * relative.y) / 100,
    w: (imagesBox.w * relative.w) / 100,
    h: (imagesBox.h * relative.h) / 100,
    zIndex: relative.zIndex,
  };
}

export function getElemBox(page, elemId, bookData) {
  if (!page) return { x: 0, y: 0, w: 100, h: 20, zIndex: 1 };
  const pageId = page.id;
  const pageType = page.type;
  const layout = bookData?.pageLayouts?.[pageId]?.elements?.[elemId];
  if (layout) return layout;
  if (pageType === 'event' && elemId.startsWith('eventImg_')) {
    return getDefaultEventImageBox(page, elemId, bookData);
  }
  const def = DEFAULT_LAYOUTS[pageType]?.[elemId];
  return def || { x: 5, y: 5, w: 90, h: 20, zIndex: 1 };
}

export function isElemHidden(page, elemId, bookData) {
  if (!page) return false;
  return bookData?.pageLayouts?.[page.id]?.hidden?.[elemId] === true;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE CANVAS
// Drag/resize only. All content editing is done in the left panel (BlockEditor).
// selectedElemId / setSelectedElemId are lifted up to Editor.
// ══════════════════════════════════════════════════════════════════════════════
export default function InteractiveCanvas({
  page,
  bookData,
  setBookData,
  renderContent,
  selectedElemId,
  setSelectedElemId,
}) {
  const canvasRef = useRef(null);
  const imageInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const pageId   = page?.id;
  const pageType = page?.type;
  const currentPageLayout = bookData.pageLayouts?.[pageId] || {};
  const customElements    = currentPageLayout.customElements || [];

  // ── Layout updaters ─────────────────────────────────────────────────────────
  const [showLabelMenu, setShowLabelMenu] = React.useState(false);
  const [editingElemId, setEditingElemId] = React.useState(null);
  const [editingText, setEditingText] = React.useState('');
  const updateElementLayout = (elemId, newBox) => {
    setBookData(prev => {
      const layouts  = prev.pageLayouts || {};
      const current  = layouts[pageId]  || {};
      const elements = current.elements || {};
      const currentBox = getElemBox(page, elemId, prev);
      return {
        ...prev,
        pageLayouts: {
          ...layouts,
          [pageId]: {
            ...current,
            elements: { ...elements, [elemId]: { ...currentBox, ...newBox } }
          }
        }
      };
    });
  };

  // ── Add custom text element ─────────────────────────────────────────────────
  // Custom elem szöveg és tulajdonság frissítés
  const updateCustomElem = (elemId, updates) => {
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId] || {};
      const elems = (current.customElements || []).map(e => e.id === elemId ? { ...e, ...updates } : e);
      return { ...prev, pageLayouts: { ...layouts, [pageId]: { ...current, customElements: elems } } };
    });
  };

  const startEditing = (elem) => {
    setEditingElemId(elem.id);
    setEditingText(elem.text || '');
  };

  const finishEditing = () => {
    if (editingElemId) {
      updateCustomElem(editingElemId, { text: editingText });
    }
    setEditingElemId(null);
  };

  const addCustomText = () => {
    const newId = `custom_text_${Date.now()}`;
    const newElem = {
      id: newId, type: 'text',
      text: 'Új szöveg...',
      x: 20, y: 40, w: 60, h: 12,
      fontSize: 14, fontFamily: "'Inter', sans-serif", color: '#1f2937', zIndex: 10,
    };
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId]  || {};
      return {
        ...prev,
        pageLayouts: {
          ...layouts,
          [pageId]: { ...current, customElements: [...(current.customElements || []), newElem] }
        }
      };
    });
    setSelectedElemId(newId);
  };

  // Stílusos felirat hozzáadása
  const addStyledLabel = (style) => {
    const newId = `custom_text_${Date.now()}`;
    const presets = {
      'cim':    { text: 'ISKOLA NEVE', fontSize: 28, color: '#f59e0b', fontWeight: 900, textAlign: 'center', letterSpacing: '0.08em', background: 'transparent', w: 80, h: 14 },
      'alcim':  { text: '2025 / 2026 TANÉV', fontSize: 13, color: '#fef3c7', fontWeight: 700, textAlign: 'center', letterSpacing: '0.12em', background: 'rgba(217,119,6,0.3)', padding: '3px 14px', borderRadius: '12px', border: '1px solid #d97706', w: 60, h: 10 },
      'arany':  { text: 'Felirat szövege', fontSize: 18, color: '#d97706', fontWeight: 800, textAlign: 'center', fontStyle: 'italic', background: 'transparent', w: 70, h: 12 },
      'feher':  { text: 'Felirat szövege', fontSize: 16, color: '#ffffff', fontWeight: 700, textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)', background: 'transparent', w: 70, h: 11 },
      'doboz':  { text: 'Felirat szövege', fontSize: 14, color: '#1e1b4b', fontWeight: 700, textAlign: 'center', background: 'rgba(255,255,255,0.88)', padding: '6px 16px', borderRadius: '8px', border: '2px solid #d97706', w: 60, h: 12 },
      'kereszt':{ text: '✝ Felirat szövege', fontSize: 16, color: '#fbbf24', fontWeight: 700, textAlign: 'center', background: 'transparent', w: 70, h: 11 },
    };
    const p = presets[style] || presets['cim'];
    const newElem = { id: newId, type: 'text', x: 10, y: 42, zIndex: 15, ...p };
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId] || {};
      return { ...prev, pageLayouts: { ...layouts, [pageId]: { ...current, customElements: [...(current.customElements || []), newElem] } } };
    });
    setSelectedElemId(newId);
  };

  // ── Add custom image element ────────────────────────────────────────────────
  const addCustomImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);

    // If targeting a standard image slot
    if (uploadTargetRef.current) {
      const target = uploadTargetRef.current;
      uploadTargetRef.current = null;
      if (target === 'schoolLogo') {
        setBookData(prev => ({ ...prev, schoolLogo: url }));
      } else if (target === 'principalPhoto') {
        setBookData(prev => ({ ...prev, principalPhoto: url }));
      } else if (target === 'groupPhoto') {
        const clsId = page.classId;
        setBookData(prev => ({
          ...prev,
          classes: (prev.classes || []).map(c => c.id === clsId ? { ...c, groupPhoto: url } : c)
        }));
      } else if (target === 'classTeacherPhoto') {
        const clsId = page.classId;
        setBookData(prev => ({
          ...prev,
          classes: (prev.classes || []).map(c => c.id === clsId ? { ...c, classTeacherPhoto: url } : c)
        }));
      } else if (target === 'gradImage') {
        const gradId = page.data?.id;
        setBookData(prev => ({
          ...prev,
          graduationPages: (prev.graduationPages || []).map(g => g.id === gradId ? { ...g, image: url } : g)
        }));
      } else if (target === 'coverPhoto') {
        // Borítólap: az első (legújabb) ballagási oldalra menti
        setBookData(prev => {
          const pages = [...(prev.graduationPages || [])].sort((a, b) => b.year - a.year);
          if (pages.length === 0) {
            // Ha nincs ballagási oldal, csinálunk egyet
            const newGrad = { id: 'grad_cover_' + Date.now(), year: prev.currentYear || 2026, image: url, caption: '' };
            return { ...prev, graduationPages: [newGrad] };
          }
          return {
            ...prev,
            graduationPages: (prev.graduationPages || []).map(g =>
              g.id === pages[0].id ? { ...g, image: url } : g
            )
          };
        });
      }
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    // New custom image element
    const newId   = `custom_img_${Date.now()}`;
    const newElem = { id: newId, type: 'image', src: url, x: 25, y: 30, w: 50, h: 35, zIndex: 10 };
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId]  || {};
      return {
        ...prev,
        pageLayouts: {
          ...layouts,
          [pageId]: { ...current, customElements: [...(current.customElements || []), newElem] }
        }
      };
    });
    setSelectedElemId(newId);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // ── Reset page layout ───────────────────────────────────────────────────────
  const resetPageLayout = () => {
    if (!confirm('Biztosan visszaállítod az oldal eredeti elrendezését?')) return;
    setBookData(prev => {
      const layouts = { ...(prev.pageLayouts || {}) };
      delete layouts[pageId];
      return { ...prev, pageLayouts: layouts };
    });
    setSelectedElemId(null);
  };

  // ── Reset single element to default ─────────────────────────────────────────
  const resetSingleElement = (elemId) => {
    setBookData(prev => {
      const layouts  = prev.pageLayouts || {};
      const current  = layouts[pageId]  || {};
      const elements = { ...(current.elements || {}) };
      delete elements[elemId];
      const hidden   = { ...(current.hidden || {}) };
      delete hidden[elemId];
      return {
        ...prev,
        pageLayouts: { ...layouts, [pageId]: { ...current, elements, hidden } }
      };
    });
  };

  // ── Toggle element visibility ────────────────────────────────────────────────
  const toggleHideElement = (elemId) => {
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId]  || {};
      const hidden  = { ...(current.hidden || {}) };
      hidden[elemId] = !hidden[elemId];
      return { ...prev, pageLayouts: { ...layouts, [pageId]: { ...current, hidden } } };
    });
  };

  // ── Delete custom element ────────────────────────────────────────────────────
  const deleteCustomElement = (elemId) => {
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId]  || {};
      return {
        ...prev,
        pageLayouts: {
          ...layouts,
          [pageId]: {
            ...current,
            customElements: (current.customElements || []).filter(c => c.id !== elemId)
          }
        }
      };
    });
    setSelectedElemId(null);
  };

  // ── Keyboard: Delete key removes custom element ──────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          selectedElemId?.startsWith('custom_') &&
          e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        deleteCustomElement(selectedElemId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedElemId]);

  if (!page) return null;

  // ── Mouse drag & resize ─────────────────────────────────────────────────────
  const handleMouseDown = (e, elemId, handle = null) => {
    e.stopPropagation();
    setSelectedElemId(elemId);

    if (!canvasRef.current) return;
    const rect       = canvasRef.current.getBoundingClientRect();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const isCustom   = elemId.startsWith('custom_');
    const customElem = isCustom ? customElements.find(c => c.id === elemId) : null;
    const startBox   = isCustom
      ? { x: customElem.x, y: customElem.y, w: customElem.w, h: customElem.h }
      : getElemBox(page, elemId, bookData);

    const onMouseMove = (mv) => {
      const dx = ((mv.clientX - startMouseX) / rect.width)  * 100;
      const dy = ((mv.clientY - startMouseY) / rect.height) * 100;
      let next = { ...startBox };

      if (!handle) {
        next.x = Math.max(0, Math.min(100 - startBox.w, startBox.x + dx));
        next.y = Math.max(0, Math.min(100 - startBox.h, startBox.y + dy));
      } else {
        if (handle.includes('e')) next.w = Math.max(5, Math.min(100 - startBox.x, startBox.w + dx));
        if (handle.includes('s')) next.h = Math.max(3, Math.min(100 - startBox.y, startBox.h + dy));
        if (handle.includes('w')) {
          const nw = Math.max(5, startBox.w - dx);
          next.x = Math.max(0, startBox.x + (startBox.w - nw));
          next.w = nw;
        }
        if (handle.includes('n')) {
          const nh = Math.max(3, startBox.h - dy);
          next.y = Math.max(0, startBox.y + (startBox.h - nh));
          next.h = nh;
        }
      }

      if (isCustom) {
        setBookData(prev => {
          const layouts = prev.pageLayouts || {};
          const current = layouts[pageId]  || {};
          return {
            ...prev,
            pageLayouts: {
              ...layouts,
              [pageId]: {
                ...current,
                customElements: (current.customElements || []).map(c => c.id === elemId ? { ...c, ...next } : c)
              }
            }
          };
        });
      } else {
        updateElementLayout(elemId, next);

        // ── Event oldal: ha a 'text' elemet méretezni, az 'images' elem is alkalmazkodjon ───────
        if (pageType === 'event' && elemId === 'text' && handle) {
          const headerBox = getElemBox(page, 'header', bookData);
          const logoBox   = getElemBox(page, 'logo', bookData);
          const imagesBox = getElemBox(page, 'images', bookData);
          const footerBox = getElemBox(page, 'footer', bookData);

          // imagesBox bottom = textBox top - small gap
          const newImagesH = Math.max(10, next.y - imagesBox.y - 2);
          if (newImagesH > 10) {
            updateElementLayout('images', { h: newImagesH });
          }
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  };

  const stdElementIds = [
    ...Object.keys(DEFAULT_LAYOUTS[pageType] || {}),
    ...(pageType === 'event' ? Array.from({ length: 6 }, (_, idx) => `eventImg_${idx}`) : []),
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
      onClick={() => setSelectedElemId(null)}
    >
      {/* ── Slim canvas toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
        padding: '6px 12px', borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', zIndex: 20,
      }} onClick={e => e.stopPropagation()}>
        <button onClick={addCustomText} style={toolBtn} title="Új szövegdoboz hozzáadása">
          <Type size={13}/> + Szöveg
        </button>

        {/* Stílusos feliratok */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            style={{ ...toolBtn, color: '#f59e0b', fontWeight: 700 }}
            title="Stílusos felirat hozzáadása"
            onClick={e => { e.stopPropagation(); setShowLabelMenu(v => !v); }}
          >
            ✦ Felirat
          </button>
          {showLabelMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setShowLabelMenu(false)} />
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, background: '#1a1830', border: '1px solid #3a3157', borderRadius: 10, padding: 6, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { key: 'cim',     icon: '🏷', label: 'Főcím (arany, nagy)' },
                  { key: 'alcim',   icon: '📛', label: 'Alcím (doboz, keret)' },
                  { key: 'arany',   icon: '✨', label: 'Arany dőlt felirat' },
                  { key: 'feher',   icon: '⬜', label: 'Fehér árnyékos' },
                  { key: 'doboz',   icon: '🔲', label: 'Fehér doboz kerettel' },
                  { key: 'kereszt', icon: '✝', label: 'Keresztes felirat' },
                ].map(({ key, icon, label }) => (
                  <button key={key} onClick={() => { addStyledLabel(key); setShowLabelMenu(false); }}
                    style={{ background: 'none', border: 'none', color: '#e2e8f0', fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span>{icon}</span> {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <input
          type="file" accept="image/*" ref={imageInputRef}
          style={{ display: 'none' }} onChange={addCustomImage}
        />
        <button onClick={() => { uploadTargetRef.current = null; imageInputRef.current?.click(); }}
          style={toolBtn} title="Új kép feltöltése">
          <ImageIcon size={13}/> + Kép
        </button>

        <div style={{ width: 1, height: 16, background: '#e5e7eb', margin: '0 2px' }}/>

        <button onClick={resetPageLayout} style={toolBtn} title="Eredeti elrendezés visszaállítása">
          <RotateCcw size={13}/> Alaphelyzet
        </button>
      </div>

      {/* ── A4 canvas ── */}
      <div ref={canvasRef} style={{
        width: 500, height: 706, position: 'relative',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        borderRadius: 4, overflow: 'hidden', background: '#fff',
        flexShrink: 0, userSelect: 'none',
      }}>
        {renderContent()}

        {/* Standard element drag overlays */}
        {stdElementIds.map(elemId => {
          const box        = getElemBox(page, elemId, bookData);
          const isSelected = selectedElemId === elemId;
          const isHidden   = isElemHidden(page, elemId, bookData);
          return (
            <div
              key={elemId}
              onMouseDown={e => handleMouseDown(e, elemId)}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${box.x}%`, top: `${box.y}%`,
                width: `${box.w}%`, height: `${box.h}%`,
                zIndex: (box.zIndex || 1) + 10,
                cursor: 'grab',
                outline:    isSelected ? '2px dashed #7c3aed' : isHidden ? '1px dashed rgba(239,68,68,0.4)' : '1px dashed transparent',
                background: isSelected ? 'rgba(124,58,237,0.04)' : isHidden ? 'rgba(239,68,68,0.06)' : 'transparent',
                boxSizing: 'border-box', transition: 'outline 0.1s',
              }}
            >
              {/* Floating mini toolbar above selected standard element */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute', bottom: '100%', left: 0,
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: '#1e1b4b', borderRadius: '6px 6px 0 0',
                    padding: '3px 5px', zIndex: 100, whiteSpace: 'nowrap',
                    boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
                  }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <span style={{ fontSize: 9, color: '#a5b4fc', fontWeight: 700, marginRight: 2 }}>{elemId}</span>
                  <button
                    onClick={e => { e.stopPropagation(); toggleHideElement(elemId); }}
                    title={isHidden ? 'Megjelenítés' : 'Elrejtés'}
                    style={floatBtn(isHidden ? '#fbbf24' : '#94a3b8')}
                  >
                    {isHidden ? <Eye size={11}/> : <EyeOff size={11}/>}
                    {isHidden ? 'Mutat' : 'Elrejt'}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); resetSingleElement(elemId); }}
                    title="Alaphelyzet visszaállítása"
                    style={floatBtn('#60a5fa')}
                  >
                    <RefreshCcw size={11}/> Reset
                  </button>
                  {/* Kép feltöltés gomb — photo és logo slotokhoz */}
                  {(elemId === 'photo' || elemId === 'logo') && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (elemId === 'logo') {
                          uploadTargetRef.current = 'schoolLogo';
                        } else if (page?.type === 'graduation') {
                          uploadTargetRef.current = 'gradImage';
                        } else if (page?.type === 'principal') {
                          uploadTargetRef.current = 'principalPhoto';
                        } else if (page?.type === 'cover') {
                          uploadTargetRef.current = 'coverPhoto';
                        } else {
                          uploadTargetRef.current = 'gradImage';
                        }
                        imageInputRef.current?.click();
                      }}
                      title="Kép feltöltése"
                      style={floatBtn('#f59e0b')}
                    >
                      🖼 Kép
                    </button>
                  )}
                </div>
              )}
              {isSelected && (<>
                <ResizeHandle handle="nw" onMouseDown={e => handleMouseDown(e, elemId, 'nw')}/>
                <ResizeHandle handle="ne" onMouseDown={e => handleMouseDown(e, elemId, 'ne')}/>
                <ResizeHandle handle="sw" onMouseDown={e => handleMouseDown(e, elemId, 'sw')}/>
                <ResizeHandle handle="se" onMouseDown={e => handleMouseDown(e, elemId, 'se')}/>
              </>)}
            </div>
          );
        })}

        {/* Custom elements (text/image added by user) */}
        {customElements.map(elem => {
          const isSelected = selectedElemId === elem.id;
          return (
            <div
              key={elem.id}
              onMouseDown={e => handleMouseDown(e, elem.id)}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${elem.x}%`, top: `${elem.y}%`,
                width: `${elem.w}%`, height: `${elem.h}%`,
                zIndex: (elem.zIndex || 10) + 20,
                cursor: 'grab',
                outline:    isSelected ? '2px dashed #7c3aed' : '1px dashed rgba(124,58,237,0.3)',
                background: elem.type === 'text' ? (elem.bg || 'rgba(255,255,255,0.92)') : 'transparent',
                borderRadius: 4, boxSizing: 'border-box', overflow: 'hidden',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
                padding: elem.type === 'text' ? 4 : 0,
              }}
            >
              {elem.type === 'image' && (
                <img
                  src={elem.src} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                />
              )}
              {elem.type === 'text' && editingElemId === elem.id ? (
                // Inline szerkesztés
                <textarea
                  autoFocus
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  onBlur={finishEditing}
                  onKeyDown={e => { if (e.key === 'Escape') finishEditing(); e.stopPropagation(); }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', height: '100%', background: 'rgba(255,255,255,0.15)',
                    border: '2px solid #f59e0b', borderRadius: 4, color: elem.color || '#1f2937',
                    fontSize: elem.fontSize || 14, fontWeight: elem.fontWeight || 400,
                    fontFamily: elem.fontFamily || "'Inter', sans-serif",
                    textAlign: elem.textAlign || 'left', padding: 4, resize: 'none',
                    outline: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                  }}
                />
              ) : elem.type === 'text' ? (
                <div
                  onDoubleClick={e => { e.stopPropagation(); startEditing(elem); }}
                  title="Dupla kattintás a szerkesztéshez"
                  style={{
                    fontSize:      elem.fontSize      || 14,
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
                    lineHeight: 1.5, display: 'flex', alignItems: 'center',
                    justifyContent: elem.textAlign === 'center' ? 'center' : elem.textAlign === 'right' ? 'flex-end' : 'flex-start',
                    boxSizing: 'border-box', cursor: 'text',
                  }}
                >{elem.text}
                </div>
              ) : null}
              {/* Floating mini toolbar for custom elements */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute', bottom: '100%', left: 0,
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: '#1e1b4b', borderRadius: '6px 6px 0 0',
                    padding: '3px 5px', zIndex: 100, whiteSpace: 'nowrap',
                    boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
                  }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <span style={{ fontSize: 9, color: '#a5b4fc', fontWeight: 700, marginRight: 2 }}>
                    {elem.type === 'text' ? '✍️ Szöveg' : '🖼 Kép'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCustomElement(elem.id); }}
                    title="Elem törlése (Delete)"
                    style={floatBtn('#f87171')}
                  >
                    <Trash2 size={11}/> Törlés
                  </button>
                </div>
              )}
              {isSelected && (<>
                <ResizeHandle handle="nw" onMouseDown={e => handleMouseDown(e, elem.id, 'nw')}/>
                <ResizeHandle handle="ne" onMouseDown={e => handleMouseDown(e, elem.id, 'ne')}/>
                <ResizeHandle handle="sw" onMouseDown={e => handleMouseDown(e, elem.id, 'sw')}/>
                <ResizeHandle handle="se" onMouseDown={e => handleMouseDown(e, elem.id, 'se')}/>
              </>)}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
        💡 Kattints egy elemre — a bal panelen szerkesztheted a tartalmát.
      </div>
    </div>
  );
}

// ── Resize corner handle ──────────────────────────────────────────────────────
function ResizeHandle({ handle, onMouseDown }) {
  const s = {
    position: 'absolute', width: 9, height: 9,
    background: '#fff', border: '2px solid #7c3aed',
    borderRadius: 2, zIndex: 40,
  };
  if (handle === 'nw') { s.top = -5; s.left  = -5; s.cursor = 'nwse-resize'; }
  if (handle === 'ne') { s.top = -5; s.right  = -5; s.cursor = 'nesw-resize'; }
  if (handle === 'sw') { s.bottom = -5; s.left  = -5; s.cursor = 'nesw-resize'; }
  if (handle === 'se') { s.bottom = -5; s.right  = -5; s.cursor = 'nwse-resize'; }
  return <div style={s} onMouseDown={onMouseDown}/>;
}

const toolBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
  background: '#f9f8ff', border: '1px solid #e5e7eb', color: '#374151',
  cursor: 'pointer', transition: 'all 0.15s',
};

const floatBtn = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
  background: 'transparent', border: `1px solid ${color}40`, color,
  cursor: 'pointer',
});
