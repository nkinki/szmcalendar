import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import BookPreview from './components/BookPreview';
import PrintBook from './components/PrintBook';
import AlbumFlipbook from './components/AlbumFlipbook';
import { repairBookData, STORAGE_KEY } from './utils/media';

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
  const [bookData, setBookData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = repairBookData(JSON.parse(saved));
        // Migrate data by merging with default arrays if they are missing
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

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookData)); } catch {}
  }, [bookData]);

  const handleResetDefault = () => {
    if (window.confirm('Biztosan visszaállítod az évkönyvet a Görögkatolikus Általános Iskola alapértelmezett beállításaira?')) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setBookData(EMPTY_BOOK);
    }
  };

  return (
    <>
      {viewMode === 'editor' && (
        <Editor 
          bookData={bookData} 
          setBookData={setBookData} 
          setViewMode={setViewMode} 
          onResetDefault={handleResetDefault}
          onResetEmpty={handleResetEmpty}
        />
      )}
      {viewMode === 'preview' && (
        <BookPreview bookData={bookData} setBookData={setBookData} setViewMode={setViewMode} />
      )}
      {viewMode === 'print' && (
        <PrintBook bookData={bookData} setViewMode={setViewMode} />
      )}
      {viewMode === 'album' && (
        <AlbumFlipbook bookData={bookData} setBookData={setBookData} setViewMode={setViewMode} />
      )}
    </>
  );
}

export default App;
