import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import BookPreview from './components/BookPreview';
import PrintBook from './components/PrintBook';
import AlbumFlipbook from './components/AlbumFlipbook';
import AdminLogin from './components/AdminLogin';
import { repairBookData, STORAGE_KEY } from './utils/media';
import { isAdminLoggedIn, adminLogout } from './utils/driveSync';

// Admin által szerkesztett adat tartós mentése — külön kulcs a per-session
// STORAGE_KEY-től, hogy F5/reload után is a szerkesztett adat töltődjön be,
// nem a /book_events.json.
const ADMIN_STORAGE_KEY = 'szmc_admin_bookdata';

// ── Greek Catholic Primary School Default Data ─────────────────────────────
export const DEFAULT_BOOK = {
  schoolName: 'Szent Mihály Görögkatolikus Óvoda és Általános Iskola',
  schoolMotto: '„Hit, Szeretet, Tudás” — Krisztus köztünk! Van és lesz!  •  4254 Nyíradony, Árpád tér 10.  •  www.szentmihalyaltisk.hu',
  schoolLogo: '', // dataUrl
  currentYear: 2026,

  // Igazgatói & Lelki vezetői oldal
  principalName: 'Ft. Szabó Péter parókus, igazgató',
  principalQuote: 'Kedves Diákjaink, Nevelőink és Tisztelt Szülők!\n\nIsten bőséges áldásával zártuk ezt a tanévet. Iskolánk falai között nemcsak a tudás fája terebélyesedik ki, hanem a hit, a szeretet és az összetartó keresztény közösség gyökerei is mélyre nyúlnak.\n\n„Mindenre van erőm abban, aki engem megerősít.” (Fil 4,13)\n\nKívánom, hogy az itt megszerzett tudás és lelki útravaló kísérje növendékeinket egész életük során!',
  principalPhoto: '',

  // Nevelőtestület (Tanári kar) — az oldal csak akkor jelenik meg, ha van pedagógus
  teachers: [],

  // Osztályok — az oldalak csak akkor jelennek meg, ha hozzáadod őket (Tulajdonságok panel)
  classes: [],

  // Ballagási tablók évekre visszamenőleg (2026, 2025, 2024, 2023, 2022...)
  graduationPages: [
    { id: 'grad_2026', year: 2026, image: '', caption: '2025/2026 ballagó 8. osztályosok tablós képe' },
    { id: 'grad_2025', year: 2025, image: '', caption: '2024/2025 ballagó 8. osztályosok tablós képe' },
    { id: 'grad_2024', year: 2024, image: '', caption: '2023/2024 ballagó 8. osztályosok tablós képe' },
    { id: 'grad_2023', year: 2023, image: '', caption: '2022/2023 ballagó 8. osztályosok tablós képe' },
    { id: 'grad_2022', year: 2022, image: '', caption: '2021/2022 ballagó 8. osztályosok tablós képe' },
  ],

  // Tanévek eseményei:
  events: [],
};

function App() {
  const [viewMode, setViewMode] = useState('editor'); // 'editor' | 'preview' | 'print'
  const [isAdmin, setIsAdmin] = useState(() => isAdminLoggedIn());
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [bookData, setBookData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = repairBookData(JSON.parse(saved));
        return {
          ...DEFAULT_BOOK,
          ...parsed,
          teachers: (parsed.teachers && parsed.teachers.length > 0) ? parsed.teachers : DEFAULT_BOOK.teachers,
          classes: (parsed.classes && parsed.classes.length > 0) ? parsed.classes : DEFAULT_BOOK.classes,
          graduationPages: (parsed.graduationPages && parsed.graduationPages.length > 0) ? parsed.graduationPages : DEFAULT_BOOK.graduationPages,
        };
      }
    } catch {}
    return DEFAULT_BOOK;
  });

  useEffect(() => {
    loadFromDrive();
  }, []);

  const loadFromDrive = async () => {
    setDriveLoading(true);
    try {
      // 1) Admin mentés prioritása: ha az admin már szerkesztett és elmentette,
      //    azt töltjük be (nem a /book_events.json-t), így a változtatások F5
      //    után is megmaradnak.
      const adminSaved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (adminSaved) {
        const parsed = repairBookData(JSON.parse(adminSaved));
        setBookData(prev => ({ ...DEFAULT_BOOK, ...prev, ...parsed }));
        return;
      }
      // 2) Ha nincs admin mentés, a public/book_events.json-t töltjük be.
      const res = await fetch('/book_events.json?v=' + Date.now());
      const text = await res.text();
      if (text.trim().startsWith('[')) {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          const repaired = repairBookData({ events: data });
          setBookData(prev => ({ ...DEFAULT_BOOK, ...prev, events: repaired.events }));
        }
      }
    } catch (err) {
      console.warn('JSON betöltés sikertelen:', err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  // Persist to localStorage on every change (csak admin módban)
  useEffect(() => {
    if (!isAdmin) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookData));
      // Admin tartós mentés: F5/reload után is a szerkesztett adat töltődjön be.
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(bookData));
    } catch {}
  }, [bookData, isAdmin]);

  const handleResetDefault = () => {
    if (window.confirm('Biztosan visszaállítod az évkönyvet a Görögkatolikus Általános Iskola alapértelmezett beállításaira?')) {
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ADMIN_STORAGE_KEY); } catch {}
      setBookData(DEFAULT_BOOK);
    }
  };

  const handleResetEmpty = () => {
    if (window.confirm('Biztosan törölsz MINDEN adatot és egy teljesen új, üres projektet indítasz?')) {
      const EMPTY_BOOK = {
        schoolName: 'Új Iskola',
        schoolMotto: '',
        schoolLogo: '',
        currentYear: 2026,
        principalName: '',
        principalQuote: '',
        principalPhoto: '',
        teachers: [],
        classes: [],
        graduationPages: [],
        events: [],
        pageLayouts: {},
      };
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ADMIN_STORAGE_KEY); } catch {}
      setBookData(EMPTY_BOOK);
    }
  };

  const handlePublish = async () => {
    const pw = prompt('Admin jelszó a közzétételhez:');
    if (!pw) return;
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: bookData.events, adminPassword: pw }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Közzétéve! Commit: ${data.commit}\n\nAz oldal ~2 percen belül frissül mindenkinél.`);
      } else {
        alert('❌ Hiba: ' + data.error);
      }
    } catch (err) {
      alert('❌ Hiba: ' + err.message);
    }
  };

  return (
    <>
      {/* Drive betöltés jelző */}
      {driveLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
          padding: '8px 16px', textAlign: 'center',
          fontSize: 13, color: '#fff', fontWeight: 600,
        }}>
          ⏳ Adatok betöltése a Google Drive-ról...
        </div>
      )}
      {driveError && (
        <div style={{ display: 'none' }} />
      )}

      {/* Admin login modal */}
      {showAdminLogin && (
        <AdminLogin
          onSuccess={() => { setIsAdmin(true); setShowAdminLogin(false); }}
          onCancel={() => setShowAdminLogin(false)}
        />
      )}

      {/* Nézői mód — ha nem admin, csak preview */}
      {!isAdmin && viewMode === 'editor' && (
        <ViewerMode
          bookData={bookData}
          onAdminLogin={() => setShowAdminLogin(true)}
          onPreview={() => setViewMode('preview')}
          onAlbum={() => setViewMode('album')}
          onPrint={() => setViewMode('print')}
          driveLoading={driveLoading}
        />
      )}

      {/* Admin szerkesztő mód */}
      {isAdmin && viewMode === 'editor' && (
        <Editor
          bookData={bookData}
          setBookData={setBookData}
          setViewMode={setViewMode}
          onResetDefault={handleResetDefault}
          onResetEmpty={handleResetEmpty}
          isAdmin={isAdmin}
          onAdminLogout={() => { adminLogout(); setIsAdmin(false); }}
          onPublish={handlePublish}
        />
      )}

      {viewMode === 'preview' && (
        <BookPreview bookData={bookData} setBookData={isAdmin ? setBookData : undefined} setViewMode={setViewMode} />
      )}
      {viewMode === 'print' && (
        <PrintBook bookData={bookData} setViewMode={setViewMode} />
      )}
      {viewMode === 'album' && (
        <AlbumFlipbook bookData={bookData} setBookData={isAdmin ? setBookData : undefined} setViewMode={setViewMode} />
      )}
    </>
  );
}

export default App;

// ── Nézői mód (nem admin) ──────────────────────────────────────────────────
function ViewerMode({ bookData, onAdminLogin, onPreview, onAlbum, onPrint, driveLoading }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#090810',
      fontFamily: "'Outfit','Inter',sans-serif", color: '#e2e8f0',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #0e0c1a, #16122b, #0e0c1a)',
        borderBottom: '1px solid #232035',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, color: '#f59e0b' }}>✝</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {bookData.schoolName || 'Iskola Évkönyv'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {bookData.schoolMotto} • {bookData.currentYear}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onAlbum} style={viewerBtn('secondary')}>📖 Album</button>
          <button onClick={onPreview} style={viewerBtn('secondary')}>👁 Előnézet</button>
          <button onClick={onPrint} style={viewerBtn('secondary')}>🖨 Nyomtatás</button>
          <button onClick={onAdminLogin} style={viewerBtn('admin')}>🔐 Admin</button>
        </div>
      </div>

      {/* Tartalom */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
        {driveLoading ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, color: '#94a3b8' }}>Adatok betöltése...</div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', maxWidth: 500 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>📚</div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc', margin: '0 0 12px' }}>
                {bookData.schoolName}
              </h1>
              <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.6 }}>
                {bookData.schoolMotto}
              </p>
              <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>
                {bookData.currentYear} — Iskolai Évkönyv
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <BigBtn icon="📖" label="Lapozható Album" onClick={onAlbum} primary />
              <BigBtn icon="👁" label="Előnézet" onClick={onPreview} />
              <BigBtn icon="🖨" label="Nyomtatás / PDF" onClick={onPrint} />
            </div>

            <div style={{ fontSize: 12, color: '#334155', marginTop: 8 }}>
              Szerkesztéshez kattints az Admin gombra a jobb felső sarokban
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BigBtn({ icon, label, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      padding: '18px 32px', borderRadius: 12, border: '1px solid',
      borderColor: primary ? 'transparent' : '#2e2a45',
      background: primary ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#151126',
      color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: primary ? '0 4px 20px rgba(124,58,237,0.4)' : 'none',
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span> {label}
    </button>
  );
}

function viewerBtn(type) {
  const base = {
    padding: '8px 16px', borderRadius: 8, border: '1px solid',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  };
  if (type === 'admin') return { ...base, background: 'rgba(124,58,237,0.15)', borderColor: '#7c3aed', color: '#a78bfa' };
  return { ...base, background: '#151126', borderColor: '#2e2a45', color: '#e2e8f0' };
}
