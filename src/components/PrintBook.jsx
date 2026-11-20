import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Printer, Layers } from 'lucide-react';
import { buildPages, PageContent } from './Editor';
import { CustomElementsOverlay } from './BookPreview';

// ── A szerkesztő UGYANILYEN 500×706px vásznat használ ──
// Nyomtatásnál ezt scale()-lel 210mm × 297mm-re kell nagyítani
// 210mm @ 96dpi = 793.7px → scale = 793.7/500 ≈ 1.5874
const CANVAS_W = 500;
const CANVAS_H = 706;

export default function PrintBook({ bookData, setBookData, setViewMode }) {
  const [printTriggered, setPrintTriggered] = useState(false);
  const pages = buildPages(bookData);

  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(pages.length);

  // Lila gomb: várunk 1mp-et hogy React teljesen rendereljen, aztán print
  useEffect(() => {
    if (!printTriggered) return;
    const t = setTimeout(() => {
      window.print();
      setPrintTriggered(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [printTriggered]);

  const doPrint = () => setPrintTriggered(true);

  // Kiszámoljuk a ténylegesen nyomtatandó oldalakat
  const validFrom = Math.max(1, Math.min(fromPage || 1, pages.length));
  const validTo = Math.max(validFrom, Math.min(toPage || pages.length, pages.length));
  const visiblePages = pages.slice(validFrom - 1, validTo);

  // Gyors 50 oldalas blokkok generálása (ha több mint 50 oldal van)
  const batches = [];
  if (pages.length > 50) {
    for (let i = 1; i <= pages.length; i += 50) {
      batches.push({ from: i, to: Math.min(pages.length, i + 49) });
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0e17',
      color: '#fff',
      fontFamily: "'Inter','Arial',sans-serif",
    }}>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Navigáció és útmutató elrejtése */
          .print-hide {
            display: none !important;
          }

          /* Oldalak konténere */
          .print-container {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }

          /* Minden oldal: pontosan A4 méret */
          .print-page-outer {
            display: block !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            position: relative !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Belső 500×706px vászon → scale A4-re */
          .print-page-canvas {
            width: 500px !important;
            height: 706px !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            transform-origin: top left !important;
            /* 210mm = 793.7px @ 96dpi → 793.7/500 = 1.5874 */
            transform: scale(1.5874) !important;
            overflow: hidden !important;
            background: white !important;
          }

          /* Utolsó oldal nincs tördelve */
          .print-page-outer:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }

        /* Képernyőn: oldalak mutatása */
        .print-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          padding: 24px 16px 48px;
        }

        .print-page-outer {
          position: relative;
          width: ${CANVAS_W}px;
          height: ${CANVAS_H}px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          border-radius: 4px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .print-page-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: ${CANVAS_W}px;
          height: ${CANVAS_H}px;
          overflow: hidden;
        }
      `}</style>

      {/* ── Navbar (nyomtatásban rejtett) ── */}
      <div className="print-hide" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60,
        background: 'rgba(15,14,23,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => setViewMode('editor')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #2e2a45', background: '#151126', color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Vissza a szerkesztőhöz
        </button>

        <span style={{ fontSize: 15, fontWeight: 700 }}>
          {bookData.schoolName} – Nyomdai nézet ({visiblePages.length} / {pages.length} oldal)
        </span>

        <button
          onClick={doPrint}
          disabled={printTriggered}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: printTriggered ? '#4c1d95' : 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', cursor: printTriggered ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}
        >
          <Printer size={16} /> {printTriggered ? 'Előkészítés...' : `Mentés PDF (${visiblePages.length} oldal)`}
        </button>
      </div>

      {/* ── Oldaltartomány választó sáv (nyomtatásban rejtett) ── */}
      <div className="print-hide" style={{ maxWidth: 840, margin: '14px auto 0', padding: '12px 18px', background: 'rgba(21,17,38,0.95)', border: '1px solid #2e2a45', borderRadius: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <Layers size={16} style={{ color: '#a78bfa' }} />
          <span style={{ fontWeight: 600 }}>Nyomtatandó oldalak:</span>
          <input
            type="number"
            min={1}
            max={pages.length}
            value={fromPage}
            onChange={e => setFromPage(Math.max(1, Math.min(Number(e.target.value) || 1, pages.length)))}
            style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #4338ca', background: '#0f0e17', color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 700 }}
          />
          <span>–</span>
          <input
            type="number"
            min={fromPage}
            max={pages.length}
            value={toPage}
            onChange={e => setToPage(Math.max(fromPage, Math.min(Number(e.target.value) || pages.length, pages.length)))}
            style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #4338ca', background: '#0f0e17', color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 700 }}
          />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>({visiblePages.length} lap kiválasztva)</span>
        </div>

        {/* Gyors gombok */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setFromPage(1); setToPage(pages.length); }}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #4338ca', background: (validFrom === 1 && validTo === pages.length) ? '#7c3aed' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            Összes ({pages.length})
          </button>
          {batches.map(b => {
            const isActive = validFrom === b.from && validTo === b.to;
            return (
              <button
                key={`${b.from}-${b.to}`}
                onClick={() => { setFromPage(b.from); setToPage(b.to); }}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #3730a3', background: isActive ? '#7c3aed' : 'rgba(255,255,255,0.03)', color: isActive ? '#fff' : '#c7d2fe', cursor: 'pointer', fontSize: 11, fontWeight: isActive ? 700 : 500 }}
              >
                {b.from}–{b.to}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PDF útmutató (nyomtatásban rejtett) ── */}
      <div className="print-hide" style={{ maxWidth: 840, margin: '12px auto 0', padding: '16px 20px', background: 'rgba(15,14,23,0.95)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 12, fontSize: 13, color: '#e2e8f0' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#a78bfa' }}>
          📋 PDF mentés / Nyomtatás – pontosan így csináld:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { n: '1', title: 'Nyomj Ctrl+P-t', desc: 'vagy kattints a lila "Mentés PDF" gombra fent jobbra' },
            { n: '2', title: 'Papírméret: A4', desc: 'Ellenőrizd hogy A4 van kiválasztva (ne Letter vagy más!)' },
            { n: '3', title: 'Tájolás: Álló', desc: 'Portrait / Álló legyen – NEM fekvő (Landscape)' },
            { n: '4', title: 'Margók: Nincs', desc: 'Margins → None / Nincs – ez nagyon fontos, különben levágja!' },
            { n: '5', title: 'Háttérgrafikák: BE', desc: '"Background graphics" legyen kipipálva – különben fehér a háttér!' },
            { n: '6', title: 'Mentés PDF-ként', desc: 'Célnyomtató: "Mentés PDF-be" / "Save as PDF" → Mentés' },
          ].map(s => (
            <div key={s.n} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                <strong style={{ color: '#c4b5fd' }}>{s.title}</strong>
              </div>
              <div style={{ color: '#94a3b8', paddingLeft: 28, fontSize: 12 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#86efac', fontSize: 12 }}>
          💡 <strong>Tipp nagy könyveknél ({pages.length} oldal):</strong> Használd a fenti 50 oldalas gyorsgombokat (pl. 1–50, 51–100)! Így a böngésző 2 másodperc alatt elkészíti a PDF-et, és nem fagy le.
        </div>
      </div>

      {/* ── Oldalak listája ── */}
      <div className="print-container">
        {visiblePages.map((page, idx) => (
          <PrintPage key={page.id || idx} page={page} bookData={bookData} />
        ))}
      </div>
    </div>
  );
}

// ── Egy A4-es oldal: 500×706px belső canvas (= szerkesztő vászon mérete) ──
function PrintPage({ page, bookData }) {
  return (
    <div className="print-page-outer">
      <div className="print-page-canvas">
        <PageContent page={page} bookData={bookData} />
        <CustomElementsOverlay page={page} bookData={bookData} />
      </div>
    </div>
  );
}
