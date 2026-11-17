/**
 * Editor.jsx — PowerPoint-szerű évkönyv szerkesztő
 * Görögkatolikus Általános Iskola stílussal & Interaktív Import Kezelővel
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, Plus, X, Printer, Eye, Home, Trash2, RotateCcw, Layers, Check, Search, FileCode, Sliders, Download, FolderOpen, MoreHorizontal, Save, BookOpen } from 'lucide-react';
import InteractiveCanvas, { getElemBox, isElemHidden } from './InteractiveCanvas';
import { repairBookData, cleanEventText, splitEventTitle, STORAGE_KEY, getVisibleEventImages, renderMarkdown } from '../utils/media';
import { fileToCompressedDataUrl, fileToLogoDataUrl } from '../utils/imageCompressor';

// ── Byzantine Cross Icon (Görögkatolikus Kereszt) ───────────────────────────
function ByzantineCross({ size = 24, color = '#f59e0b' }) {
  return <span style={{ fontSize: size, color }}>✝</span>;
}

// ── Helper: Iskolai Logó & Címer intelligens renderelése (beolvadás elleni védelemmel) ──
export function renderSchoolLogo(bookData, extraStyle = {}, sizeFallback = 24) {
  if (!bookData?.schoolLogo) {
    return <ByzantineCross size={sizeFallback} color="#f59e0b" />;
  }

  const styleMode = bookData.logoStyle || 'badge';
  let effectStyle = {};

  if (styleMode === 'badge') {
    effectStyle = {
      background: '#ffffff',
      border: '2px solid #d97706',
      boxShadow: '0 3px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(245,158,11,0.3)',
    };
  } else if (styleMode === 'glow') {
    effectStyle = {
      filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.95)) drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
    };
  } else if (styleMode === 'shadow') {
    effectStyle = {
      filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.5))',
    };
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        ...effectStyle,
        ...extraStyle,
      }}
    >
      <img
        src={bookData.schoolLogo}
        alt="Iskola Címer"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scale(1.05)', // Kiszűri az esetleges fekete doboz-szegélyt külső maszkolással
          display: 'block',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}

// ── Helper: automatikusan tömörített képolvasás ──────────────────────────────
const fileToDataUrl = fileToCompressedDataUrl;

function normalizeEventImages(images = []) {
  return images.map(img => typeof img === 'string' ? { url: img, enabled: true } : ({ enabled: true, ...img }));
}

// ── Build pages (same order as PrintBook) ────────────────────────────────────
function getSchoolYears(events) {
  // Legfrissebb tanév elöl (pl. 2025/2026 -> 2024/2025)
  return [...new Set((events || []).map(e => e.schoolYear).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}
const monthOrder = [6, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 7];
function sortEventsDesc(events) {
  return [...(events || [])].sort((a, b) => {
    const ma = new Date(a.dateSort || '').getMonth() + 1, mb = new Date(b.dateSort || '').getMonth() + 1;
    const oa = monthOrder.indexOf(ma), ob = monthOrder.indexOf(mb);
    if (oa !== ob) return oa - ob;
    return (b.dateSort || '').localeCompare(a.dateSort || '');
  });
}

export function isShortEvent(evt) {
  if (!evt) return false;
  const len = (evt.text || '').length;
  const imgs = (evt.images || []).length;
  return len <= 280 && imgs <= 2;
}

export function getMergedGroups(bookData) {
  return bookData?.mergedGroups || bookData?.dualPairs || [];
}

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

  // Graduation tableau pages (ordered backwards from latest year)
  [...(bookData.graduationPages || [])].sort((a, b) => b.year - a.year).forEach(g =>
    pages.push({ id: `grad_${g.id}`, type: 'graduation', data: g })
  );

  const groups = getMergedGroups(bookData);

  getSchoolYears(bookData.events).forEach(sy => {
    pages.push({ id: `div_${sy}`, type: 'divider', schoolYear: sy });
    const syEvents = sortEventsDesc((bookData.events || []).filter(e => e.schoolYear === sy));

    const usedIds = new Set();
    syEvents.forEach(evt => {
      if (usedIds.has(evt.id)) return;

      // Ellenőrizzük, hogy benne van-e egy összevont csoportban (2 vagy 3 cikk / lap)
      const group = groups.find(g => Array.isArray(g) && g.includes(evt.id));
      if (group) {
        const groupEvents = syEvents.filter(e => group.includes(e.id));
        if (groupEvents.length >= 2) {
          pages.push({
            id: `merged_${groupEvents.map(e => e.id).join('_')}`,
            type: 'dual_event',
            eventIds: groupEvents.map(e => e.id),
            events: groupEvents,
            event1: groupEvents[0],
            event2: groupEvents[1],
            event3: groupEvents[2] || null,
            schoolYear: sy,
          });
          groupEvents.forEach(e => usedIds.add(e.id));
          return;
        }
      }

      pages.push({ id: evt.id, type: 'event', eventId: evt.id });
      usedIds.add(evt.id);
    });
  });
  return pages;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Editor({ bookData, setBookData, setViewMode, onBackToMenu, onResetDefault, onResetEmpty, isAdmin, onAdminLogout, onPublish }) {
  const pages = buildPages(bookData);
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id || 'cover');
  const [editingText, setEditingText] = useState(false);
  const [localText, setLocalText] = useState('');
  const [selectedElemId, setSelectedElemId] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [localTextFontSize, setLocalTextFontSize] = useState(11);
  const [localTextLineHeight, setLocalTextLineHeight] = useState(1.7);
  
  // ── Project-level Undo / Redo Stacks ────────────────────────────────────────
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [, setHistoryTick] = useState(0);
  const bookDataRef = useRef(bookData);

  useEffect(() => {
    bookDataRef.current = bookData;
  }, [bookData]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  const triggerHistoryUpdate = () => {
    setHistoryTick(t => t + 1);
  };

  const recordSnapshot = useCallback((customSnapshot) => {
    const snap = customSnapshot || bookDataRef.current;
    if (!snap) return;

    const stack = undoStackRef.current;
    const last = stack[stack.length - 1];

    if (last && JSON.stringify(last) === JSON.stringify(snap)) {
      return;
    }

    stack.push(JSON.parse(JSON.stringify(snap)));
    if (stack.length > 50) stack.shift();

    redoStackRef.current = [];
    triggerHistoryUpdate();
  }, []);

  const originalBookDataRef = useRef(bookData);
  const fbFolderInputRef = useRef(null);
  const projectInputRef = useRef(null);

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(bookData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(bookData.schoolName || 'evkonyv').replace(/[^a-z0-9áéíóöőúüű]+/gi, '-').toLowerCase()}-${bookData.currentYear || ''}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Események exportálása külön JSON fájlként (book_events_YYYY-MM-DD.json),
  // amit az admin feltölthet a Drive-ra vagy a public mappába.
  const exportBookEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    const blob = new Blob([JSON.stringify(bookData.events || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `book_events_${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) throw new Error('Hiányzik az eseménylista.');
      const repaired = repairBookData(parsed);

      // Választás: folytatás vagy felülírás
      const mode = window.confirm(
        `A betöltendő projekt ${repaired.events.length} eseményt tartalmaz.\n\n` +
        `NYOMJ AZ OK GOMBOT a FOLYTATÁSHOZ (meglévő eseményeket hozzáadja, nincs felülírás).\n` +
        `NYOMJ A MEGSE GOMBOT a FELÜLÍRÁSHOZ (mindent helyettesít).`
      ) ? 'append' : 'replace';

      setBookData(prev => {
        if (mode === 'append') {
          // Folytatás: meglévő eseményeket megőrzi, újakat hozzáad (duplikátum kihagyva)
          const existingIds = new Set((prev.events || []).map(e => e.id));
          const freshEvents = (repaired.events || []).filter(e => !existingIds.has(e.id));
          return {
            ...prev,
            ...repaired,
            events: [...(prev.events || []), ...freshEvents],
          };
        }
        // Felülírás: minden adat helyettesítése
        return { ...prev, ...repaired };
      });

      const msg = mode === 'append'
        ? `Folytatás: ${repaired.events.length} esemény közül az újak hozzáadva.`
        : 'A projekt felülírva.';
      alert(msg);
    } catch (error) {
      alert(`A projekt nem tölthető be: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const normalizePath = (str) => String(str || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const filePath = (file) => normalizePath(file.webkitRelativePath || file.name);

  const getSchoolYearFromDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return bookData.currentYear ? `${bookData.currentYear - 1}/${bookData.currentYear}` : '';
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  };

  const readFileAsDataUrl = fileToCompressedDataUrl;

  const [fbImportBusy, setFbImportBusy] = useState(false);

  // ── Mentés: automatikus (localStorage) + látható visszajelzés + Ctrl+S ──────
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Minden adatváltozás (szöveg, kép, logó, oldalak…) automatikusan mentődik
  useEffect(() => {
    setLastSavedAt(new Date());
  }, [bookData]);

  // Amikor esemény oldal kerül kiválasztásra, automatikusan betöltjük a szöveget
  useEffect(() => {
    if (selectedEvent) {
      setLocalText(selectedEvent.text || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  const handleManualSave = () => {
    try {
      // Csak manuális mentéskor kerül localStorage-ba
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookData));
      // Admin backup mentés is
      const ADMIN_STORAGE_KEY = 'szmc_admin_bookdata';
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(bookData));
      setLastSavedAt(new Date());
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2000);
    } catch {
      alert('A mentés nem sikerült — a böngésző tárhelye megtelt.\nTöltsd le a projektet fájlba: Továbbiak → Projekt mentése.');
    }
  };

  // Ctrl+S / Cmd+S = mentés
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleFacebookFolderImport = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    setFbImportBusy(true);
    try {
      await runFacebookImport(files);
    } catch (err) {
      console.error(err);
      alert('Hiba történt az importálás során: ' + err.message);
    } finally {
      setFbImportBusy(false);
    }
  };

  const runFacebookImport = async (files) => {
    const parsedPosts = [];
    const jsonFiles = files.filter(file => {
      const path = filePath(file);
      // Régi ÉS új Facebook export formátum támogatása
      const isPostJson = path.includes("this_profile's_activity_across_facebook/posts") || path.includes('your_facebook_activity/posts');
      return path.endsWith('.json') && isPostJson && !path.includes('uncategorized') && !path.includes('editor');
    });

    if (jsonFiles.length === 0) {
      alert('Nem találtam Facebook poszt JSON fájlokat a kiválasztott mappában.\n\nVálaszd ki a kicsomagolt export gyökérmappáját (pl. facebook-szentmihalyiskola-...) vagy a face mappát.');
      return;
    }

    for (const file of jsonFiles) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) parsedPosts.push(...data);
      } catch (err) {
        console.warn('JSON parse hiba:', filePath(file), err.message);
      }
    }

    const normalizeUri = (uri) => normalizePath(uri);
    // Előre felépített név-jegyzék a gyors képkerséshez (több ezer fájl esetén is villámgyors)
    const imageByBase = new Map();
    for (const f of files) {
      const p = normalizePath(filePath(f));
      if (!/\.(jpe?g|png|gif|webp|bmp|tiff?|heic)$/i.test(p)) continue;
      const base = p.split('/').pop().toLowerCase();
      if (!imageByBase.has(base)) imageByBase.set(base, []);
      imageByBase.get(base).push({ p, f });
    }
    const findImageFile = (uri) => {
      const u = normalizeUri(uri).toLowerCase();
      const candidates = imageByBase.get(u.split('/').pop());
      if (!candidates) return null;
      return (candidates.find(c => c.p.endsWith(u)) || candidates[0]).f;
    };

    const importedEvents = [];
    let totalImages = 0;

    for (const post of parsedPosts) {
      const ts = post.timestamp || post.creation_timestamp;
      const dateSort = ts ? new Date(ts * 1000).toISOString().split('T')[0] : '';
      const date = ts ? new Date(ts * 1000).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const schoolYear = getSchoolYearFromDate(dateSort);

      const textParts = [];
      if (post.title) textParts.push(post.title);
      if (post.data) {
        const items = Array.isArray(post.data) ? post.data : Object.values(post.data);
        for (const item of items) {
          if (item.post) textParts.push(item.post);
          if (item.text) textParts.push(item.text);
        }
      }
      const textValue = textParts.join('\n\n').trim();

      const imageUris = [];
      if (post.attachments) {
        const attachments = Array.isArray(post.attachments) ? post.attachments : [post.attachments];
        for (const att of attachments) {
          const attData = Array.isArray(att.data) ? att.data : Object.values(att.data || {});
          for (const item of attData) {
            if (item.media && item.media.uri) {
              imageUris.push(item.media.uri);
            }
          }
        }
      }

      const imageFiles = [];
      // Több fotó közül lehessen válogatni az évkönyv-oldalhoz.
      // A korlát megakadályozza, hogy egyetlen Facebook-poszt túl nagyra növelje a helyi mentést.
      for (const uri of imageUris.slice(0, 20)) {
        const imageFile = findImageFile(uri);
        if (imageFile) imageFiles.push(imageFile);
      }

      const localImages = [];
      for (const file of imageFiles) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          localImages.push(dataUrl);
          totalImages += 1;
        } catch (err) {
          console.warn('Kép betöltési hiba:', filePath(file), err.message);
        }
      }

      if (!textValue && localImages.length === 0) continue;
      importedEvents.push({
        id: `fb_${ts || Date.now()}_${importedEvents.length}`,
        schoolYear,
        date,
        dateSort,
        text: repairBookData(textValue),
        images: localImages,
      });
    }

    if (importedEvents.length === 0) {
      alert('Nem sikerült Facebook eseményeket importálni. Ellenőrizd a kiválasztott mappát.');
      return;
    }

    // Duplikátumok szűrése: amit korábban már behoztunk, azt kihagyjuk
    const existingIds = new Set((bookData.events || []).map(e => e.id));
    const freshEvents = importedEvents.filter(e => !existingIds.has(e.id));
    if (freshEvents.length === 0) {
      alert('Ezeket a posztokat már korábban importáltad — semmi új nem került hozzáadásra.');
      return;
    }

    setBookData(prev => ({ ...prev, events: [...(prev.events || []), ...freshEvents] }));
    setSelectedPageId(freshEvents[0].id);
    alert(`Import sikeres: ${freshEvents.length} új esemény${importedEvents.length > freshEvents.length ? ` (${importedEvents.length - freshEvents.length} duplikátum kihagyva)` : ''} és ${totalImages} kép.`);
  };

  const selectedPage = pages.find(p => p.id === selectedPageId);
  const selectedEvent = selectedPage?.type === 'event'
    ? (bookData.events || []).find(e => e.id === selectedPage.eventId)
    : null;

  // ── Add new Graduation Tableau Page ───────────────────────────────────────
  const addGradPage = () => {
    const newId = 'grad_' + Date.now();
    const currentYears = (bookData.graduationPages || []).map(g => g.year);
    const minYear = currentYears.length > 0 ? Math.min(...currentYears) - 1 : bookData.currentYear;
    setBookData(prev => ({
      ...prev,
      graduationPages: [...(prev.graduationPages || []), { id: newId, year: minYear, image: '', caption: `${minYear - 1}/${minYear} ballagó 8. osztályosok` }]
    }));
    setTimeout(() => setSelectedPageId(`grad_${newId}`), 50);
  };

  // ── Add new Event Page ─────────────────────────────────────────────────────
  const addEventPage = () => {
    const newId = 'evt_' + Date.now();
    const years = getSchoolYears(bookData.events);
    const sy = years[0] || `${bookData.currentYear - 1}/${bookData.currentYear}`;
    const newEvent = {
      id: newId, schoolYear: sy, date: 'Új Esemény', dateSort: new Date().toISOString().split('T')[0], month: 1, text: '', images: []
    };
    setBookData(prev => ({ ...prev, events: [...(prev.events || []), newEvent] }));
    setTimeout(() => setSelectedPageId(newId), 50);
  };

  // ── Delete slide from the deck (event / graduation) ────────────────────────
  const handleDeleteSlide = (page) => {
    if (!page) return;
    if (page.type === 'event') {
      const ev = (bookData.events || []).find(e => e.id === page.eventId);
      if (!ev) return;
      if (!window.confirm(`Biztosan törlöd ezt a diát?${ev.date ? ` (${ev.date})` : ''}`)) return;
      setBookData(prev => ({ ...prev, events: (prev.events || []).filter(e => e.id !== page.eventId) }));
      if (selectedPageId === page.id) setSelectedPageId('cover');
    } else if (page.type === 'graduation') {
      const grad = page.data;
      if (!grad) return;
      if (!window.confirm(`Biztosan törlöd a(z) ${grad.year} évi tabló oldalt?`)) return;
      setBookData(prev => ({ ...prev, graduationPages: (prev.graduationPages || []).filter(g => g.id !== grad.id) }));
      if (selectedPageId === page.id) setSelectedPageId('cover');
    } else if (page.type === 'teachers') {
      if (!window.confirm('Biztosan törlöd a Nevelőtestület oldalt?')) return;
      setBookData(prev => ({ ...prev, teachers: [] }));
      if (selectedPageId === page.id) setSelectedPageId('cover');
    } else if (page.type === 'class') {
      const cls = (bookData.classes || []).find(c => c.id === page.classId);
      if (!cls) return;
      if (!window.confirm(`Biztosan törlöd a(z) ${cls.className || 'osztály'} oldalt?`)) return;
      setBookData(prev => ({ ...prev, classes: (prev.classes || []).filter(c => c.id !== page.classId) }));
      if (selectedPageId === page.id) setSelectedPageId('cover');
    }
  };

  const handleRestoreOriginal = () => {
    if (!window.confirm('Biztosan visszaállítod a szerveren lévő legutóbbi közzétett verziót? Minden mentetlen módosítás elveszik.')) return;
    // localStorage törlése hogy a szerver adatát töltse be
    try {
      localStorage.removeItem('szmc_admin_bookdata');
      localStorage.removeItem('iskoEvkonyv_bookData');
    } catch {}
    window.location.reload();
  };

  // ── Update event text ──────────────────────────────────────────────────────
  const saveEventText = () => {
    if (!selectedEvent) return;
    setBookData(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === selectedEvent.id
        ? { ...e, text: localText, fontSize: localTextFontSize, lineHeight: localTextLineHeight }
        : e)
    }));
    setEditingText(false);
  };

  // ── Toggle event image ─────────────────────────────────────────────────────
  const toggleEventImage = (img) => {
    if (!selectedEvent) return;
    const current = selectedEvent.images || [];
    const newImages = current.includes(img)
      ? current.filter(i => i !== img)
      : [...current, img].slice(0, 3);
    setBookData(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === selectedEvent.id ? { ...e, images: newImages } : e)
    }));
  };

  // ── Project-level Undo / Redo Handlers ─────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop();

    redoStackRef.current.push(JSON.parse(JSON.stringify(bookDataRef.current)));
    if (redoStackRef.current.length > 50) redoStackRef.current.shift();

    setBookData(previous);
    bookDataRef.current = previous;

    if (selectedEvent) {
      const ev = (previous.events || []).find(e => e.id === selectedEvent.id);
      if (ev) {
        setLocalText(ev.text || '');
        setLocalTextFontSize(ev.fontSize || 11);
        setLocalTextLineHeight(ev.lineHeight || 1.7);
      }
    }

    triggerHistoryUpdate();
  }, [setBookData, selectedEvent]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();

    undoStackRef.current.push(JSON.parse(JSON.stringify(bookDataRef.current)));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();

    setBookData(next);
    bookDataRef.current = next;

    if (selectedEvent) {
      const ev = (next.events || []).find(e => e.id === selectedEvent.id);
      if (ev) {
        setLocalText(ev.text || '');
        setLocalTextFontSize(ev.fontSize || 11);
        setLocalTextLineHeight(ev.lineHeight || 1.7);
      }
    }

    triggerHistoryUpdate();
  }, [setBookData, selectedEvent]);

  // Wrapper: automatikusan pillanatképet készít minden módosítás előtt
  const setBookDataWithHistory = useCallback((updater, options = {}) => {
    if (!options.skipHistory) {
      recordSnapshot(bookDataRef.current);
    }
    setBookData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      bookDataRef.current = next;
      return next;
    });
  }, [recordSnapshot, setBookData]);

  // Globális billentyűparancsok (Ctrl+Z: Visszavonás, Ctrl+Y / Ctrl+Shift+Z: Újra)
  useEffect(() => {
    const onGlobalKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // ── Text Editor Handlers (intelligens csoportosított gépelés) ───────────────
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleTextChange = (text) => {
    if (!isTypingRef.current) {
      recordSnapshot(bookDataRef.current);
      isTypingRef.current = true;
    }
    setLocalText(text);
    setBookData(prev => {
      const next = {
        ...prev,
        events: (prev.events || []).map(e => e.id === selectedEvent?.id ? { ...e, text } : e)
      };
      bookDataRef.current = next;
      return next;
    });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 700);
  };

  const handleTextKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
  };

  const applyFormat = (format) => {
    const textarea = document.querySelector('textarea[placeholder="Esemény leírása..."]');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = localText.substring(start, end);
    let formatted = '';
    if (format === 'bold') formatted = `**${selected}**`;
    else if (format === 'italic') formatted = `*${selected}*`;
    else if (format === 'underline') formatted = `__${selected}__`;
    const newText = localText.substring(0, start) + formatted + localText.substring(end);
    recordSnapshot(bookDataRef.current);
    setLocalText(newText);
    setBookDataWithHistory(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === selectedEvent?.id ? { ...e, text: newText } : e)
    }), { skipHistory: true });
    setTimeout(() => textarea.focus(), 0);
  };

  const applyAlign = (align) => {
    const textarea = document.querySelector('textarea[placeholder="Esemény leírása..."]');
    if (!textarea) return;
    const lines = localText.split('\n');
    const startLine = localText.substring(0, textarea.selectionStart).split('\n').length - 1;
    const endLine = localText.substring(0, textarea.selectionEnd).split('\n').length - 1;
    const aligned = lines.map((line, i) => {
      if (i < startLine || i > endLine) return line;
      if (align === 'center') return `>>> ${line} <<<`;
      if (align === 'right') return `>> ${line}`;
      return line;
    }).join('\n');
    recordSnapshot(bookDataRef.current);
    setLocalText(aligned);
    setBookDataWithHistory(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === selectedEvent?.id ? { ...e, text: aligned } : e)
    }), { skipHistory: true });
    setTimeout(() => textarea.focus(), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#090810', fontFamily: "'Outfit', 'Inter', sans-serif", color: '#e2e8f0', userSelect: 'none' }}>

      {/* TOP POWERPOINT RIBBON TOOLBAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        height: 56,
        background: 'linear-gradient(90deg, #0e0c1a 0%, #16122b 50%, #0e0c1a 100%)',
        borderBottom: '1px solid #232035',
        flexShrink: 0,
        zIndex: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        overflow: 'visible',
      }}>
        {/* Brand / Left title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onBackToMenu && (
            <button onClick={onBackToMenu} style={btn('secondary', 'sm')} title="Vissza a főmenübe">
              <Home size={15} />
            </button>
          )}
          <ByzantineCross size={20} color="#f59e0b" />
          <span
            style={{ fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={`${bookData.schoolName} • ${bookData.schoolMotto} • ${bookData.currentYear}`}
          >
            {bookData.schoolName || 'Görögkatolikus Iskola'}
          </span>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>• {bookData.currentYear}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: '#2e2a45', flexShrink: 0, marginLeft: 4, marginRight: 4 }} />

        {/* Középső műveletek */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2 }}>
          <input
            type="file"
            id="toolbar-facebook-folder-import"
            style={{ display: 'none' }}
            webkitdirectory="true"
            directory="true"
            ref={fbFolderInputRef}
            onChange={handleFacebookFolderImport}
          />
          <input type="file" accept="application/json,.json" ref={projectInputRef} style={{ display: 'none' }} onChange={importProject} />

          {onPublish && (
            <button
              onClick={onPublish}
              style={{
                ...btn('accent', 'sm'),
                background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                color: '#fff',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(34,197,94,0.35)',
                flexShrink: 0,
              }}
              title="Mentés és közzététel a szerverre (jelszóval védve)"
            >
              🚀 Közzététel
            </button>
          )}

          <button
            onClick={handleManualSave}
            style={{ ...btn(saveFeedback ? 'primary' : 'secondary', 'sm'), flexShrink: 0 }}
            title={lastSavedAt ? `Utoljára mentve: ${lastSavedAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} • Ctrl+S` : 'Helyi mentés (Ctrl+S)'}
          >
            <Save size={14} /> {saveFeedback ? 'Mentve!' : 'Mentés'}
          </button>

          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              ...btn('secondary', 'sm'),
              opacity: canUndo ? 1 : 0.4,
              cursor: canUndo ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
            }}
            title="Visszavonás (Ctrl+Z)"
          >
            <RotateCcw size={14} /> Visszavonás
          </button>

          <button
            onClick={handleRedo}
            disabled={!canRedo}
            style={{
              ...btn('secondary', 'sm'),
              opacity: canRedo ? 1 : 0.4,
              cursor: canRedo ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
            }}
            title="Újra (Ctrl+Y vagy Ctrl+Shift+Z)"
          >
            <RotateCcw size={14} style={{ transform: 'scaleX(-1)' }} /> Újra
          </button>

          <button onClick={addEventPage} style={{ ...btn('primary', 'sm'), flexShrink: 0 }} title="Új esemény dia hozzáadása">
            <Plus size={14} /> Új Dia
          </button>

          <button onClick={() => fbFolderInputRef.current?.click()} style={{ ...btn('secondary', 'sm'), flexShrink: 0 }} title="Facebook export mappa importálása" disabled={fbImportBusy}>
            <Upload size={14} /> {fbImportBusy ? 'Import…' : 'FB Import'}
          </button>

          <button
            onClick={exportBookEvents}
            style={{ ...btn('secondary', 'sm'), flexShrink: 0 }}
            title="Események exportálása JSON fájlként (feltölthető a Drive-ra / public mappába)"
          >
            <Download size={14} /> Export JSON
          </button>

          {lastSavedAt && (
            <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap', display: 'none' }}>
              {`✓ ${lastSavedAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          )}
        </div>

        {/* Jobb oldali nézetek */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, position: 'relative' }}>
          <button onClick={() => exportProject()} style={btn('secondary', 'sm')} title="Projekt mentése fájlba">
            <Download size={15} /> Export
          </button>
          <button onClick={() => projectInputRef.current?.click()} style={btn('secondary', 'sm')} title="Projekt megnyitása">
            <FolderOpen size={15} /> Import
          </button>
          <button onClick={() => setViewMode('preview')} style={btn('secondary', 'sm')}>
            <Eye size={15} /> Előnézet
          </button>
          <button onClick={() => setViewMode('print')} style={{ ...btn('primary', 'sm'), background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}>
            <Printer size={15} /> Nyomtatás / PDF
          </button>
          {onAdminLogout && (
            <button onClick={onAdminLogout} style={{ ...btn('secondary', 'sm'), color: '#f87171', borderColor: '#7f1d1d' }} title="Admin kijelentkezés">
              🔐 Kilépés
            </button>
          )}
        </div>
      </div>

      {/* THREE-COLUMN POWERPOINT LAYOUT */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT COLUMN: SLIDE DECK (DIÁK) */}
        <SlideDeck
          pages={pages}
          bookData={bookData}
          selectedPageId={selectedPageId}
          setSelectedPageId={(id) => {
            setSelectedPageId(id);
            setEditingText(false);
            setSelectedElemId(null);
          }}
          addGradPage={addGradPage}
          addEventPage={addEventPage}
          onDeletePage={handleDeleteSlide}
        />

        {/* CENTER COLUMN: CANVAS WORKSPACE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflowY: 'auto', padding: '24px', background: '#131120', position: 'relative' }}>
          <CenterEditor
            page={selectedPage}
            bookData={bookData}
            setBookData={setBookDataWithHistory}
            selectedEvent={selectedEvent}
            editingText={editingText}
            localText={localText}
            setLocalText={setLocalText}
            setEditingText={(v) => {
              if (v && selectedEvent) {
                setLocalText(selectedEvent.text || '');
              }
              setEditingText(v);
            }}
            saveEventText={saveEventText}
            toggleEventImage={toggleEventImage}
            selectedElemId={selectedElemId}
            setSelectedElemId={setSelectedElemId}
            canUndo={canUndo}
            canRedo={canRedo}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            recordSnapshot={recordSnapshot}
          />
        </div>

        {/* RIGHT COLUMN: PROPERTIES INSPECTOR (TULAJDONSÁGOK) */}
        <RightInspector
          bookData={bookData}
          setBookData={setBookDataWithHistory}
          selectedPage={selectedPage}
          selectedEvent={selectedEvent}
          onOpenImport={() => setIsImportModalOpen(true)}
          onResetDefault={onResetDefault}
          onResetEmpty={onResetEmpty}
          selectedElemId={selectedElemId}
          setSelectedElemId={setSelectedElemId}
          addGradPage={addGradPage}
          localTextFontSize={localTextFontSize}
          setLocalTextFontSize={setLocalTextFontSize}
          localTextLineHeight={localTextLineHeight}
          setLocalTextLineHeight={setLocalTextLineHeight}
          canUndo={canUndo}
          canRedo={canRedo}
          localText={localText}
          setLocalText={setLocalText}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          applyFormat={applyFormat}
          applyAlign={applyAlign}
          handleTextKeyDown={handleTextKeyDown}
          handleTextChange={handleTextChange}
        />
      </div>

      {/* INTERACTIVE IMPORT MANAGER MODAL */}
      {isImportModalOpen && (
        <ImportModal
          bookData={bookData}
          setBookData={setBookData}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}
    </div>
  );
}

function MenuAction({ icon, label, onClick, danger = false }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px',
      border: 'none', borderRadius: 8, background: 'transparent', color: danger ? '#fca5a5' : '#e2e8f0',
      fontSize: 13, fontWeight: 650, cursor: 'pointer', textAlign: 'left',
    }} onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {icon}{label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPORT MANAGER MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ImportModal({ bookData, setBookData, onClose }) {
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [customJsonText, setCustomJsonText] = useState('');
  const [jsonSearchQuery, setJsonSearchQuery] = useState('');
  const [parsedJsonEvents, setParsedJsonEvents] = useState([]);
  const [jsonParseError, setJsonParseError] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('all');
  const jsonFileRef = useRef();

  // Compute school year stats
  const schoolYearStats = useMemo(() => {
    const stats = {};
    availableEvents.forEach(e => {
      const sy = e.schoolYear || 'Ismeretlen';
      stats[sy] = (stats[sy] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  }, [availableEvents]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/book_events.json');
        if (!res.ok) throw new Error('Nem sikerült a letöltés');
        const data = await res.json();
        setAvailableEvents(repairBookData(data));
        setSelectedIds(new Set(data.map(e => e.id)));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(availableEvents.map(e => e.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const filteredEvents = availableEvents.filter(e => {
    const q = searchQuery.toLowerCase();
    const yearMatch = selectedSchoolYear === 'all' || (e.schoolYear || 'Ismeretlen') === selectedSchoolYear;
    return yearMatch && ((e.text || '').toLowerCase().includes(q) || (e.date || '').toLowerCase().includes(q) || (e.schoolYear || '').toLowerCase().includes(q));
  });

  const handleAppend = () => {
    const itemsToAdd = availableEvents.filter(e => selectedIds.has(e.id));
    if (itemsToAdd.length === 0) {
      alert('Nincs kiválasztva egyetlen esemény sem!');
      return;
    }
    setBookData(prev => {
      const currentIds = new Set((prev.events || []).map(e => e.id));
      const newItems = itemsToAdd.filter(e => !currentIds.has(e.id));
      return {
        ...prev,
        events: [...(prev.events || []), ...newItems]
      };
    });
    alert(`Sikeresen hozzáadva ${selectedIds.size} esemény!`);
    onClose();
  };

  const handleReplace = () => {
    const itemsToAdd = availableEvents.filter(e => selectedIds.has(e.id));
    if (itemsToAdd.length === 0) {
      alert('Nincs kiválasztva egyetlen esemény sem!');
      return;
    }
    if (confirm(`Biztosan lecseréled a meglévő eseményeket erre a ${itemsToAdd.length} kiválasztott elemre?`)) {
      setBookData(prev => ({
        ...prev,
        events: itemsToAdd
      }));
      alert('Események lecserélve!');
      onClose();
    }
  };

  const handleCustomJsonImport = () => {
    try {
      const parsed = JSON.parse(customJsonText);
      if (!Array.isArray(parsed)) throw new Error('A JSON-nak tömbnek kell lennie!');
      setBookData(prev => ({ ...prev, events: repairBookData(parsed) }));
      alert('Saját JSON adatok sikeresen betöltve!');
      onClose();
    } catch (err) {
      alert('Érvénytelen JSON formátum: ' + err.message);
    }
  };

  // Load JSON from disk file
  const handleJsonFileBrowse = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCustomJsonText(text);
      setJsonParseError('');
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setParsedJsonEvents(repairBookData(parsed));
        } else {
          setParsedJsonEvents([]);
          setJsonParseError('A fájl nem tartalmaz tömböt. Ellenőrizd a JSON struktúrát.');
        }
      } catch (err) {
        setParsedJsonEvents([]);
        setJsonParseError('JSON parse hiba: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
    // reset so same file can be re-selected
    e.target.value = '';
  };

  // Live parse when user edits textarea
  const handleJsonTextChange = (text) => {
    setCustomJsonText(text);
    setJsonParseError('');
    if (!text.trim()) { setParsedJsonEvents([]); return; }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) setParsedJsonEvents(repairBookData(parsed));
      else { setParsedJsonEvents([]); setJsonParseError('A JSON-nak tömbnek kell lennie!'); }
    } catch {
      setParsedJsonEvents([]);
    }
  };

  const filteredJsonEvents = parsedJsonEvents.filter(e => {
    const q = jsonSearchQuery.toLowerCase();
    return !q || (e.text || '').toLowerCase().includes(q) || (e.date || '').toLowerCase().includes(q) || (e.schoolYear || '').toLowerCase().includes(q);
  });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 840, height: '85vh', background: '#131120',
        borderRadius: 16, border: '1px solid #2e2a45', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)', overflow: 'hidden'
      }}>

        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #232035', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0e0c1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Upload size={22} style={{ color: '#f59e0b' }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f8fafc' }}>Események Importálása és Kezelése</h3>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Válaszd ki az importálni vagy cserélni kívánt bejegyzéseket</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #232035', background: '#0e0c1a', padding: '0 24px', gap: 16 }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'list' ? '#f59e0b' : 'transparent'}`,
              color: activeTab === 'list' ? '#f59e0b' : '#94a3b8', fontWeight: 700, fontSize: 14, cursor: 'pointer'
            }}
          >
            Iskolai Események Lista ({availableEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('json')}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'json' ? '#f59e0b' : 'transparent'}`,
              color: activeTab === 'json' ? '#f59e0b' : '#94a3b8', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <FileCode size={16} /> JSON Betöltés / Keresés {parsedJsonEvents.length > 0 && `(${parsedJsonEvents.length})`}
          </button>
        </div>

        {/* Body */}
        {activeTab === 'list' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 24px', gap: 14 }}>
            {/* School Year Filter & Stats */}
            {schoolYearStats.length > 0 && (
              <div style={{ padding: '12px 24px', borderBottom: '1px solid #232035', background: '#0e0c1a' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Tanévek:</span>
                    <select
                      value={selectedSchoolYear}
                      onChange={e => setSelectedSchoolYear(e.target.value)}
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, minWidth: 160, background: '#181528', borderColor: '#2e2a45' }}
                    >
                      <option value="all">📚 Összes tanév ({availableEvents.length} esemény)</option>
                      {schoolYearStats.map(([sy, count]) => (
                        <option key={sy} value={sy}>{sy} ({count} esemény)</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Kiválasztott: <strong style={{ color: '#f59e0b' }}>{selectedSchoolYear === 'all' ? 'Összes' : selectedSchoolYear}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {schoolYearStats.map(([sy, count]) => (
                      <span key={sy} style={{ fontSize: 10, fontWeight: 600, color: selectedSchoolYear === sy ? '#f59e0b' : '#94a3b8', background: selectedSchoolYear === sy ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.08)', padding: '3px 8px', borderRadius: 12, border: selectedSchoolYear === sy ? '1px solid #f59e0b' : '1px solid transparent' }}>
                        {sy}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Search & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Keresés az események között..."
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={selectAll} style={btn('secondary', 'sm')}>Mind Kijelölése</button>
                <button onClick={deselectAll} style={btn('secondary', 'sm')}>Kijelölés Törlése</button>
              </div>
            </div>

            {/* Event List */}
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Adatok betöltése...</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
                {filteredEvents.map(evt => {
                  const isChecked = selectedIds.has(evt.id);
                  return (
                    <div
                      key={evt.id}
                      onClick={() => toggleSelect(evt.id)}
                      style={{
                        padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${isChecked ? '#f59e0b' : '#232035'}`,
                        background: isChecked ? 'rgba(245, 158, 11, 0.06)' : '#181528', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, border: `2px solid ${isChecked ? '#f59e0b' : '#475569'}`,
                        background: isChecked ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: 2, flexShrink: 0
                      }}>
                        {isChecked && <Check size={14} style={{ color: '#000', strokeWidth: 3 }} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: 4 }}>{evt.date || 'Dátum nélkül'}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{evt.schoolYear}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>• {(evt.images || []).length} fotó</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {evt.text || 'Nincs leírás'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Top toolbar: file browse + search */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #232035', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Hidden file input */}
              <input
                type="file" accept=".json,application/json"
                ref={jsonFileRef} style={{ display: 'none' }}
                onChange={handleJsonFileBrowse}
              />
              <button onClick={() => jsonFileRef.current?.click()} style={{ ...btn('accent', 'md') }}>
                <Upload size={16} /> JSON Fájl Megnyitása a Gépről
              </button>

              {/* Search inside parsed JSON */}
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#64748b' }} />
                <input
                  value={jsonSearchQuery}
                  onChange={e => setJsonSearchQuery(e.target.value)}
                  placeholder="Keresés a betöltött JSON eseményekben..."
                  style={{ ...inputStyle, paddingLeft: 32, fontSize: 12 }}
                />
              </div>
            </div>

            {/* Two-pane: textarea left, preview right */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

              {/* Left: JSON textarea */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 12px 14px 24px', gap: 8, borderRight: '1px solid #232035', overflow: 'hidden' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>JSON Szöveg (szerkeszthető)</label>
                {jsonParseError && (
                  <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '6px 10px' }}>
                    ⚠ {jsonParseError}
                  </div>
                )}
                <textarea
                  value={customJsonText}
                  onChange={e => handleJsonTextChange(e.target.value)}
                  placeholder={'[\n  {\n    "id": "1",\n    "schoolYear": "2025/2026",\n    "date": "2026. június 10.",\n    "text": "Tanévzáró ünnepség",\n    "images": []\n  }\n]'}
                  style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11, resize: 'none', lineHeight: 1.6, minHeight: 0 }}
                />
                <button onClick={handleCustomJsonImport} style={{ ...btn('primary', 'md'), justifyContent: 'center' }}>
                  Felülírás: Betöltés az Évkönyvbe
                </button>
              </div>

              {/* Right: Parsed preview list */}
              <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '14px 12px 14px 12px', gap: 8, overflow: 'hidden' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Előnézet ({filteredJsonEvents.length} / {parsedJsonEvents.length} esemény)
                </label>
                {parsedJsonEvents.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#475569' }}>
                    <FileCode size={32} />
                    <span style={{ fontSize: 12, textAlign: 'center' }}>Nyiss meg egy JSON fájlt a gépedről,<br/>vagy illeszd be a szöveget balra.</span>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredJsonEvents.map((evt, i) => (
                      <div key={evt.id || i} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #232035', background: '#181528' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 3 }}>
                            {evt.date || 'Dátum?'}
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>{evt.schoolYear}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>• {(evt.images || []).length} fotó</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {evt.text || 'Nincs szöveg'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        {activeTab === 'list' && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #232035', background: '#0e0c1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              Kiválasztva: <strong style={{ color: '#f59e0b' }}>{selectedIds.size}</strong> / {availableEvents.length} esemény
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleAppend} style={btn('secondary', 'lg')}>
                <Plus size={18} /> Kiválasztottak Hozzáadása ({selectedIds.size})
              </button>
              <button onClick={handleReplace} style={btn('primary', 'lg')}>
                <RotateCcw size={18} /> Cserélés Kiválasztottakkal ({selectedIds.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEFT PANEL: DIÁK (SLIDE DECK)
// ══════════════════════════════════════════════════════════════════════════════
function SlideDeck({ pages, bookData, selectedPageId, setSelectedPageId, addGradPage, addEventPage, onDeletePage }) {
  const [hoveredId, setHoveredId] = useState(null);
  return (
    <div style={{
      width: 230,
      flexShrink: 0,
      background: '#0e0c1a',
      borderRight: '1px solid #232035',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Slide Deck Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #232035',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        background: '#090810'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={18} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1' }}>
            Diák ({pages.length})
          </span>
        </div>
        <button onClick={addGradPage} style={{ ...btn('accent', 'sm'), padding: '4px 8px', fontSize: 11 }} title="Új ballagási év tabló hozzáadása">
          <Plus size={12} /> Év
        </button>
      </div>

      {/* Slide List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pages.map((page, idx) => {
          const isSelected = page.id === selectedPageId;
          const isHovered = hoveredId === page.id;
          const deletable = ['event', 'graduation', 'teachers', 'class'].includes(page.type);
          return (
            <div
              key={page.id}
              onClick={() => setSelectedPageId(page.id)}
              onMouseEnter={() => setHoveredId(page.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Slide Number */}
              <span style={{
                fontSize: 12,
                fontWeight: 800,
                color: isSelected ? '#f59e0b' : '#64748b',
                width: 20,
                textAlign: 'right',
                paddingTop: 4
              }}>
                {idx + 1}
              </span>

              {/* Thumbnail Container */}
              <div style={{
                flex: 1,
                border: `2px solid ${isSelected ? '#f59e0b' : '#232035'}`,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#131120',
                boxShadow: isSelected ? '0 0 16px rgba(245, 158, 11, 0.35)' : '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative'
              }}>
                <Thumbnail page={page} bookData={bookData} />
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isSelected ? '#f8fafc' : '#94a3b8',
                  padding: '6px 8px',
                  background: isSelected ? 'rgba(245, 158, 11, 0.15)' : '#090810',
                  borderTop: '1px solid #232035',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {pageTypeLabel(page, bookData)}
                </div>
              </div>

              {/* Dia törlése (hover) — esemény és tabló oldalaknál */}
              {deletable && isHovered && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletePage?.(page); }}
                  title="Dia törlése"
                  style={{
                    position: 'absolute', top: -4, right: -4, zIndex: 6,
                    width: 22, height: 22, borderRadius: 7, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(239, 68, 68, 0.55)',
                    color: '#f87171', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mini A4 Thumbnail ───────────────────────────────────────────────────────
function Thumbnail({ page, bookData }) {
  return (
    <div style={{ width: '100%', height: 160, overflow: 'hidden', position: 'relative', background: '#fff' }}>
      <div style={{ width: 500, height: 707, transform: 'scale(0.32)', transformOrigin: 'top left', pointerEvents: 'none' }}>
        <PageContent page={page} bookData={bookData} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CENTER COLUMN: CANVAS WORKSPACE
// ══════════════════════════════════════════════════════════════════════════════
function CenterEditor({
  page,
  bookData,
  setBookData,
  selectedEvent,
  editingText,
  localText,
  setLocalText,
  setEditingText,
  saveEventText,
  toggleEventImage,
  selectedElemId,
  setSelectedElemId,
  canUndo,
  canRedo,
  handleUndo,
  handleRedo,
  recordSnapshot,
}) {
  if (!page) return null;

  const handleResetLayout = () => {
    if (confirm('Biztosan visszaállítod az oldal elemeinek pozícióit az alapértelmezettre?')) {
      setBookData(prev => {
        const layouts = { ...(prev.pageLayouts || {}) };
        delete layouts[page.id];
        return { ...prev, pageLayouts: layouts };
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 800 }}>
      
      {/* Canvas Toolbar & Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        width: '100%',
        maxWidth: 540,
        background: '#0e0c1a',
        padding: '10px 16px',
        borderRadius: 10,
        border: '1px solid #232035',
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ByzantineCross size={18} color="#f59e0b" />
          {pageTypeLabel(page, bookData)}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={handleResetLayout} style={btn('secondary', 'sm')} title="Pozíciók alaphelyzetbe">
            <RotateCcw size={13} /> Pozíciók Visszaállítása
          </button>
          {selectedElemId && (
            <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>
              [{selectedElemId}]
            </span>
          )}
          {selectedElemId?.includes('custom') && (
            <button
              onClick={() => {
                setBookData(prev => {
                  const layouts = prev.pageLayouts || {};
                  const current = layouts[page.id] || {};
                  return { ...prev, pageLayouts: { ...layouts, [page.id]: { ...current, customElements: (current.customElements || []).filter(e => e.id !== selectedElemId) } } };
                });
                setSelectedElemId(null);
              }}
              style={{ ...btn('secondary', 'sm'), color: '#f87171', borderColor: '#7f1d1d' }}
            >
              <X size={14} /> Törlés
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Presentation Canvas Stage */}
      <div style={{
        padding: '16px',
        background: '#05040a',
        borderRadius: 14,
        border: '1px solid #232035',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}>
        <InteractiveCanvas
          page={page}
          bookData={bookData}
          setBookData={setBookData}
          renderContent={() => <PageContent page={page} bookData={bookData} />}
          selectedEvent={selectedEvent}
          editingText={editingText}
          localText={localText}
          setLocalText={setLocalText}
          setEditingText={setEditingText}
          saveEventText={saveEventText}
          toggleEventImage={toggleEventImage}
          selectedElemId={selectedElemId}
          setSelectedElemId={setSelectedElemId}
          recordSnapshot={recordSnapshot}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RIGHT PANEL: PROPERTIES INSPECTOR (TULAJDONSÁGOK)
// ══════════════════════════════════════════════════════════════════════════════
function RightInspector({
  bookData,
  setBookData,
  selectedPage,
  selectedEvent,
  onOpenImport,
  onResetDefault,
  onResetEmpty,
  selectedElemId,
  setSelectedElemId,
  addGradPage,
  localTextFontSize,
  setLocalTextFontSize,
  localTextLineHeight,
  setLocalTextLineHeight,
  canUndo,
  canRedo,
  localText,
  setLocalText,
  handleUndo,
  handleRedo,
  applyFormat,
  applyAlign,
  handleTextKeyDown,
  handleTextChange,
}) {
  const logoRef = useRef();
  const principalPhotoRef = useRef();
  const teacherPhotoRefs = useRef({});
  const classTeacherPhotoRef = useRef();
  const classGroupPhotoRef = useRef();
  const studentPhotoRefs = useRef({});
  const eventImageInputRef = useRef(null);
  const graduationImageRef = useRef();

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = field === 'schoolLogo' ? await fileToLogoDataUrl(file) : await fileToDataUrl(file);
    setBookData(prev => ({
      ...prev,
      [field]: url,
      ...(field === 'schoolLogo' ? { logoStyle: prev.logoStyle || 'badge' } : {})
    }));
  };

  const updateEventField = (field, value) => {
    if (!selectedEvent) return;
    setBookData(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === selectedEvent.id ? { ...e, [field]: value } : e)
    }));
  };

  const updateEventImages = (newImages) => {
    if (!selectedEvent) return;
    setBookData(prev => ({
      ...prev,
      events: (prev.events || []).map(ev => ev.id === selectedEvent.id ? { ...ev, images: newImages } : ev)
    }));
  };

  const addEventImage = async (e) => {
    if (!selectedEvent) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newImages = await Promise.all(files.map(async file => ({ url: await fileToDataUrl(file), enabled: true })));
    const currentImages = normalizeEventImages(selectedEvent.images);
    updateEventImages([...currentImages, ...newImages]);
    if (eventImageInputRef.current) eventImageInputRef.current.value = '';
  };

  const removeEventImage = (index) => {
    if (!selectedEvent) return;
    const currentImages = normalizeEventImages(selectedEvent.images);
    updateEventImages(currentImages.filter((_, idx) => idx !== index));
  };

  const moveEventImage = (fromIndex, toIndex) => {
    if (!selectedEvent) return;
    const currentImages = normalizeEventImages(selectedEvent.images);
    if (toIndex < 0 || toIndex >= currentImages.length) return;
    const next = [...currentImages];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateEventImages(next);
  };

  const toggleEventImageEnabled = (index) => {
    if (!selectedEvent) return;
    const currentImages = normalizeEventImages(selectedEvent.images);
    const next = currentImages.map((img, idx) => idx === index ? { ...img, enabled: !img.enabled } : img);
    updateEventImages(next);
  };

  const deleteEvent = () => {
    if (!selectedEvent) return;
    if (!window.confirm('Biztosan törlöd ezt az eseményt? A dia is eltűnik az évkönyvből.')) return;
    setBookData(prev => ({
      ...prev,
      events: (prev.events || []).filter(ev => ev.id !== selectedEvent.id)
    }));
    setSelectedElemId(null);
  };

  const handleFileUploadNested = async (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    callback(url);
  };

  // ── Selected Element Resizer / Layout Updater ──────────────────────────────
  const selectedElemLayout = selectedPage && selectedElemId
    ? getElemBox(selectedPage, selectedElemId, bookData)
    : null;

  const updateSelectedElemLayout = (field, value) => {
    if (!selectedPage || !selectedElemId) return;
    const pageId = selectedPage.id;
    setBookData(prev => {
      const layouts = prev.pageLayouts || {};
      const current = layouts[pageId] || {};
      const elements = current.elements || {};
      const currentBox = getElemBox(selectedPage, selectedElemId, prev);
      return {
        ...prev,
        pageLayouts: {
          ...layouts,
          [pageId]: {
            ...current,
            elements: { ...elements, [selectedElemId]: { ...currentBox, [field]: value } }
          }
        }
      };
    });
  };

  // Ha custom szöveg elem van kijelölve → megmutatjuk a tulajdonságait bármelyik oldaltípusnál
  if (selectedElemId?.includes('custom_text')) {
    const pageId = selectedPage?.id;
    const elem = bookData?.pageLayouts?.[pageId]?.customElements?.find(e => e.id === selectedElemId);
    if (!elem) {
      // Debug: elem nem található
      return (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>✍ Szöveg</div>
          <div style={{ fontSize: 12, color: '#f87171', padding: 8 }}>
            Elem nem található<br/>
            pageId: {pageId}<br/>
            elemId: {selectedElemId}<br/>
            customElems: {bookData?.pageLayouts?.[pageId]?.customElements?.length || 0}
          </div>
        </div>
      );
    }
    const updateProp = (prop, val) => setBookData(prev => {
        const layouts = prev.pageLayouts || {};
        const cur = layouts[pageId] || {};
        return { ...prev, pageLayouts: { ...layouts, [pageId]: { ...cur,
          customElements: (cur.customElements || []).map(e => e.id === selectedElemId ? { ...e, [prop]: val } : e)
        }}};
      });
      return (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>✍ Szöveg tulajdonságok</div>

          <label style={labelStyle}>Szöveg</label>
          <textarea value={elem.text || ''} onChange={e => updateProp('text', e.target.value)}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Betűméret (px)</label>
              <input type="number" min="6" max="120" value={elem.fontSize || 14}
                onChange={e => updateProp('fontSize', Number(e.target.value))}
                style={{ ...inputStyle, padding: '6px 8px' }} />
            </div>
            <div>
              <label style={labelStyle}>Szín</label>
              <input type="color" value={elem.color || '#ffffff'}
                onChange={e => updateProp('color', e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #2e2a45', background: '#0e0c1a', cursor: 'pointer' }} />
            </div>
          </div>

          <label style={labelStyle}>Betűtípus</label>
          <select value={elem.fontFamily || "'Inter', sans-serif"}
            onChange={e => updateProp('fontFamily', e.target.value)}
            style={{ ...inputStyle, padding: '6px 8px' }}>
            <option value="'Inter', sans-serif">Inter (modern)</option>
            <option value="'Georgia', serif">Georgia (talpas)</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Arial', sans-serif">Arial</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Palatino', serif">Palatino (elegáns)</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Vastagság</label>
              <select value={elem.fontWeight || 400} onChange={e => updateProp('fontWeight', Number(e.target.value))}
                style={{ ...inputStyle, padding: '6px 8px' }}>
                <option value={300}>Vékony</option>
                <option value={400}>Normal</option>
                <option value={600}>Félkövér</option>
                <option value={700}>Kövér</option>
                <option value={900}>Extra kövér</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Igazítás</label>
              <select value={elem.textAlign || 'left'} onChange={e => updateProp('textAlign', e.target.value)}
                style={{ ...inputStyle, padding: '6px 8px' }}>
                <option value="left">Bal</option>
                <option value="center">Közép</option>
                <option value="right">Jobb</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>Betűköz</label>
          <select value={elem.letterSpacing || 'normal'} onChange={e => updateProp('letterSpacing', e.target.value)}
            style={{ ...inputStyle, padding: '6px 8px' }}>
            <option value="normal">Normal</option>
            <option value="0.05em">Tág</option>
            <option value="0.1em">Tágas</option>
            <option value="0.15em">Nagyon tágas</option>
            <option value="-0.02em">Szűk</option>
          </select>

          <button onClick={() => setSelectedElemId(null)}
            style={{ ...btn('secondary', 'sm'), marginTop: 8 }}>
            ← Vissza
          </button>
        </div>
      );
  }

  // COVER / GENERAL PAGE EDITING
  if (!selectedPage || selectedPage.type === 'cover' || selectedPage.type === 'divider') {
    const addClass = () => {
      const newClass = { id: 'c_' + Date.now(), className: 'Új osztály', classTeacherName: '', classTeacherPhoto: '', groupPhoto: '', students: [] };
      setBookData(prev => ({ ...prev, classes: [...(prev.classes || []), newClass] }));
    };
    const removeClass = (id) => {
      setBookData(prev => ({ ...prev, classes: (prev.classes || []).filter(c => c.id !== id) }));
    };

    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>Tulajdonságok — Címlap & Iskola</div>

        {/* Selected Element Adjuster */}
        {selectedElemId && selectedElemLayout && (
          <ElementAdjusterCard
            elemId={selectedElemId}
            layout={selectedElemLayout}
            updateLayout={updateSelectedElemLayout}
            onClose={() => setSelectedElemId(null)}
            bookData={bookData}
            setBookData={setBookData}
            selectedPage={selectedPage}
          />
        )}

        {/* Custom szöveg elem tulajdonságok */}
        {selectedElemId?.includes('custom_text') && (() => {
          const pageId = selectedPage?.id;
          const elem = bookData?.pageLayouts?.[pageId]?.customElements?.find(e => e.id === selectedElemId);
          if (!elem) return null;
          const updateProp = (prop, val) => setBookData(prev => {
            const layouts = prev.pageLayouts || {};
            const cur = layouts[pageId] || {};
            return { ...prev, pageLayouts: { ...layouts, [pageId]: { ...cur,
              customElements: (cur.customElements || []).map(e => e.id === selectedElemId ? { ...e, [prop]: val } : e)
            }}};
          });
          return (
            <div style={{ background: '#161228', border: '1.5px solid #7c3aed', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 2 }}>✍ Szöveg tulajdonságok</div>

              <label style={labelStyle}>Szöveg</label>
              <textarea value={elem.text || ''} onChange={e => updateProp('text', e.target.value)}
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Betűméret (px)</label>
                  <input type="number" min="6" max="120" value={elem.fontSize || 14}
                    onChange={e => updateProp('fontSize', Number(e.target.value))}
                    style={{ ...inputStyle, padding: '6px 8px' }} />
                </div>
                <div>
                  <label style={labelStyle}>Szín</label>
                  <input type="color" value={elem.color || '#ffffff'}
                    onChange={e => updateProp('color', e.target.value)}
                    style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #2e2a45', background: '#0e0c1a', cursor: 'pointer' }} />
                </div>
              </div>

              <label style={labelStyle}>Betűtípus</label>
              <select value={elem.fontFamily || "'Inter', sans-serif"}
                onChange={e => updateProp('fontFamily', e.target.value)}
                style={{ ...inputStyle, padding: '6px 8px' }}>
                <option value="'Inter', sans-serif">Inter (modern)</option>
                <option value="'Georgia', serif">Georgia (talpas)</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Arial', sans-serif">Arial</option>
                <option value="'Courier New', monospace">Courier New (gép)</option>
                <option value="'Palatino', serif">Palatino (elegáns)</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Vastagság</label>
                  <select value={elem.fontWeight || 400} onChange={e => updateProp('fontWeight', Number(e.target.value))}
                    style={{ ...inputStyle, padding: '6px 8px' }}>
                    <option value={300}>Vékony</option>
                    <option value={400}>Normal</option>
                    <option value={600}>Félkövér</option>
                    <option value={700}>Kövér</option>
                    <option value={900}>Extra kövér</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Igazítás</label>
                  <select value={elem.textAlign || 'left'} onChange={e => updateProp('textAlign', e.target.value)}
                    style={{ ...inputStyle, padding: '6px 8px' }}>
                    <option value="left">Bal</option>
                    <option value="center">Közép</option>
                    <option value="right">Jobb</option>
                  </select>
                </div>
              </div>

              <label style={labelStyle}>Betűköz</label>
              <select value={elem.letterSpacing || 'normal'} onChange={e => updateProp('letterSpacing', e.target.value)}
                style={{ ...inputStyle, padding: '6px 8px' }}>
                <option value="normal">Normal</option>
                <option value="0.05em">Tág</option>
                <option value="0.1em">Tágas</option>
                <option value="0.15em">Nagyon tágas</option>
                <option value="-0.02em">Szűk</option>
              </select>
            </div>
          );
        })()}

        <button onClick={onOpenImport} style={{ ...btn('accent', 'lg'), width: '100%', justifyContent: 'center' }}>
          <Upload size={18} /> Adatok Importálása / Cseréje
        </button>

        <Divider label="Projekt Kezelés" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onResetDefault && (
            <button onClick={onResetDefault} style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}>
              <RotateCcw size={16} /> Minta Sablon Betöltése
            </button>
          )}
          {onResetEmpty && (
            <button onClick={onResetEmpty} style={{ ...btn('danger', 'md'), justifyContent: 'center', width: '100%' }}>
              <Trash2 size={16} /> Új Üres Projekt Indítása
            </button>
          )}
        </div>
        
        <Divider label="Oldalak" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(bookData.teachers || []).length === 0 && (
            <button
              onClick={() => setBookData(prev => ({ ...prev, teachers: [{ id: 't_' + Date.now(), name: '', subject: '', photo: '' }] }))}
              style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}
            >
              <Plus size={16} /> Nevelőtestület Oldal
            </button>
          )}
          <button onClick={addClass} style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}>
            <Plus size={16} /> Új Osztály Oldal
          </button>
        </div>

        <Divider label="Iskola Beállítások & Fejlécek" />
        
        <label style={labelStyle}>Iskola neve (Fejléc)</label>
        <input
          value={bookData.schoolName || ''}
          onChange={e => setBookData(prev => ({ ...prev, schoolName: e.target.value }))}
          style={inputStyle}
          placeholder="Iskola neve..."
        />

        <label style={labelStyle}>Jelmondat / Motto</label>
        <input
          value={bookData.schoolMotto || ''}
          onChange={e => setBookData(prev => ({ ...prev, schoolMotto: e.target.value }))}
          style={inputStyle}
          placeholder="Jelmondat..."
        />

        <label style={labelStyle}>Tanév vége (Évszám)</label>
        <input
          type="number"
          value={bookData.currentYear || 2026}
          onChange={e => setBookData(prev => ({ ...prev, currentYear: Number(e.target.value) }))}
          style={inputStyle}
        />

        <label style={labelStyle}>Iskolai Logó / Címer Cseréje</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bookData.schoolLogo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8, border: '1px solid #2e2a45', background: '#121024' }}>
              <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {renderSchoolLogo(bookData, {}, 32)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Aktív Iskolai Címer</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Stílus: {bookData.logoStyle === 'badge' ? 'Fehér körlap (arany szegély)' : bookData.logoStyle === 'glow' ? 'Fehér fényudvar' : bookData.logoStyle === 'shadow' ? '3D árnyék' : 'Eredeti'}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12, borderRadius: 8, border: '1px dashed #2e2a45', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>Nincs egyedi logó feltöltve</div>
          )}

          {/* Logó Kiemelés (Beolvadás elleni védelem) */}
          <label style={{ ...labelStyle, marginTop: 4, color: '#fbbf24' }}>🛡️ Logó Kiemelés (Ne olvadjon be a fotóba!)</label>
          <select
            value={bookData.logoStyle || 'badge'}
            onChange={e => setBookData(prev => ({ ...prev, logoStyle: e.target.value }))}
            style={{ ...inputStyle, padding: '8px 10px', borderColor: '#f59e0b' }}
          >
            <option value="badge">⚪ Fehér körlap arany szegéllyel (Ajánlott — nem olvad be)</option>
            <option value="glow">✨ Fehér fényudvar / glória (Kiemelés fotókon)</option>
            <option value="shadow">🌑 3D finom árnyék</option>
            <option value="none">◻️ Eredeti (effekt nélkül)</option>
          </select>

          <button
            onClick={() => setBookData(prev => ({ ...prev, schoolLogo: '/school_logo.png', logoStyle: 'badge' }))}
            style={{ ...btn('secondary', 'sm'), justifyContent: 'center', width: '100%', borderColor: '#f59e0b', color: '#f59e0b' }}
            title="A feltöltött kerek Szent Mihály címer használata tiszta körbevágással és arany szegéllyel"
          >
            ✨ Levágott Szent Mihály Címer Beállítása
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: bookData.schoolLogo ? '1fr 1fr' : '1fr', gap: 8 }}>
            <input type="file" accept="image/*" ref={logoRef} style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'schoolLogo')} />
            <button onClick={() => logoRef.current?.click()} style={{ ...btn('secondary', 'sm'), justifyContent: 'center' }}>
              <Upload size={14} /> Saját Kép Feltöltése
            </button>
            {bookData.schoolLogo && (
              <button
                onClick={() => setBookData(prev => ({ ...prev, schoolLogo: '' }))}
                style={{ ...btn('danger', 'sm'), justifyContent: 'center' }}
              >
                <Trash2 size={14} /> Eltávolítás
              </button>
            )}
          </div>
        </div>

        <Divider label="Borítólap Fotó" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={labelStyle}>Kép nagyítás: {bookData.coverPhotoZoom || 100}%</label>
          <input
            type="range" min="100" max="200" step="5"
            value={bookData.coverPhotoZoom || 100}
            onChange={e => setBookData(prev => ({ ...prev, coverPhotoZoom: Number(e.target.value) }))}
            style={{ width: '100%' }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>100% = kitölti a keretet, 150%+ = nagyított/vágott</span>
        </div>

        <Divider label="Ballagási Évek (2026, 2025...)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(bookData.graduationPages || []).sort((a, b) => b.year - a.year).map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#131120', borderRadius: 8, border: '1px solid #28243d' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{g.year} Ballagók Tablója</span>
            </div>
          ))}
          <button onClick={addGradPage} style={{ ...btn('accent', 'md'), justifyContent: 'center', width: '100%' }}>
            <Plus size={16} /> Új Ballagó Év Hozzáadása
          </button>
        </div>
      </div>
    );
  }

  // GRADUATION PAGE EDITING (BALLAGÁSI TABLÓK ÉVEK SZERINT 2026, 2025...)
  if (selectedPage.type === 'graduation') {
    const handleGradImage = async (e, gradId) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = await fileToDataUrl(file);
      setBookData(prev => ({
        ...prev,
        graduationPages: (prev.graduationPages || []).map(g => g.id === gradId ? { ...g, image: url } : g)
      }));
    };
    const grad = selectedPage.data;

    const removeGrad = (id) => {
      if (confirm('Biztosan törlöd ezt a ballagási évet?')) {
        setBookData(prev => ({ ...prev, graduationPages: (prev.graduationPages || []).filter(g => g.id !== id) }));
      }
    };

    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>{grad.year} Ballagók Tablója</div>

        {/* Selected Element Adjuster */}
        {selectedElemId && selectedElemLayout && (
          <ElementAdjusterCard
            elemId={selectedElemId}
            layout={selectedElemLayout}
            updateLayout={updateSelectedElemLayout}
            onClose={() => setSelectedElemId(null)}
            bookData={bookData}
            setBookData={setBookData}
            selectedPage={selectedPage}
          />
        )}

        <Divider label="Tabló Fejléc & Évszám" />

        <label style={labelStyle}>Tanév Éve (Évszám)</label>
        <input
          type="number"
          value={grad.year || 2026}
          onChange={e => setBookData(prev => ({
            ...prev,
            graduationPages: (prev.graduationPages || []).map(g => g.id === grad.id ? { ...g, year: Number(e.target.value) } : g)
          }))}
          style={inputStyle}
        />
        
        <label style={labelStyle}>Fejléc / Felirat Szerkesztése</label>
        <input
          value={grad.caption || ''}
          onChange={e => setBookData(prev => ({
            ...prev,
            graduationPages: (prev.graduationPages || []).map(g => g.id === grad.id ? { ...g, caption: e.target.value } : g)
          }))}
          style={inputStyle}
          placeholder="pl. 2025/2026 ballagó 8.A osztály..."
        />

        <Divider label="Tabló Kép & Átméretezés" />

        <label style={labelStyle}>Tabló Kép Feltöltése / Cseréje</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grad.image && <img src={grad.image} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #f59e0b' }} />}
          <input type="file" accept="image/*" ref={graduationImageRef} style={{ display: 'none' }} onChange={e => handleGradImage(e, grad.id)} />
          <button onClick={() => graduationImageRef.current?.click()} style={{ ...btn('accent', 'md'), justifyContent: 'center', width: '100%' }}>
            <Upload size={16} /> Tabló Kép Cseréje
          </button>
        </div>

        <Divider label="Iskolai Logó Cseréje" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bookData.schoolLogo && <img src={bookData.schoolLogo} alt="" style={{ height: 50, objectFit: 'contain', background: '#0e0c1a', borderRadius: 6, padding: 4, border: '1px solid #2e2a45' }} />}
          <input type="file" accept="image/*" ref={logoRef} style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'schoolLogo')} />
          <button onClick={() => logoRef.current?.click()} style={{ ...btn('secondary', 'md'), justifyContent: 'center' }}>
            <Upload size={14} /> Logó Cseréje
          </button>
        </div>

        <Divider label="Év Kezelése" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={addGradPage} style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}>
            <Plus size={16} /> Új Ballagó Év Hozzáadása
          </button>
          <button onClick={() => removeGrad(grad.id)} style={{ ...btn('danger', 'md'), justifyContent: 'center', width: '100%' }}>
            <Trash2 size={16} /> Ez az Év Törlése
          </button>
        </div>
      </div>
    );
  }

  // PRINCIPAL PAGE EDITING
  if (selectedPage.type === 'principal') {
    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>Igazgatói Köszöntő</div>
        
        {selectedElemId && selectedElemLayout && (
          <ElementAdjusterCard
            elemId={selectedElemId}
            layout={selectedElemLayout}
            updateLayout={updateSelectedElemLayout}
            onClose={() => setSelectedElemId(null)}
            bookData={bookData}
            setBookData={setBookData}
            selectedPage={selectedPage}
          />
        )}

        <label style={labelStyle}>Igazgató neve & Titulus</label>
        <input
          value={bookData.principalName || ''}
          onChange={e => setBookData(prev => ({ ...prev, principalName: e.target.value }))}
          style={inputStyle}
          placeholder="Név..."
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', marginTop: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={bookData.showPrincipalCross || false}
            onChange={e => setBookData(prev => ({ ...prev, showPrincipalCross: e.target.checked }))}
          />
          Kereszt és vonal (—) megjelenítése a név előtt
        </label>

        <label style={labelStyle}>Lelki Útravaló & Köszöntő</label>
        <textarea
          value={bookData.principalQuote || ''}
          onChange={e => setBookData(prev => ({ ...prev, principalQuote: e.target.value }))}
          style={{ ...inputStyle, minHeight: 160, resize: 'vertical' }}
          placeholder="Igazgatói üzenet felvétele..."
        />

        <label style={labelStyle}>Igazgatói Portré</label>
        {bookData.principalPhoto && (
          <img src={bookData.principalPhoto} alt="" style={{ height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #2e2a45' }} />
        )}
        <input type="file" accept="image/*" ref={principalPhotoRef} style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'principalPhoto')} />
        <button onClick={() => principalPhotoRef.current?.click()} style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}>
          <Upload size={16} /> Fotó Feltöltése
        </button>
      </div>
    );
  }

  // TEACHERS PAGE EDITING
  if (selectedPage.type === 'teachers') {
    const addTeacher = () => {
      const newTeacher = { id: 't_' + Date.now(), name: '', subject: '', photo: '' };
      setBookData(prev => ({ ...prev, teachers: [...(prev.teachers || []), newTeacher] }));
    };
    const updateTeacher = (id, field, value) => {
      setBookData(prev => ({
        ...prev,
        teachers: (prev.teachers || []).map(t => t.id === id ? { ...t, [field]: value } : t)
      }));
    };
    const removeTeacher = (id) => {
      setBookData(prev => ({ ...prev, teachers: (prev.teachers || []).filter(t => t.id !== id) }));
    };

    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>Nevelőtestület Szerkesztése</div>
        
        {selectedElemId && selectedElemLayout && (
          <ElementAdjusterCard
            elemId={selectedElemId}
            layout={selectedElemLayout}
            updateLayout={updateSelectedElemLayout}
            onClose={() => setSelectedElemId(null)}
            bookData={bookData}
            setBookData={setBookData}
            selectedPage={selectedPage}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(bookData.teachers || []).map((t, idx) => (
            <div key={t.id} style={{ border: '1px solid #28243d', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', background: '#131120' }}>
              <button 
                onClick={() => removeTeacher(t.id)} 
                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                title="Törlés"
              >
                <X size={16} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{idx + 1}. Pedagógus</span>
              <input 
                value={t.name || ''} 
                onChange={e => updateTeacher(t.id, 'name', e.target.value)} 
                style={inputStyle} 
                placeholder="Tanár neve..." 
              />
              <input 
                value={t.subject || ''} 
                onChange={e => updateTeacher(t.id, 'subject', e.target.value)} 
                style={inputStyle} 
                placeholder="Tantárgy / Beosztás..." 
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                {t.photo && <img src={t.photo} alt="" style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #2e2a45' }} />}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={el => teacherPhotoRefs.current[t.id] = el} 
                  style={{ display: 'none' }} 
                  onChange={e => handleFileUploadNested(e, url => updateTeacher(t.id, 'photo', url))} 
                />
                <button 
                  onClick={() => teacherPhotoRefs.current[t.id]?.click()} 
                  style={{ ...btn('secondary', 'sm'), flex: 1, justifyContent: 'center' }}
                >
                  <Upload size={14} /> Fotó feltöltés
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addTeacher} style={{ ...btn('primary', 'lg'), justifyContent: 'center', width: '100%', marginTop: 8 }}>
          <Plus size={18} /> Új Pedagógus Hozzáadása
        </button>
      </div>
    );
  }

  // CLASS PAGE EDITING
  if (selectedPage.type === 'class') {
    const classId = selectedPage.classId;
    const cls = (bookData.classes || []).find(c => c.id === classId);
    if (!cls) return <div style={panelStyle}>Osztály nem található</div>;

    const updateClass = (field, value) => {
      setBookData(prev => ({
        ...prev,
        classes: (prev.classes || []).map(c => c.id === classId ? { ...c, [field]: value } : c)
      }));
    };

    const addStudent = () => {
      const newStudent = { id: 's_' + Date.now(), name: '', photo: '' };
      updateClass('students', [...(cls.students || []), newStudent]);
    };

    const updateStudent = (sId, field, value) => {
      updateClass('students', (cls.students || []).map(s => s.id === sId ? { ...s, [field]: value } : s));
    };

    const removeStudent = (sId) => {
      updateClass('students', (cls.students || []).filter(s => s.id !== sId));
    };

    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>{cls.className || 'Osztály'} Szerkesztése</div>
        
        {selectedElemId && selectedElemLayout && (
          <ElementAdjusterCard
            elemId={selectedElemId}
            layout={selectedElemLayout}
            updateLayout={updateSelectedElemLayout}
            onClose={() => setSelectedElemId(null)}
            bookData={bookData}
            setBookData={setBookData}
            selectedPage={selectedPage}
          />
        )}
        
        <label style={labelStyle}>Osztály megnevezése</label>
        <input 
          value={cls.className || ''} 
          onChange={e => updateClass('className', e.target.value)} 
          style={inputStyle} 
          placeholder="pl. 1.A..." 
        />

        <label style={labelStyle}>Osztályfőnök neve</label>
        <input 
          value={cls.classTeacherName || ''} 
          onChange={e => updateClass('classTeacherName', e.target.value)} 
          style={inputStyle} 
          placeholder="Osztályfőnök neve..." 
        />

        <label style={labelStyle}>Osztályfőnök portréja</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {cls.classTeacherPhoto && <img src={cls.classTeacherPhoto} alt="" style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 4 }} />}
          <input 
            type="file" 
            accept="image/*" 
            ref={classTeacherPhotoRef} 
            style={{ display: 'none' }} 
            onChange={e => handleFileUploadNested(e, url => updateClass('classTeacherPhoto', url))} 
          />
          <button onClick={() => classTeacherPhotoRef.current?.click()} style={{ ...btn('secondary', 'md'), flex: 1, justifyContent: 'center' }}>
            <Upload size={14} /> Fotó feltöltés
          </button>
        </div>

        <label style={labelStyle}>Közös Osztálykép</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cls.groupPhoto && <img src={cls.groupPhoto} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid #2e2a45' }} />}
          <input 
            type="file" 
            accept="image/*" 
            ref={classGroupPhotoRef} 
            style={{ display: 'none' }} 
            onChange={e => handleFileUploadNested(e, url => updateClass('groupPhoto', url))} 
          />
          <button onClick={() => classGroupPhotoRef.current?.click()} style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}>
            <Upload size={14} /> Csoportkép feltöltés
          </button>
        </div>

        <Divider label="Osztály Névsor" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(cls.students || []).map((s, idx) => (
            <div key={s.id} style={{ border: '1px solid #28243d', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', background: '#131120' }}>
              <button 
                onClick={() => removeStudent(s.id)} 
                style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                title="Törlés"
              >
                <X size={14} />
              </button>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{idx + 1}. Tanuló</span>
              <input 
                value={s.name || ''} 
                onChange={e => updateStudent(s.id, 'name', e.target.value)} 
                style={inputStyle} 
                placeholder="Tanuló neve..." 
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {s.photo && <img src={s.photo} alt="" style={{ width: 28, height: 36, objectFit: 'cover', borderRadius: 3 }} />}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={el => studentPhotoRefs.current[s.id] = el} 
                  style={{ display: 'none' }} 
                  onChange={e => handleFileUploadNested(e, url => updateStudent(s.id, 'photo', url))} 
                />
                <button 
                  onClick={() => studentPhotoRefs.current[s.id]?.click()} 
                  style={{ ...btn('secondary', 'sm'), flex: 1, justifyContent: 'center' }}
                >
                  Portré feltöltés
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addStudent} style={{ ...btn('primary', 'lg'), justifyContent: 'center', width: '100%', marginTop: 8 }}>
          <Plus size={18} /> Új Tanuló Hozzáadása
        </button>
      </div>
    );
  }

  if (selectedPage.type === 'event') {
    const pageId = selectedPage.id;
    const currentHeaderText = bookData?.pageLayouts?.[pageId]?.headerText != null
      ? bookData.pageLayouts[pageId].headerText
      : '';
    const handleHeaderTextChange = (val) => {
      setBookData(prev => {
        const layouts = prev.pageLayouts || {};
        const current = layouts[pageId] || {};
        return {
          ...prev,
          pageLayouts: {
            ...layouts,
            [pageId]: { ...current, headerText: val }
          }
        };
      });
    };

    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>Esemény szerkesztése</div>

        {/* Selected Element Adjuster ha ki van jelölve elem a dián */}
        {selectedElemId && selectedElemLayout && (
          <ElementAdjusterCard
            elemId={selectedElemId}
            layout={selectedElemLayout}
            updateLayout={updateSelectedElemLayout}
            onClose={() => setSelectedElemId(null)}
            bookData={bookData}
            setBookData={setBookData}
            selectedPage={selectedPage}
            selectedEvent={selectedEvent}
          />
        )}

        {/* Fejléc és Dátum kiemelt szerkesztő doboz */}
        <div style={{ background: '#121024', border: '1.5px solid #d97706', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            📌 Oldal teteje (Fejléc egy sorban)
          </div>
          
          <label style={{ ...labelStyle, marginTop: 4, fontSize: 11 }}>Fejléc szöveg (bal oldal):</label>
          <input
            value={currentHeaderText}
            onChange={e => handleHeaderTextChange(e.target.value)}
            style={inputStyle}
            placeholder={bookData.schoolName || "Iskola neve..."}
            title="Hagyd üresen az alapértelmezett iskola névhez, vagy írj be egyedi fejlécet"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 8 }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 4, color: '#f59e0b', fontSize: 11 }}>📅 Dátum (jobb oldal):</label>
              <input
                value={selectedEvent?.date || ''}
                onChange={e => updateEventField('date', e.target.value)}
                style={{ ...inputStyle, borderColor: '#f59e0b', fontWeight: 600 }}
                placeholder="2026. június 10."
              />
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 4, fontSize: 11 }}>Tanév:</label>
              <input
                value={selectedEvent?.schoolYear || ''}
                onChange={e => updateEventField('schoolYear', e.target.value)}
                style={inputStyle}
                placeholder="2025/2026"
              />
            </div>
          </div>
        </div>

        <label style={labelStyle}>Esemény szövege</label>
        
        {/* Text Formatting Toolbar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, padding: 8,
          background: '#101025', border: '1px solid #232035', borderRadius: 8
        }}>
          <select
            value={localTextFontSize || 11}
            onChange={e => { const v = Number(e.target.value); setLocalTextFontSize(v); updateEventField('fontSize', v); }}
            style={{ ...inputStyle, padding: '6px 10px', width: 'auto', minWidth: 70 }}
            title="Betűméret"
          >
            {[9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22].map(s => (
              <option key={s} value={s}>{s} pt</option>
            ))}
          </select>

          <select
            value={localTextLineHeight || 1.7}
            onChange={e => { const v = Number(e.target.value); setLocalTextLineHeight(v); updateEventField('lineHeight', v); }}
            style={{ ...inputStyle, padding: '6px 10px', width: 'auto', minWidth: 80 }}
            title="Sorköz"
          >
            {[1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0].map(lh => (
              <option key={lh} value={lh}>{lh}</option>
            ))}
          </select>

          <div style={{ width: 1, height: 24, background: '#2e2a45', margin: '0 4px' }} />

          {/* Formázó gombok — onMouseDown+preventDefault megtartja a textarea kijelölést */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              const ta = document.querySelector('textarea[placeholder="Esemény leírása..."]');
              if (!ta) return;
              const s = ta.selectionStart, end = ta.selectionEnd;
              if (s === end) return;
              const sel = localText.substring(s, end);
              const newText = localText.substring(0, s) + `**${sel}**` + localText.substring(end);
              setLocalText(newText);
              updateEventField('text', newText);
              setTimeout(() => { ta.focus(); ta.setSelectionRange(s, end + 4); }, 0);
            }}
            style={{ ...btn('secondary', 'sm'), padding: '6px 10px', fontWeight: 900 }}
            title="Félkövér (jelöld ki a szöveget, majd kattints)"
          >B</button>
          <button
            onMouseDown={e => {
              e.preventDefault();
              const ta = document.querySelector('textarea[placeholder="Esemény leírása..."]');
              if (!ta) return;
              const s = ta.selectionStart, end = ta.selectionEnd;
              if (s === end) return;
              const sel = localText.substring(s, end);
              const newText = localText.substring(0, s) + `_${sel}_` + localText.substring(end);
              setLocalText(newText);
              updateEventField('text', newText);
              setTimeout(() => { ta.focus(); ta.setSelectionRange(s, end + 2); }, 0);
            }}
            style={{ ...btn('secondary', 'sm'), padding: '6px 10px', fontStyle: 'italic' }}
            title="Dőlt (jelöld ki a szöveget, majd kattints)"
          >I</button>

          <div style={{ width: 1, height: 24, background: '#2e2a45', margin: '0 4px' }} />

          <button
            onClick={() => handleUndo?.()}
            disabled={!canUndo}
            style={{ ...btn('secondary', 'sm'), padding: '6px 10px', opacity: canUndo ? 1 : 0.4 }}
            title="Visszavonás (Ctrl+Z)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => handleRedo?.()}
            disabled={!canRedo}
            style={{ ...btn('secondary', 'sm'), padding: '6px 10px', opacity: canRedo ? 1 : 0.4 }}
            title="Újravonás (Ctrl+Y)"
          >
            <RotateCcw size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>

          <div style={{ width: 1, height: 24, background: '#2e2a45', margin: '0 4px' }} />

          <button
            onMouseDown={e => { e.preventDefault(); setLocalText(''); updateEventField('text', ''); }}
            style={{ ...btn('secondary', 'sm'), padding: '6px 10px', color: '#f87171' }}
            title="Szöveg törlése"
          >
            <X size={12} /> Törlés
          </button>
        </div>

        <textarea
          value={localText}
          onChange={e => {
            const val = e.target.value;
            if (handleTextChange) handleTextChange(val);
            else { setLocalText(val); updateEventField('text', val); }
          }}
          style={{ ...inputStyle, minHeight: 160, resize: 'vertical', fontSize: localTextFontSize, lineHeight: localTextLineHeight, fontFamily: "'Inter', sans-serif" }}
          placeholder="Esemény leírása..."
          onKeyDown={handleTextKeyDown}
        />

        <Divider label="Képek" />
        <label style={labelStyle}>Kép elrendezés</label>
        <select
          value={selectedEvent?.imageLayout || 'auto'}
          onChange={e => updateEventField('imageLayout', e.target.value)}
          style={{ ...inputStyle, padding: '8px 10px' }}
        >
          <option value="auto">Automatikus (ajánlott)</option>
          <option value="grid">Rács (egyenletes)</option>
          <option value="hero">Fő kép + kis képek</option>
          <option value="rows">Sorok (egymás alá)</option>
          <option value="photo_wall">📸 Fotófal (egész lap képekkel)</option>
          <option value="full_page">🖼 Teljes oldalas kép (1 kép nagy)</option>
          <option value="masonry">🧱 Mozaik (változó méretű képek)</option>
        </select>

        {/* Szegély be/ki */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input
            type="checkbox"
            id="imageBorder"
            checked={selectedEvent?.imageBorder === true}
            onChange={e => updateEventField('imageBorder', e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#d97706' }}
          />
          <label htmlFor="imageBorder" style={{ ...labelStyle, marginTop: 0, cursor: 'pointer', color: '#fbbf24' }}>
            🖼 Narancssárga szegély a képeken
          </label>
        </div>

        {/* Kép zoom */}
        <label style={{ ...labelStyle, marginTop: 8 }}>
          Kép nagyítás: {selectedEvent?.imageZoom || 100}%
        </label>
        <input
          type="range" min="100" max="200" step="5"
          value={selectedEvent?.imageZoom || 100}
          onChange={e => updateEventField('imageZoom', Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>100% = normál, 150%+ = nagyított/vágott (szegély fix marad)</span>

        <label style={labelStyle}>Mutasd egyszerre</label>
        <select
          value={selectedEvent?.imageCount || Math.min((selectedEvent?.images || []).length, 4) || 1}
          onChange={e => updateEventField('imageCount', Number(e.target.value))}
          style={{ ...inputStyle, padding: '8px 10px' }}
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n} kép</option>
          ))}
        </select>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, marginBottom: 10 }}>
          {(normalizeEventImages(selectedEvent?.images || [])).map((img, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, border: '1px solid #232035', background: img.enabled ? '#101025' : '#0d111a' }}>
              <button
                onClick={() => toggleEventImageEnabled(idx)}
                style={{ width: 20, height: 20, borderRadius: 6, border: '1px solid #64748b', background: img.enabled ? '#f59e0b' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title={img.enabled ? 'Kép megjelenítése' : 'Kép elrejtése'}
              >
                {img.enabled ? <Check size={14} color="#0f172a" /> : null}
              </button>
              <img 
                src={img.thumbnail || img.url} 
                alt={`event-${idx}`} 
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={e => { e.target.onerror = null; }}
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #2e2a45' }} 
              />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Kép {idx + 1}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{img.url.split('/').pop()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => moveEventImage(idx, idx - 1)}
                  disabled={idx === 0}
                  style={{ ...btn('secondary', 'sm'), padding: '6px 8px', opacity: idx === 0 ? 0.4 : 1 }}
                  title="Mozgatás feljebb"
                >▲</button>
                <button
                  onClick={() => moveEventImage(idx, idx + 1)}
                  disabled={idx === (normalizeEventImages(selectedEvent?.images || [])).length - 1}
                  style={{ ...btn('secondary', 'sm'), padding: '6px 8px', opacity: idx === (normalizeEventImages(selectedEvent?.images || [])).length - 1 ? 0.4 : 1 }}
                  title="Mozgatás lejjebb"
                >▼</button>
              </div>
              <button
                onClick={() => removeEventImage(idx)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}
                title="Kép eltávolítása"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <input
          type="file"
          accept="image/*"
          multiple
          ref={eventImageInputRef}
          style={{ display: 'none' }}
          onChange={addEventImage}
        />
        <button
          onClick={() => eventImageInputRef.current?.click()}
          style={{ ...btn('secondary', 'md'), justifyContent: 'center', width: '100%' }}
        >
          <Upload size={16} /> Képek hozzáadása
        </button>

        <Divider label="Összevonás (2-3 cikk / lap)" />
        {(() => {
          const syEvents = sortEventsDesc((bookData.events || []).filter(e => e.schoolYear === selectedEvent?.schoolYear));
          const curIdx = syEvents.findIndex(e => e.id === selectedEvent?.id);
          const prevEvent = curIdx > 0 ? syEvents[curIdx - 1] : null;
          const nextEvent = curIdx >= 0 && curIdx < syEvents.length - 1 ? syEvents[curIdx + 1] : null;

          const groups = getMergedGroups(bookData);
          const currentGroup = groups.find(g => Array.isArray(g) && g.includes(selectedEvent?.id));

          if (currentGroup) {
            const groupEvents = currentGroup.map(id => (bookData.events || []).find(e => e.id === id)).filter(Boolean);
            const canAddNext = currentGroup.length < 3 && nextEvent && !currentGroup.includes(nextEvent.id);
            const canAddPrev = currentGroup.length < 3 && prevEvent && !currentGroup.includes(prevEvent.id);

            return (
              <div style={{ background: '#121024', border: '1.5px solid #7c3aed', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ⚡ Összevont lapon szerepel ({currentGroup.length} cikk / lap)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {groupEvents.map((ev, idx) => (
                    <div key={ev.id} style={{ fontSize: 11, color: ev.id === selectedEvent.id ? '#f59e0b' : '#cbd5e1', fontWeight: ev.id === selectedEvent.id ? 700 : 400 }}>
                      {idx + 1}. {ev.date || ev.id} {ev.id === selectedEvent.id ? '⭐ (Ez a cikk)' : ''}
                    </div>
                  ))}
                </div>

                {/* 3. cikk hozzáadása, ha még csak 2 van */}
                {canAddNext && (
                  <button
                    onClick={() => {
                      setBookData(prev => {
                        const grps = getMergedGroups(prev);
                        const updated = grps.map(g => g === currentGroup ? [...g, nextEvent.id] : g);
                        return { ...prev, mergedGroups: updated, dualPairs: updated };
                      });
                    }}
                    style={{ ...btn('secondary', 'sm'), justifyContent: 'flex-start', borderColor: '#7c3aed', color: '#c084fc', padding: '6px 10px' }}
                  >
                    ➕ 3. cikk hozzákapcsolása: {nextEvent.date}
                  </button>
                )}
                {canAddPrev && !canAddNext && (
                  <button
                    onClick={() => {
                      setBookData(prev => {
                        const grps = getMergedGroups(prev);
                        const updated = grps.map(g => g === currentGroup ? [prevEvent.id, ...g] : g);
                        return { ...prev, mergedGroups: updated, dualPairs: updated };
                      });
                    }}
                    style={{ ...btn('secondary', 'sm'), justifyContent: 'flex-start', borderColor: '#7c3aed', color: '#c084fc', padding: '6px 10px' }}
                  >
                    ➕ 3. cikk hozzákapcsolása: {prevEvent.date}
                  </button>
                )}

                <button
                  onClick={() => {
                    setBookData(prev => {
                      const grps = getMergedGroups(prev).filter(g => !g.includes(selectedEvent.id));
                      return { ...prev, mergedGroups: grps, dualPairs: grps };
                    });
                  }}
                  style={{ ...btn('danger', 'sm'), justifyContent: 'center', width: '100%', marginTop: 4 }}
                >
                  ✕ Összevonás felbontása (külön lapokra)
                </button>
              </div>
            );
          }

          // Nincs még összevonva: egyszerű 1-kattintásos gombok az előző és következő cikkhez!
          return (
            <div style={{ background: '#121024', border: '1px solid #7c3aed', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                ⚡ Gyors Összevonás (2-3 cikk / lap)
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                Kattints, ha ezt a cikket az előtte vagy utána lévővel szeretnéd egy lapra tenni:
              </div>

              {prevEvent && (
                <button
                  onClick={() => {
                    setBookData(prev => {
                      const grps = getMergedGroups(prev).filter(g => !g.includes(selectedEvent.id));
                      const prevGrp = grps.find(g => g.includes(prevEvent.id));
                      if (prevGrp && prevGrp.length < 3) {
                        const updated = grps.map(g => g === prevGrp ? [...g, selectedEvent.id] : g);
                        return { ...prev, mergedGroups: updated, dualPairs: updated };
                      }
                      const filtered = grps.filter(g => !g.includes(prevEvent.id));
                      const updated = [...filtered, [prevEvent.id, selectedEvent.id]];
                      return { ...prev, mergedGroups: updated, dualPairs: updated };
                    });
                  }}
                  style={{ ...btn('secondary', 'sm'), justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px', gap: 8 }}
                  title="Összekapcsolás az előző eseménnyel egy lapra"
                >
                  <span style={{ fontSize: 14 }}>⬆️</span>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>Összevonás az ELŐZŐ cikkel</div>
                    <div style={{ color: '#cbd5e1', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prevEvent.date} • {(prevEvent.text || '').slice(0, 35)}</div>
                  </div>
                </button>
              )}

              {nextEvent && (
                <button
                  onClick={() => {
                    setBookData(prev => {
                      const grps = getMergedGroups(prev).filter(g => !g.includes(selectedEvent.id));
                      const nextGrp = grps.find(g => g.includes(nextEvent.id));
                      if (nextGrp && nextGrp.length < 3) {
                        const updated = grps.map(g => g === nextGrp ? [selectedEvent.id, ...g] : g);
                        return { ...prev, mergedGroups: updated, dualPairs: updated };
                      }
                      const filtered = grps.filter(g => !g.includes(nextEvent.id));
                      const updated = [...filtered, [selectedEvent.id, nextEvent.id]];
                      return { ...prev, mergedGroups: updated, dualPairs: updated };
                    });
                  }}
                  style={{ ...btn('secondary', 'sm'), justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px', gap: 8 }}
                  title="Összekapcsolás a következő eseménnyel egy lapra"
                >
                  <span style={{ fontSize: 14 }}>⬇️</span>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>Összevonás a KÖVETKEZŐ cikkel</div>
                    <div style={{ color: '#cbd5e1', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextEvent.date} • {(nextEvent.text || '').slice(0, 35)}</div>
                  </div>
                </button>
              )}
            </div>
          );
        })()}

        <Divider label="Esemény kezelése" />
        <button onClick={deleteEvent} style={{ ...btn('danger', 'lg'), width: '100%', justifyContent: 'center' }}>
          <Trash2 size={16} /> Esemény törlése
        </button>
      </div>
    );
  }

  // ── DUAL / MERGED EVENT PAGE EDITING (2-3 CIKK / LAP) ─────────────────────
  if (selectedPage.type === 'dual_event') {
    const pageId = selectedPage.id;
    const eventIds = selectedPage.eventIds || [];
    const events = eventIds.map(id => (bookData.events || []).find(e => e.id === id)).filter(Boolean);
    const count = events.length;
    const is3 = count >= 3;
    const maxImgs = is3 ? 2 : 3;

    const currentHeaderText = bookData?.pageLayouts?.[pageId]?.headerText != null
      ? bookData.pageLayouts[pageId].headerText
      : '';
    const handleHeaderTextChange = (val) => {
      setBookData(prev => {
        const layouts = prev.pageLayouts || {};
        const current = layouts[pageId] || {};
        return {
          ...prev,
          pageLayouts: {
            ...layouts,
            [pageId]: { ...current, headerText: val }
          }
        };
      });
    };

    const updateSubEvent = (eventId, field, val) => {
      setBookData(prev => ({
        ...prev,
        events: (prev.events || []).map(ev => ev.id === eventId ? { ...ev, [field]: val } : ev)
      }));
    };

    const toggleSubEventImage = (eventId, imgIdx) => {
      setBookData(prev => ({
        ...prev,
        events: (prev.events || []).map(ev => {
          if (ev.id !== eventId) return ev;
          const currentImages = normalizeEventImages(ev.images || []);
          const updated = currentImages.map((img, idx) => idx === imgIdx ? { ...img, enabled: !img.enabled } : img);
          return { ...ev, images: updated };
        })
      }));
    };

    const handleUnpair = () => {
      if (!confirm(`Biztosan szétválasztod ezt a(z) ${count} eseményt külön oldalakra?`)) return;
      setBookData(prev => {
        const grps = getMergedGroups(prev).filter(g => !eventIds.some(id => g.includes(id)));
        return { ...prev, mergedGroups: grps, dualPairs: grps };
      });
    };

    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>⚡ Összevont Oldal ({count} cikk / lap)</div>

        <div style={{ background: '#121024', border: '1px solid #7c3aed', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            📌 Közös Fejléc (Iskola neve)
          </div>
          <input
            value={currentHeaderText}
            onChange={e => handleHeaderTextChange(e.target.value)}
            style={inputStyle}
            placeholder={bookData.schoolName || "Iskola neve..."}
          />
        </div>

        {events.map((ev, idx) => {
          const evImages = normalizeEventImages(ev.images || []);
          const activeCount = evImages.filter(im => im.enabled).length;

          return (
            <div key={ev.id} style={{ background: '#181528', border: '1px solid #2e2a45', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', display: 'flex', justifyContent: 'space-between' }}>
                <span>{idx + 1}. Esemény</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>ID: {ev.id.slice(-6)}</span>
              </div>

              <div>
                <label style={{ ...labelStyle, marginTop: 0, fontSize: 11 }}>Dátum</label>
                <input
                  value={ev.date || ''}
                  onChange={e => updateSubEvent(ev.id, 'date', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, marginTop: 0, fontSize: 11 }}>Szöveg</label>
                <textarea
                  value={ev.text || ''}
                  onChange={e => updateSubEvent(ev.id, 'text', e.target.value)}
                  style={{ ...inputStyle, minHeight: 65, resize: 'vertical', fontSize: 12 }}
                />
              </div>

              {/* 📸 KÉPEK KIVÁLASZTÁSA AZ ÖSSZEVONT LAPON (MAX 2-3 KÉP) */}
              {evImages.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ ...labelStyle, marginTop: 0, fontSize: 11, color: '#38bdf8' }}>
                      📸 Megjelenítendő fotók (max. {maxImgs} fér el)
                    </label>
                    <span style={{ fontSize: 10, color: activeCount > maxImgs ? '#f87171' : '#94a3b8' }}>
                      Kiválasztva: {activeCount} / {evImages.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {evImages.map((img, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => toggleSubEventImage(ev.id, imgIdx)}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          border: `2px solid ${img.enabled ? '#38bdf8' : '#334155'}`,
                          position: 'relative',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          opacity: img.enabled ? 1 : 0.45,
                        }}
                        title={img.enabled ? 'Kattints az elrejtéshez' : 'Kattints a megjelenítéshez ezen a lapon'}
                      >
                        <img
                          src={img.thumbnail || img.url}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {img.enabled && (
                          <div style={{ position: 'absolute', top: 2, right: 2, background: '#38bdf8', borderRadius: 3, padding: 1, display: 'flex' }}>
                            <Check size={11} color="#0f172a" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 3 }}>
                    * Kattints a képre a ki/bekapcsoláshoz. Az első {maxImgs} aktív kép jelenik meg a lapon.
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={handleUnpair} style={{ ...btn('secondary', 'md'), color: '#f87171', borderColor: '#7f1d1d', justifyContent: 'center', marginTop: 6 }}>
          ✕ Szétválasztás külön lapokra
        </button>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>Tulajdonságok</div>
      {selectedElemId && selectedElemLayout && (
        <ElementAdjusterCard
          elemId={selectedElemId}
          layout={selectedElemLayout}
          updateLayout={updateSelectedElemLayout}
          onClose={() => setSelectedElemId(null)}
          bookData={bookData}
          setBookData={setBookData}
        />
      )}
      <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>
        Kattints egy diára a bal oldali listában a részletek szerkesztéséhez.
      </div>
    </div>
  );
}

// ── Helper: get custom header title if set ──────────────────────────────────
export function getHeaderTitle(page, bookData, defaultTitle) {
  if (!page) return defaultTitle;
  const custom = bookData?.pageLayouts?.[page.id]?.headerText;
  if (custom !== undefined && custom !== null && custom.trim() !== '') return custom;
  return defaultTitle;
}

// ── Element Adjuster Card (Kiválasztott elem átméretező & pozícionáló) ──────
function ElementAdjusterCard({ elemId, layout, updateLayout, onClose, bookData, setBookData, selectedPage, selectedEvent }) {
  const logoInputRef = useRef();

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToLogoDataUrl(file);
    if (setBookData) setBookData(prev => ({ ...prev, schoolLogo: url, logoStyle: prev.logoStyle || 'badge' }));
  };

  const isLogo   = elemId === 'logo';
  const isHeader = elemId === 'header' || elemId === 'title';
  const pageId   = selectedPage?.id;

  const currentHeaderText = pageId && bookData?.pageLayouts?.[pageId]?.headerText != null
    ? bookData.pageLayouts[pageId].headerText
    : '';

  const handleHeaderTextChange = (val) => {
    if (!pageId || !setBookData) return;
    setBookData(prev => {
      const layouts  = prev.pageLayouts || {};
      const current  = layouts[pageId]  || {};
      return {
        ...prev,
        pageLayouts: {
          ...layouts,
          [pageId]: {
            ...current,
            headerText: val
          }
        }
      };
    });
  };

  return (
    <div style={{ background: '#161228', border: '1.5px solid #f59e0b', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sliders size={14} /> {isLogo ? '🖼 Fejléc Logó Szerkesztése' : isHeader ? '✍️ Fejléc Szöveg & Dátum' : `Elem Méretezése (${elemId})`}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {isLogo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6, borderBottom: '1px dashed #2e2a45' }}>
          <label style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>🛡️ Logó Kiemelés (Ne olvadjon be a fotóba!)</label>
          <select
            value={bookData?.logoStyle || 'badge'}
            onChange={e => setBookData && setBookData(prev => ({ ...prev, logoStyle: e.target.value }))}
            style={{ ...inputStyle, padding: '6px 8px', fontSize: 11, borderColor: '#f59e0b' }}
          >
            <option value="badge">⚪ Fehér körlap arany szegéllyel (Ajánlott)</option>
            <option value="glow">✨ Fehér fényudvar / glória</option>
            <option value="shadow">🌑 3D finom árnyék</option>
            <option value="none">◻️ Eredeti (effekt nélkül)</option>
          </select>

          <button
            onClick={() => setBookData && setBookData(prev => ({ ...prev, schoolLogo: '/school_logo.png', logoStyle: 'badge' }))}
            style={{ ...btn('secondary', 'sm'), justifyContent: 'center', width: '100%', borderColor: '#f59e0b', color: '#f59e0b' }}
            title="A feltöltött kerek Szent Mihály címer használata tiszta körbevágással és arany szegéllyel"
          >
            ✨ Levágott Szent Mihály Címer
          </button>

          <input type="file" accept="image/*" ref={logoInputRef} style={{ display: 'none' }} onChange={handleLogoUpload} />
          <div style={{ display: 'grid', gridTemplateColumns: bookData?.schoolLogo ? '1fr 1fr' : '1fr', gap: 6 }}>
            <button onClick={() => logoInputRef.current?.click()} style={{ ...btn('secondary', 'sm'), justifyContent: 'center' }}>
              <Upload size={13} /> Új Feltöltése
            </button>
            {bookData?.schoolLogo && (
              <button
                onClick={() => setBookData && setBookData(prev => ({ ...prev, schoolLogo: '' }))}
                style={{ ...btn('danger', 'sm'), justifyContent: 'center' }}
              >
                <Trash2 size={12} /> Eltávolítás
              </button>
            )}
          </div>
        </div>
      )}

      {isHeader && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8, borderBottom: '1px dashed #2e2a45' }}>
          <label style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>Fejléc Szöveg (bal oldal):</label>
          <input
            value={currentHeaderText}
            onChange={e => handleHeaderTextChange(e.target.value)}
            placeholder={bookData?.schoolName || "Iskola neve..."}
            style={inputStyle}
          />
          {selectedEvent && (
            <>
              <label style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginTop: 4 }}>📅 Fejléc Dátuma / Idő (jobb oldal):</label>
              <input
                value={selectedEvent.date || ''}
                onChange={e => {
                  const val = e.target.value;
                  setBookData(prev => ({
                    ...prev,
                    events: (prev.events || []).map(ev => ev.id === selectedEvent.id ? { ...ev, date: val } : ev)
                  }));
                }}
                placeholder="2026. május 28."
                style={{ ...inputStyle, borderColor: '#f59e0b' }}
              />
            </>
          )}
          <span style={{ fontSize: 9.5, color: '#94a3b8' }}>* A fejléc szövege és dátuma egyetlen sorban jelenik meg</span>
        </div>
      )}

      {(layout.fontSize !== undefined || isHeader) && (
        <div>
          <label style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>Betűméret: {layout.fontSize || 14}px</label>
          <input
            type="range" min="8" max="64" value={layout.fontSize || 14}
            onChange={e => updateLayout('fontSize', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <div>
        <label style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>Szélesség: {Math.round(layout.w || 50)}%</label>
        <input
          type="range" min="2" max="100" value={layout.w || 50}
          onChange={e => updateLayout('w', Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>Magasság: {Math.round(layout.h || 30)}%</label>
        <input
          type="range" min="2" max="100" value={layout.h || 30}
          onChange={e => updateLayout('h', Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 10, color: '#94a3b8' }}>X pozíció: {Math.round(layout.x || 0)}%</label>
          <input
            type="range" min="0" max="95" value={layout.x || 0}
            onChange={e => updateLayout('x', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, color: '#94a3b8' }}>Y pozíció: {Math.round(layout.y || 0)}%</label>
          <input
            type="range" min="0" max="95" value={layout.y || 0}
            onChange={e => updateLayout('y', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE CONTENT RENDERERS (GÖRÖGKATOLIKUS ISKOLA DESIGN)
// ══════════════════════════════════════════════════════════════════════════════
export function PageContent({ page, bookData, onSelectEvent, selectedEventId }) {
  if (!page) return null;
  if (page.type === 'cover')      return <CoverContent page={page} bookData={bookData} />;
  if (page.type === 'principal')  return <PrincipalContent page={page} bookData={bookData} />;
  if (page.type === 'teachers')   return <TeachersContent page={page} bookData={bookData} />;
  if (page.type === 'class') {
    const cls = (bookData.classes || []).find(c => c.id === page.classId);
    return <ClassContent page={page} classData={cls} bookData={bookData} />;
  }
  if (page.type === 'graduation') return <GradContent page={page} grad={page.data} bookData={bookData} />;
  if (page.type === 'divider')    return <DividerContent page={page} schoolYear={page.schoolYear} bookData={bookData} />;
  if (page.type === 'event') {
    const event = (bookData.events || []).find(e => e.id === page.eventId);
    return <EventContent page={page} event={event} bookData={bookData} />;
  }
  if (page.type === 'dual_event') {
    return <DualEventContent page={page} bookData={bookData} onSelectEvent={onSelectEvent} selectedEventId={selectedEventId} />;
  }
  return <div style={{ width: '100%', height: '100%', background: '#fff' }} />;
}

// ── Oldalak szöveg labelje ──────────────────────────────────────────────────
function pageTypeLabel(page, bookData) {
  if (!page) return '';
  if (page.type === 'cover')      return 'Címlap';
  if (page.type === 'principal')  return 'Lelki Útravaló & Igazgató';
  if (page.type === 'teachers')   return 'Nevelőtestület';
  if (page.type === 'class') {
    const cls = (bookData?.classes || []).find(c => c.id === page.classId);
    return cls ? `${cls.className} Osztály` : 'Osztályoldal';
  }
  if (page.type === 'graduation') return `Tabló ${page.data?.year || ''}`;
  if (page.type === 'divider')    return `Tanév: ${page.schoolYear}`;
  if (page.type === 'dual_event') {
    const ev1 = page.event1 || (bookData?.events || []).find(e => e.id === page.eventIds?.[0]);
    const ev2 = page.event2 || (bookData?.events || []).find(e => e.id === page.eventIds?.[1]);
    return `⚡ 2 cikk: ${ev1?.date || ''} & ${ev2?.date || ''}`;
  }
  if (page.type === 'event') {
    const ev = (bookData?.events || []).find(e => e.id === page.eventId);
    if (!ev) return 'Esemény';
    const preview = (ev.text || '').trim().split('\n')[0].slice(0, 30).replace(/\s+/g, ' ');
    return `${ev.date || 'Esemény'}${preview ? ` • ${preview}` : ''}`;
  }
  return '';
}

// ── 1. CÍMLAP / BORÍTÓ ──────────────────────────────────────────────────────
function CoverContent({ page, bookData }) {
  const g = [...(bookData.graduationPages || [])].sort((a, b) => b.year - a.year)[0];

  const logoBox = getElemBox(page, 'logo', bookData);
  const photoBox = getElemBox(page, 'photo', bookData);
  const titleBox = getElemBox(page, 'title', bookData);

  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #090d16 0%, #17153a 45%, #2a1147 100%)', color: '#fff', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* Byzantine Filigree Gold Border Frame */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, border: '2px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, border: '1px solid rgba(245, 158, 11, 0.25)', pointerEvents: 'none' }} />

      {/* Header Logo & School Name */}
      {!isElemHidden(page, 'logo', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: logoBox.zIndex || 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 4, boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: '100%', justifyContent: 'center' }}>
          {renderSchoolLogo(bookData, { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }, Math.min(logoBox.w * 5, logoBox.h * 7))}
        </div>
      </div>
      )}      {/* Main Cover Photo Slot */}
      <div style={{
        position: 'absolute',
        left: `${photoBox.x}%`, top: `${photoBox.y}%`, width: `${photoBox.w}%`, height: `${photoBox.h}%`,
        zIndex: photoBox.zIndex || 1,
        borderRadius: 8,
        overflow: 'hidden',
        boxSizing: 'border-box',
        isolation: 'isolate',
      }}>
        {/* Szegély overlay — legfelül, a kép FELETT látszik */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 8,
          border: '2px solid #d97706',
          boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.3), 0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none', zIndex: 10
        }} />
        {g?.image ? (
          <img src={g.image} alt="" style={{
            position: 'absolute', inset: 0,
            width: `${bookData.coverPhotoZoom || 100}%`,
            height: `${bookData.coverPhotoZoom || 100}%`,
            objectFit: 'cover',
            objectPosition: 'center',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'block',
          }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(124, 58, 237, 0.15))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ByzantineCross size={42} color="#fbbf24" />
            <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>Iskolai Évkönyv</span>
          </div>
        )}
      </div>

      {/* Title & Year Badge */}
      <div style={{
        position: 'absolute',
        left: `${titleBox.x}%`, top: `${titleBox.y}%`, width: `${titleBox.w}%`, height: `${titleBox.h}%`,
        zIndex: titleBox.zIndex || 1,
        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: `${titleBox.fontSize || 30}px`, fontWeight: 900, background: 'linear-gradient(135deg, #fef08a, #f59e0b, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.08em', lineHeight: 1 }}>
          ÉVKÖNYV
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fef3c7', background: 'rgba(217, 119, 6, 0.3)', padding: '3px 14px', borderRadius: 12, border: '1px solid #d97706', marginTop: 6, letterSpacing: '0.1em' }}>
          {bookData.currentYear - 1} / {bookData.currentYear} TANÉV
        </div>
      </div>
    </div>
  );
}

// ── 2. IGAZGATÓI KÖSZÖNTŐ & LELKI ÚTRAVALÓ ─────────────────────────────────
function PrincipalContent({ page, bookData }) {
  const headerBox = getElemBox(page, 'header', bookData);
  const logoBox   = getElemBox(page, 'logo', bookData);
  const photoBox  = getElemBox(page, 'photo', bookData);
  const quoteBox  = getElemBox(page, 'quote', bookData);
  const footerBox = getElemBox(page, 'footer', bookData);

  const titleText = getHeaderTitle(page, bookData, 'Lelki Útravaló & Igazgatói Köszöntő');

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* Header bar */}
      {!isElemHidden(page, 'header', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${headerBox.x}%`, top: `${headerBox.y}%`, width: `${headerBox.w}%`, height: `${headerBox.h}%`,
        zIndex: headerBox.zIndex || 1,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '2% 5%', display: 'flex', alignItems: 'center', gap: 10, boxSizing: 'border-box', color: '#fff', borderBottom: '3px solid #f59e0b'
      }}>
        <div style={{ marginLeft: `${Math.max(0, (logoBox.x + logoBox.w) - headerBox.x - 2)}%` }}>
          <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24' }}>{bookData.schoolName}</div>
          <div style={{ fontSize: `${headerBox.fontSize || 14}px`, fontWeight: 900, lineHeight: 1.1 }}>{titleText}</div>
        </div>
      </div>
      )}

      {/* Header Logo */}
      {!isElemHidden(page, 'logo', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: (logoBox.zIndex || 5),
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {renderSchoolLogo(bookData, {}, Math.min(logoBox.w * 3.5, logoBox.h * 5))}
      </div>
      )}

      {/* Director Photo Frame */}
      {!isElemHidden(page, 'photo', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${photoBox.x}%`, top: `${photoBox.y}%`, width: `${photoBox.w}%`, height: `${photoBox.h}%`,
        zIndex: photoBox.zIndex || 1,
        borderRadius: 8, overflow: 'hidden', border: '2px solid #d97706', background: '#fef3c7', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', boxSizing: 'border-box'
      }}>
        {bookData.principalPhoto ? <img src={bookData.principalPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#fefce8' }}>
            <ByzantineCross size={32} color="#d97706" />
            <span style={{ fontSize: 9, color: '#b45309', fontWeight: 700 }}>Parókus / Igazgató</span>
          </div>
        )}
      </div>
      )}

      {/* Quote card */}
      {!isElemHidden(page, 'quote', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${quoteBox.x}%`, top: `${quoteBox.y}%`, width: `${quoteBox.w}%`, height: `${quoteBox.h}%`,
        zIndex: quoteBox.zIndex || 1,
        padding: 10, borderLeft: '4px solid #d97706', background: 'linear-gradient(135deg, #fffcf5 0%, #fef9c3 100%)', borderRadius: '0 8px 8px 0', border: '1px solid #fef08a', borderLeftWidth: 4, overflow: 'hidden', boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: `${quoteBox.fontSize || 10.5}px`, lineHeight: 1.6, color: '#1e293b', fontStyle: 'italic', overflowY: 'auto', maxHeight: '82%', whiteSpace: 'pre-wrap' }}>
          {bookData.principalQuote || 'Az igazgatói köszöntő szövegének megadásához használd a jobb oldali panelt...'}
        </div>
        {bookData.principalName && (
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#b45309', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            {bookData.showPrincipalCross && <ByzantineCross size={12} color="#b45309" />}
            {bookData.showPrincipalCross && ' — '}
            {bookData.principalName}
          </div>
        )}
      </div>
      )}

      {/* Footer */}
      {!isElemHidden(page, 'footer', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${footerBox.x}%`, top: `${footerBox.y}%`, width: `${footerBox.w}%`, height: `${footerBox.h}%`,
        zIndex: footerBox.zIndex || 1,
        padding: '0 6%', borderTop: '1px solid #f1f5f9', fontSize: `${footerBox.fontSize || 8}px`, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
      }}>
        <span>{bookData.schoolName}</span>
        <span>„Krisztus köztünk! Van és lesz!”</span>
      </div>
      )}
    </div>
  );
}

// ── 3. NEVELŐTESTÜLET (TANÁRI KAR) ──────────────────────────────────────────
function TeachersContent({ page, bookData }) {
  const teachers = bookData.teachers || [];

  const headerBox = getElemBox(page, 'header', bookData);
  const logoBox   = getElemBox(page, 'logo', bookData);
  const teachersGridBox = getElemBox(page, 'teachersGrid', bookData);
  const footerBox = getElemBox(page, 'footer', bookData);

  const titleText = getHeaderTitle(page, bookData, 'Istenért és Gyermekekért • Nevelőtestület');

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* Header bar */}
      {!isElemHidden(page, 'header', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${headerBox.x}%`, top: `${headerBox.y}%`, width: `${headerBox.w}%`, height: `${headerBox.h}%`,
        zIndex: headerBox.zIndex || 1,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '2% 5%', display: 'flex', alignItems: 'center', gap: 10, boxSizing: 'border-box', color: '#fff', borderBottom: '3px solid #f59e0b'
      }}>
        <div style={{ marginLeft: `${Math.max(0, (logoBox.x + logoBox.w) - headerBox.x - 2)}%` }}>
          <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24' }}>{bookData.schoolName}</div>
          <div style={{ fontSize: `${headerBox.fontSize || 14}px`, fontWeight: 900, lineHeight: 1.1 }}>{titleText}</div>
        </div>
      </div>
      )}

      {/* Header Logo */}
      {!isElemHidden(page, 'logo', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: (logoBox.zIndex || 5),
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {renderSchoolLogo(bookData, {}, Math.min(logoBox.w * 3.5, logoBox.h * 5))}
      </div>
      )}

      {/* Teachers Grid */}
      {!isElemHidden(page, 'teachersGrid', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${teachersGridBox.x}%`, top: `${teachersGridBox.y}%`, width: `${teachersGridBox.w}%`, height: `${teachersGridBox.h}%`,
        zIndex: teachersGridBox.zIndex || 1,
        overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, alignContent: 'start', padding: 6, boxSizing: 'border-box'
      }}>
        {teachers.map(t => (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #fef08a', borderRadius: 8, padding: 6, background: 'linear-gradient(135deg, #fffcf5, #fefce8)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ width: '48px', height: '62px', borderRadius: '6px', background: '#fef3c7', overflow: 'hidden', border: '1.5px solid #d97706', marginBottom: '4px', flexShrink: 0 }}>
              {t.photo ? <img src={t.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ByzantineCross size={18} color="#d97706" />
                </div>
              )}
            </div>
            <div style={{ fontSize: `${teachersGridBox.fontSize || 9.5}px`, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{t.name || 'Név...'}</div>
            <div style={{ fontSize: 7.5, color: '#b45309', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{t.subject || 'Szak...'}</div>
          </div>
        ))}
      </div>
      )}

      {/* Footer */}
      {!isElemHidden(page, 'footer', bookData) && (
      <div style={{
        position: 'absolute',
        left: `${footerBox.x}%`, top: `${footerBox.y}%`, width: `${footerBox.w}%`, height: `${footerBox.h}%`,
        zIndex: footerBox.zIndex || 1,
        padding: '0 6%', borderTop: '1px solid #f1f5f9', fontSize: `${footerBox.fontSize || 8}px`, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
      }}>
        <span>{bookData.schoolName}</span>
        <span>Nevelőtestület</span>
      </div>
      )}
    </div>
  );
}

// ── 4. OSZTÁLYOLDALAK (1.A, 2.A, 3.A stb.) ───────────────────────────────────
function ClassContent({ page, classData, bookData }) {
  if (!classData) return <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', color: '#ccc' }}>Osztály nem található</div>;
  const students = classData.students || [];

  const headerBox = getElemBox(page, 'header', bookData);
  const logoBox   = getElemBox(page, 'logo', bookData);
  const teacherBox = getElemBox(page, 'teacherBox', bookData);
  const groupPhotoBox = getElemBox(page, 'groupPhotoBox', bookData);
  const studentsGridBox = getElemBox(page, 'studentsGrid', bookData);
  const footerBox = getElemBox(page, 'footer', bookData);

  const titleText = getHeaderTitle(page, bookData, `${classData.className} Osztály`);

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* Header bar */}
      <div style={{
        position: 'absolute',
        left: `${headerBox.x}%`, top: `${headerBox.y}%`, width: `${headerBox.w}%`, height: `${headerBox.h}%`,
        zIndex: headerBox.zIndex || 1,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '1.5% 4%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', color: '#fff', borderBottom: '3px solid #f59e0b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: `${Math.max(0, (logoBox.x + logoBox.w) - headerBox.x - 2)}%` }}>
          <div>
            <div style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fbbf24' }}>{bookData.schoolName}</div>
            <div style={{ fontSize: `${headerBox.fontSize || 13}px`, fontWeight: 900, lineHeight: 1.1 }}>{titleText}</div>
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fef08a', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: 4, border: '1px solid #d97706' }}>
          {classData.className?.startsWith('1') ? 'Kis Elsősök' : classData.className?.startsWith('2') ? 'Másodikosok' : 'Harmadikosok'}
        </span>
      </div>

      {/* Header Logo */}
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: (logoBox.zIndex || 5),
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {renderSchoolLogo(bookData, {}, Math.min(logoBox.w * 3.5, logoBox.h * 5))}
      </div>

      {/* Class Teacher Box */}
      <div style={{
        position: 'absolute',
        left: `${teacherBox.x}%`, top: `${teacherBox.y}%`, width: `${teacherBox.w}%`, height: `${teacherBox.h}%`,
        zIndex: teacherBox.zIndex || 1,
        border: '1.5px solid #f59e0b', borderRadius: 8, padding: 6, background: 'linear-gradient(135deg, #fffcf5, #fefce8)',
        display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ width: '36px', height: '48px', borderRadius: 5, background: '#fef3c7', overflow: 'hidden', border: '1px solid #d97706', flexShrink: 0 }}>
          {classData.classTeacherPhoto ? <img src={classData.classTeacherPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ByzantineCross size={16} color="#d97706" />
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 6.5, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Osztályfőnök</div>
          <div style={{ fontSize: `${teacherBox.fontSize || 9}px`, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{classData.classTeacherName || 'Név...'}</div>
        </div>
      </div>

      {/* Class Group Photo */}
      <div style={{
        position: 'absolute',
        left: `${groupPhotoBox.x}%`, top: `${groupPhotoBox.y}%`, width: `${groupPhotoBox.w}%`, height: `${groupPhotoBox.h}%`,
        zIndex: groupPhotoBox.zIndex || 1,
        borderRadius: 8, background: '#fefce8', overflow: 'hidden', border: '1.5px solid #d97706', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', boxSizing: 'border-box'
      }}>
        {classData.groupPhoto ? <img src={classData.groupPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <ByzantineCross size={24} color="#d97706" />
            <span style={{ fontSize: 8.5, color: '#b45309', fontWeight: 700 }}>Közös osztálykép helye</span>
          </div>
        )}
      </div>

      {/* Students Roster Grid */}
      <div style={{
        position: 'absolute',
        left: `${studentsGridBox.x}%`, top: `${studentsGridBox.y}%`, width: `${studentsGridBox.w}%`, height: `${studentsGridBox.h}%`,
        zIndex: studentsGridBox.zIndex || 1,
        overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignContent: 'start', padding: 4, boxSizing: 'border-box'
      }}>
        {students.map(s => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #fef08a', borderRadius: 6, padding: 4, background: '#fffcf5' }}>
            <div style={{ width: '36px', height: '44px', borderRadius: '4px', background: '#fef3c7', overflow: 'hidden', border: '1px solid #f59e0b', marginBottom: '3px' }}>
              {s.photo ? <img src={s.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ByzantineCross size={14} color="#f59e0b" />
                </div>
              )}
            </div>
            <div style={{ fontSize: `${studentsGridBox.fontSize || 8.5}px`, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{s.name || 'Tanuló...'}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        left: `${footerBox.x}%`, top: `${footerBox.y}%`, width: `${footerBox.w}%`, height: `${footerBox.h}%`,
        zIndex: footerBox.zIndex || 1,
        padding: '0 6%', borderTop: '1px solid #f1f5f9', fontSize: `${footerBox.fontSize || 8}px`, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
      }}>
        <span>{bookData.schoolName}</span>
        <span>{classData.className} Osztály</span>
      </div>
    </div>
  );
}

// ── 5. BALLAGÁSI TABLÓK ÉVEK SZERINT (2026, 2025, 2024...) ──────────────────
function GradContent({ page, grad, bookData }) {
  const headerBox = getElemBox(page, 'header', bookData);
  const logoBox   = getElemBox(page, 'logo', bookData);
  const photoBox  = getElemBox(page, 'photo', bookData);
  const footerBox = getElemBox(page, 'footer', bookData);

  const titleText = getHeaderTitle(page, bookData, grad.caption || `${grad.year} Ballagók Tablója`);

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* Editable Header Bar */}
      <div style={{
        position: 'absolute',
        left: `${headerBox.x}%`, top: `${headerBox.y}%`, width: `${headerBox.w}%`, height: `${headerBox.h}%`,
        zIndex: headerBox.zIndex || 1,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '2% 5%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', boxSizing: 'border-box', borderBottom: '3px solid #f59e0b'
      }}>
        <div style={{ marginLeft: `${Math.max(0, (logoBox.x + logoBox.w) - headerBox.x - 2)}%` }}>
          <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fbbf24' }}>{bookData.schoolName} • Ballagás</div>
          <div style={{ fontSize: `${headerBox.fontSize || 14}px`, fontWeight: 900, lineHeight: 1 }}>{titleText}</div>
        </div>

        <span style={{ fontSize: 12, fontWeight: 900, color: '#000', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', padding: '3px 10px', borderRadius: 6, letterSpacing: '0.05em' }}>
          {grad.year}
        </span>
      </div>

      {/* Header Logo */}
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: (logoBox.zIndex || 5),
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {renderSchoolLogo(bookData, {}, Math.min(logoBox.w * 3.5, logoBox.h * 5))}
      </div>

      {/* Resizable / Editable Tableau Image Slot */}
      <div style={{
        position: 'absolute',
        left: `${photoBox.x}%`, top: `${photoBox.y}%`, width: `${photoBox.w}%`, height: `${photoBox.h}%`,
        zIndex: photoBox.zIndex || 1,
        borderRadius: 8, overflow: 'hidden', border: '2.5px solid #d97706', background: '#fefce8', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', boxSizing: 'border-box'
      }}>
        {grad.image ? <img src={grad.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
          <div style={{ width: '100%', height: '100%', border: '2px dashed #f59e0b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fffdf5' }}>
            <ByzantineCross size={40} color="#f59e0b" />
            <span style={{ color: '#b45309', fontSize: 12, fontWeight: 800 }}>{grad.year} Ballagó Osztály Tablójának Képe</span>
            <span style={{ color: '#94a3b8', fontSize: 10 }}>Töltsd fel a képet a jobb oldali tulajdonságok panelen</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        left: `${footerBox.x}%`, top: `${footerBox.y}%`, width: `${footerBox.w}%`, height: `${footerBox.h}%`,
        zIndex: footerBox.zIndex || 1,
        padding: '0 6%', borderTop: '1px solid #f1f5f9', fontSize: `${footerBox.fontSize || 8}px`, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
      }}>
        <span>{bookData.schoolName}</span>
        <span>{grad.year} Ballagási Évkönyv Tabló</span>
      </div>
    </div>
  );
}

function DividerContent({ page, schoolYear, bookData }) {
  const logoBox = getElemBox(page, 'logo', bookData);
  const titleBox = getElemBox(page, 'title', bookData);
  const footerBox = getElemBox(page, 'footer', bookData);

  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #090d16 0%, #17153a 45%, #2a1147 100%)', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: logoBox.zIndex || 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {renderSchoolLogo(bookData, {}, 40)}
      </div>

      <div style={{
        position: 'absolute',
        left: `${titleBox.x}%`, top: `${titleBox.y}%`, width: `${titleBox.w}%`, height: `${titleBox.h}%`,
        zIndex: titleBox.zIndex || 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fbbf24', fontWeight: 800 }}>Tanév Eseményei</div>
        <div style={{ fontSize: `${titleBox.fontSize || 32}px`, fontWeight: 900, color: '#f59e0b', lineHeight: 1, marginTop: 4 }}>{schoolYear}</div>
        <div style={{ width: 44, height: 3, background: 'linear-gradient(90deg, #f59e0b, #ec4899)', borderRadius: 2, marginTop: 8 }} />
      </div>

      <div style={{
        position: 'absolute',
        left: `${footerBox.x}%`, top: `${footerBox.y}%`, width: `${footerBox.w}%`, height: `${footerBox.h}%`,
        zIndex: footerBox.zIndex || 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${footerBox.fontSize || 8}px`, opacity: 0.7, color: '#fef08a', boxSizing: 'border-box'
      }}>
        {bookData.schoolName}
      </div>
    </div>
  );
}

function EventContent({ page, event, bookData }) {
  if (!event) return <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '8pt' }}>Esemény nem található</div>;
  const visibleImages = getVisibleEventImages(event);
  const { title, body } = splitEventTitle(event.text);

  const headerBox = getElemBox(page, 'header', bookData);
  const logoBox   = getElemBox(page, 'logo', bookData);
  const imagesBox = getElemBox(page, 'images', bookData);
  const textBox   = getElemBox(page, 'text', bookData);
  const footerBox = getElemBox(page, 'footer', bookData);

  const titleText = getHeaderTitle(page, bookData, bookData.schoolName);

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{
        position: 'absolute',
        left: `${headerBox.x}%`, top: `${headerBox.y}%`, width: `${headerBox.w}%`, height: `${headerBox.h}%`,
        zIndex: headerBox.zIndex || 1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f59e0b', padding: '0 2%', boxSizing: 'border-box', background: '#fffcf5',
        overflow: 'hidden', whiteSpace: 'nowrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', marginLeft: `${Math.max(0, (logoBox.x + logoBox.w) - headerBox.x - 2)}%` }}>
          <span style={{ fontSize: `${headerBox.fontSize || 7.5}px`, fontWeight: 800, color: '#1e1b4b', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleText}</span>
        </div>
        <span style={{ fontSize: `${headerBox.fontSize || 7.5}px`, color: '#b45309', fontWeight: 700, flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap' }}>{event.date}</span>
      </div>

      {/* Header Logo */}
      <div style={{
        position: 'absolute',
        left: `${logoBox.x}%`, top: `${logoBox.y}%`, width: `${logoBox.w}%`, height: `${logoBox.h}%`,
        zIndex: (logoBox.zIndex || 5),
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {renderSchoolLogo(bookData, {}, Math.min(logoBox.w * 3.5, logoBox.h * 5))}
      </div>

      {visibleImages.length > 0 && (() => {
        const layout = event.imageLayout || 'auto';

        // PHOTO WALL — egész oldalt betölti képekkel, szöveg overlay-ként a tetején
        if (layout === 'photo_wall') {
          const cols = Math.ceil(Math.sqrt(visibleImages.length));
          const rows = Math.ceil(visibleImages.length / cols);
          return (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: 2, zIndex: 1,
            }}>
              {visibleImages.map((img, i) => (
                <div key={i} style={{ overflow: 'hidden', position: 'relative' }}>
                  <img src={img.thumbnail || img.url} alt="" referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {event.imageBorder === true && <div style={{ position: 'absolute', inset: 0, border: '2px solid #d97706', pointerEvents: 'none', zIndex: 2 }} />}
                </div>
              ))}
            </div>
          );
        }

        // FULL PAGE — egyetlen nagy kép tölti ki az egész oldalt, minimális overlay fejléc
        if (layout === 'full_page') {
          const img = visibleImages[0];
          return (
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <img src={img.thumbnail || img.url} alt="" referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {event.imageBorder === true && <div style={{ position: 'absolute', inset: 0, border: '3px solid #d97706', pointerEvents: 'none', zIndex: 2 }} />}
            </div>
          );
        }

        // MASONRY — mozaik elrendezés (különböző méretű képek)
        if (layout === 'masonry') {
          const count = visibleImages.length;
          return (
            <div style={{
              position: 'absolute',
              left: `${imagesBox.x}%`, top: `${imagesBox.y}%`, width: `${imagesBox.w}%`, height: `${imagesBox.h}%`,
              zIndex: imagesBox.zIndex || 1, overflow: 'hidden', borderRadius: 6, boxSizing: 'border-box',
            }}>
              {count === 1 && (
                <img src={visibleImages[0].thumbnail || visibleImages[0].url} alt="" referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {count === 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', height: '100%', gap: 2 }}>
                  {visibleImages.map((img, i) => (
                    <div key={i} style={{ overflow: 'hidden', position: 'relative' }}>
                      <img src={img.thumbnail || img.url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
              {count === 3 && (
                <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gridTemplateRows: '50% 50%', height: '100%', gap: 2 }}>
                  <div style={{ gridRow: '1 / 3', overflow: 'hidden' }}>
                    <img src={visibleImages[0].thumbnail || visibleImages[0].url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  {visibleImages.slice(1).map((img, i) => (
                    <div key={i} style={{ overflow: 'hidden', position: 'relative' }}>
                      <img src={img.thumbnail || img.url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
              {count >= 4 && (
                <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gridTemplateRows: '60% 40%', height: '100%', gap: 2 }}>
                  <div style={{ gridRow: '1 / 2', gridColumn: '1 / 2', overflow: 'hidden' }}>
                    <img src={visibleImages[0].thumbnail || visibleImages[0].url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ gridRow: '1 / 3', gridColumn: '2 / 3', display: 'grid', gridTemplateRows: `repeat(${Math.min(count - 1, 3)}, 1fr)`, gap: 2 }}>
                    {visibleImages.slice(1, 4).map((img, i) => (
                      <div key={i} style={{ overflow: 'hidden' }}>
                        <img src={img.thumbnail || img.url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                  {count >= 5 && (
                    <div style={{ gridRow: '2 / 3', gridColumn: '1 / 2', overflow: 'hidden' }}>
                      <img src={visibleImages[4]?.thumbnail || visibleImages[4]?.url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              )}
              {event.imageBorder === true && <div style={{ position: 'absolute', inset: 0, borderRadius: 6, border: '2px solid #d97706', pointerEvents: 'none', zIndex: 2 }} />}
            </div>
          );
        }

        // DEFAULT (auto/grid/hero/rows) — existing behavior
        const imageBoxes = visibleImages.map((_, i) => getElemBox(page, `eventImg_${i}`, bookData));
        return (
          <div style={{
            position: 'absolute',
            left: `${imagesBox.x}%`, top: `${imagesBox.y}%`, width: `${imagesBox.w}%`, height: `${imagesBox.h}%`,
            zIndex: imagesBox.zIndex || 1,
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid #fef08a',
            boxSizing: 'border-box',
            background: '#f8fafc'
          }}>
            {visibleImages.map((img, i) => {
              const box = imageBoxes[i] || { x: 0, y: 0, w: 100, h: 100, zIndex: 1 };
              const relativeTop = ((box.y - imagesBox.y) * 100) / imagesBox.h;
              const relativeLeft = ((box.x - imagesBox.x) * 100) / imagesBox.w;
              const relativeWidth = (box.w * 100) / imagesBox.w;
              const relativeHeight = (box.h * 100) / imagesBox.h;
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${relativeLeft}%`, top: `${relativeTop}%`,
                  width: `${relativeWidth}%`, height: `${relativeHeight}%`,
                  overflow: 'hidden', borderRadius: 6, background: '#f1f5f9',
                  boxSizing: 'border-box', isolation: 'isolate',
                }}>
                  <img src={img.thumbnail || img.url} alt="" referrerPolicy="no-referrer" style={{
                    position: 'absolute', left: '50%', top: '50%',
                    width: `${event.imageZoom || 100}%`, height: `${event.imageZoom || 100}%`,
                    transform: 'translate(-50%,-50%)',
                    objectFit: visibleImages.length === 1 ? 'contain' : 'cover', display: 'block'
                  }} />
              {event.imageBorder === true && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 6, border: '2px solid #d97706', pointerEvents: 'none', zIndex: 2 }} />
              )}
                </div>
              );
            })}
          </div>
        );
      })()}

      <div style={{
        position: 'absolute',
        left: `${textBox.x}%`, top: `${textBox.y}%`, width: `${textBox.w}%`, height: `${textBox.h}%`,
        zIndex: textBox.zIndex || 1,
        display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', padding: 6, boxSizing: 'border-box'
      }}>
        {title && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: `${(textBox.fontSize || 10.5) + 1.5}px`, fontWeight: 800, color: '#1e1b4b', lineHeight: 1.3 }}>{title}</div>
            <div style={{ width: 46, height: 2, background: 'linear-gradient(90deg,#d97706,#f59e0b)', margin: '4px auto 0', borderRadius: 2 }} />
          </div>
        )}
        {body && (
          <div style={{
            flex: 1, minHeight: 0,
            background: 'linear-gradient(135deg,#fffcf5,#fef9c3)', borderLeft: '3px solid #d97706',
            borderRadius: '0 8px 8px 0', padding: '8px 10px',
            fontSize: event.fontSize ? `${event.fontSize}pt` : `${textBox.fontSize || 10.5}px`, lineHeight: event.lineHeight || 1.7, color: '#1e293b',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowY: 'auto',
          }}>
            {renderMarkdown(body)}
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute',
        left: `${footerBox.x}%`, top: `${footerBox.y}%`, width: `${footerBox.w}%`, height: `${footerBox.h}%`,
        zIndex: footerBox.zIndex || 1,
        fontSize: `${footerBox.fontSize || 8}px`, color: '#64748b', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
      }}>
        {bookData.schoolName} • {event.schoolYear} tanév
      </div>
    </div>
  );
}

// ── 8. KÉT VAGY HÁROM RÖVID ESEMÉNY EGY OLDALON (HELYTAKARÉKOS 2-3 CIKK / LAP) ──
function HalfEventCard({ event, bookData, onSelect, isSelected, maxImages = 3 }) {
  if (!event) return null;
  const allVisibleImgs = getVisibleEventImages(event);
  const imgs = allVisibleImgs.slice(0, maxImages);
  const { title, body } = splitEventTitle(event.text);

  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        background: '#fff',
        borderRadius: 6,
        padding: maxImages === 2 ? '2% 3%' : '2.5% 3.5%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        cursor: onSelect ? 'pointer' : 'default',
        outline: isSelected ? '2px solid #a855f7' : 'none',
        outlineOffset: -1,
      }}
    >
      {/* Fejléc dátummal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5%', borderBottom: '1px solid #fef08a', paddingBottom: '0.8%' }}>
        <span style={{ fontSize: '7.5pt', fontWeight: 800, color: '#1e1b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
          {title || event.date}
        </span>
        <span style={{ fontSize: '6.5pt', color: '#b45309', fontWeight: 700, background: '#fef3c7', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
          {event.date}
        </span>
      </div>

      {/* Törzs: Kép + Szöveg egymás mellett */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '3%', overflow: 'hidden' }}>
        {imgs.length > 0 && (
          <div style={{
            width: imgs.length === 1 ? '38%' : imgs.length === 2 ? '44%' : '48%',
            flexShrink: 0,
            borderRadius: 5,
            overflow: 'hidden',
            border: '1px solid #fef08a',
            background: '#f8fafc',
            display: 'flex',
            gap: 2,
            position: 'relative',
          }}>
            {imgs.map((img, i) => (
              <div key={i} style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
                <img
                  src={img.thumbnail || img.url}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%', height: '100%',
                    objectFit: imgs.length === 1 ? 'contain' : 'cover',
                    display: 'block',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{
          flex: 1, minHeight: 0,
          background: 'linear-gradient(135deg,#fffcf5,#fef9c3)',
          borderLeft: '3px solid #d97706',
          borderRadius: '0 6px 6px 0',
          padding: '4px 8px',
          fontSize: event.fontSize ? `${Math.max(6, event.fontSize - 1)}pt` : '7pt',
          lineHeight: event.lineHeight ? Math.min(1.45, event.lineHeight) : 1.35,
          color: '#1e293b',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}>
          {renderMarkdown(body || event.text)}
        </div>
      </div>
    </div>
  );
}

export function DualEventContent({ page, bookData, onSelectEvent, selectedEventId }) {
  const events = page.events || [page.event1, page.event2, page.event3].filter(Boolean);
  const count = events.length;
  const is3 = count >= 3;
  const maxImgs = is3 ? 2 : 3;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      padding: is3 ? '2.5% 3.5%' : '3.5% 4.5%',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Fő fejléc */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '2px solid #f59e0b', paddingBottom: '1%', marginBottom: '1.5%',
        flexShrink: 0, background: '#fffcf5', padding: '0 2% 1%',
        overflow: 'hidden', whiteSpace: 'nowrap'
      }}>
        <span style={{ fontSize: '6.5pt', fontWeight: 800, color: '#1e1b4b', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getHeaderTitle(page, bookData, bookData.schoolName)}
        </span>
        <span style={{ fontSize: '6.5pt', color: '#b45309', fontWeight: 700, flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap' }}>
          {page.schoolYear || events[0]?.schoolYear} tanév
        </span>
      </div>

      {/* Esemény kártyák arany elválasztókkal */}
      {events.map((ev, idx) => (
        <React.Fragment key={ev.id || idx}>
          {idx > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: is3 ? '0.8% 0' : '1.2% 0', flexShrink: 0 }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #f59e0b)' }} />
              <ByzantineCross size={is3 ? 10 : 12} color="#f59e0b" />
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
            </div>
          )}
          <HalfEventCard
            event={ev}
            bookData={bookData}
            onSelect={() => onSelectEvent && onSelectEvent(ev.id)}
            isSelected={selectedEventId === ev.id}
            maxImages={maxImgs}
          />
        </React.Fragment>
      ))}

      {/* Lábléc */}
      <div style={{
        fontSize: '5pt', color: '#64748b', borderTop: '1px solid #f1f5f9',
        paddingTop: '1%', marginTop: '1.2%', textAlign: 'center', flexShrink: 0
      }}>
        {bookData.schoolName} • Helytakarékos nézet ({count} cikk / lap)
      </div>
    </div>
  );
}

// ── Style Helpers & Tokens ───────────────────────────────────────────────────
function btn(type, size = 'md') {
  const isLg = size === 'lg';
  const isSm = size === 'sm';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isSm ? 6 : 8,
    padding: isSm ? '6px 12px' : isLg ? '12px 22px' : '10px 18px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: isSm ? 12 : isLg ? 14.5 : 13.5,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    userSelect: 'none',
  };
  if (type === 'primary') return {
    ...base,
    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    color: '#ffffff',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
  };
  if (type === 'accent') return {
    ...base,
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#0f172a',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
  };
  if (type === 'danger') return {
    ...base,
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  };
  return {
    ...base,
    background: '#181528',
    color: '#e2e8f0',
    borderColor: '#2e2a45',
  };
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: '#cbd5e1',
  marginTop: 6,
  display: 'block'
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #2e2a45',
  borderRadius: 8,
  fontSize: 13,
  color: '#f8fafc',
  background: '#0e0c1a',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

const panelHeaderStyle = {
  fontSize: 15,
  fontWeight: 800,
  color: '#f1f5f9',
  borderBottom: '1px solid #232035',
  paddingBottom: 10,
  marginBottom: 10,
  letterSpacing: '-0.2px'
};

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 6px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#232035' }} />
      <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#232035' }} />
    </div>
  );
}

const panelStyle = {
  width: 310,
  flexShrink: 0,
  background: '#0e0c1a',
  borderLeft: '1px solid #232035',
  overflowY: 'auto',
  padding: '18px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  height: '100%',
  boxSizing: 'border-box'
};
