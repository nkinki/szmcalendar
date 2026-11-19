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
        </div>
        <button onClick={doPrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
          <Printer size={16} /> Mentés PDF / Nyomtatás (Ctrl+P)
        </button>
      </div>

      {/* Lépésről lépésre PDF útmutató */}
      <div className="print-hide" style={{ maxWidth: 840, margin: '16px auto 0', padding: '16px 20px', background: 'rgba(15,14,23,0.95)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 12, fontSize: 13, color: '#e2e8f0' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#a78bfa' }}>
          📋 PDF mentés / Nyomtatás — pontosan így csináld:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { n: '1', icon: '🖨️', title: 'Nyomj Ctrl+P-t', desc: 'vagy kattints a lila "Mentés PDF" gombra fent jobbra' },
            { n: '2', icon: '📄', title: 'Papírméret: A4', desc: 'Ellenőrizd hogy A4 van kiválasztva (ne Letter vagy más!)' },
            { n: '3', icon: '↕️', title: 'Tájolás: Álló', desc: 'Portrait / Álló legyen — NEM fekvő (Landscape)' },
            { n: '4', icon: '✂️', title: 'Margók: Nincs', desc: 'Margins → None / Nincs — ez nagyon fontos, különben levágja!' },
            { n: '5', icon: '🎨', title: 'Háttérgrafikák: BE', desc: '"Background graphics" legyen kipipálva — különben fehér lesz a háttér!' },
            { n: '6', icon: '💾', title: 'Mentés PDF-ként', desc: 'Célnyomtató: "Mentés PDF-be" / "Save as PDF" → Mentés' },
          ].map(s => (
            <div key={s.n} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <strong style={{ color: '#c4b5fd' }}>{s.title}</strong>
              </div>
              <div style={{ color: '#94a3b8', paddingLeft: 28, fontSize: 12 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#86efac', fontSize: 12 }}>
          ✅ Az oldalak mérete <strong>pontosan A4 (210×297mm)</strong> van beállítva a kódban — ha a fenti 6 lépést követed, a PDF/nyomtatás tökéletes lesz. Nem kell méreteket kézzel beállítani.
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
      {/* Oldaltartalom — 100%-ban megegyezik a szerkesztővel */}
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <PageContent page={page} bookData={bookData} />
        <CustomElementsOverlay page={page} bookData={bookData} />
      </div>
    </div>
  );
}
