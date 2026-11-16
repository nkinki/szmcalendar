import React from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { buildPages, CustomElementsOverlay } from './BookPreview';
import { PageContent } from './Editor';

export default function PrintBook({ bookData, setBookData, setViewMode }) {
  const doPrint = () => window.print();
  const pages = buildPages(bookData);

  return (
    <div style={{ minHeight: '100vh', background: '#0f0e17', color: '#fff', fontFamily: "'Inter','Arial',sans-serif" }}>
      {/* Print CSS — A4 pontos nyomtatás és háttérszínek megtartása */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            gap: 0 !important;
            background: transparent !important;
          }
          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Navbar — nyomtatásban rejtett */}
      <div className="print-hide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: 'rgba(15,14,23,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => setViewMode('editor')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #2e2a45', background: '#151126', color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={16} /> Vissza a szerkesztőhöz
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {bookData.schoolName} — Nyomdai nézet ({pages.length} oldal)
          </span>
          {setBookData && (
            <button
              onClick={() => setBookData(prev => ({ ...prev, compactEvents: !prev.compactEvents }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8,
                border: bookData.compactEvents ? '1px solid #c084fc' : '1px solid #2e2a45',
                background: bookData.compactEvents ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.06)',
                color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}
              title="Rövid posztok összevonása 2 cikk / lap formátumba"
            >
              ⚡ 2 cikk / lap {bookData.compactEvents ? '(BE)' : '(KI)'}
            </button>
          )}
        </div>
        <button onClick={doPrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
          <Printer size={16} /> Mentés PDF / Nyomtatás (Ctrl+P)
        </button>
      </div>

      {/* Nyomtatási tipp */}
      <div className="print-hide" style={{ maxWidth: 840, margin: '16px auto', padding: '12px 18px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 13, color: '#fef3c7', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <div>
          Nyomtatási beállítások a tökéletes eredményhez: <strong>Álló (Portrait)</strong> tájolás, <strong>A4</strong> papírméret, <strong>Margók: Nincs (None)</strong>, és kapcsold be a <strong>„Háttérgrafikák” (Background graphics)</strong> opciót!
        </div>
      </div>

      {/* Oldalak listája — pontosan a szerkesztő és előnézet felépítése szerint */}
      <div className="print-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '24px 16px 48px' }}>
        {pages.map((page, idx) => (
          <PrintPage key={page.id || idx} page={page} bookData={bookData} pageNumber={idx + 1} />
        ))}
      </div>
    </div>
  );
}

// ── Print page komponens: pontos 210mm x 297mm A4 arány, szerkesztett tartalommal ──
function PrintPage({ page, bookData, pageNumber }) {
  return (
    <div
      className="print-page"
      style={{
        width: '210mm',
        height: '297mm',
        minHeight: '297mm',
        maxHeight: '297mm',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Oldaltartalom — 100%-ban megegyezik a szerkesztővel (beleértve az elmozgatott elemeket és egyedi feliratokat) */}
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <PageContent page={page} bookData={bookData} />
        <CustomElementsOverlay page={page} bookData={bookData} />
      </div>
    </div>
  );
}
