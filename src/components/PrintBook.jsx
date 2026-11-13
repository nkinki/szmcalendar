
import React from 'react';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { getVisibleEventImages, cleanEventText, getEventImageGrid, splitEventTitle } from '../utils/media';
import { TeachersContent, ClassContent, ByzantineCross } from './BookPreview';

function getSchoolYears(events) {
  const years = [...new Set(events.map(e => e.schoolYear))];
  return years.sort((a, b) => b.localeCompare(a));
}

const monthOrder = [6, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 7];

function sortEventsDesc(events) {
  return [...events].sort((a, b) => {
    const ma = new Date(a.dateSort || '').getMonth() + 1;
    const mb = new Date(b.dateSort || '').getMonth() + 1;
    const oa = monthOrder.indexOf(ma);
    const ob = monthOrder.indexOf(mb);
    if (oa !== ob) return oa - ob;
    return (b.dateSort || '').localeCompare(a.dateSort || '');
  });
}

export default function PrintBook({ bookData, setViewMode }) {
  const doPrint = () => window.print();

  return (
    <div style={{ minHeight: '100vh', background: '#111019', color: '#fff', fontFamily: "'Inter','Arial',sans-serif" }}>
      {/* Print CSS */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print-hide { display: none !important; }
          .print-page {
            width: 210mm !important;
            min-height: 297mm !important;
            page-break-after: always !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          .print-page:last-child { page-break-after: avoid !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Navbar — nyomtatásban rejtett */}
      <div className="print-hide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: 'rgba(10,9,14,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => setViewMode('editor')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #2e2a45', background: '#151126', color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={16} /> Vissza
        </button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Nyomdai előnézet (PDF)</span>
        <button onClick={doPrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          <Printer size={16} /> Mentés PDF-ként (Ctrl+P)
        </button>
      </div>

      {/* Figyelmeztetés */}
      <div className="print-hide" style={{ maxWidth: 820, margin: '20px auto', padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 13, color: '#fbbf24' }}>
        ⚠️ Nyomtatási beállítások: <strong>Álló (Portrait)</strong>, papír: <strong>A4</strong>, margók: <strong>Nincs</strong>, kapcsold be a <strong>Háttérgrafikák</strong> opciót.
      </div>

      {/* Oldalak */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '24px 16px' }}>
        <PrintPage><CoverPagePrint bookData={bookData} /></PrintPage>
        <PrintPage><PrincipalPagePrint bookData={bookData} /></PrintPage>
        {(bookData.teachers || []).length > 0 && <PrintPage><TeachersContent bookData={bookData} /></PrintPage>}
        {(bookData.classes || []).map(cls => <PrintPage key={cls.id}><ClassContent classData={cls} bookData={bookData} /></PrintPage>)}
        {[...(bookData.graduationPages || [])].sort((a, b) => b.year - a.year).map(grad => <PrintPage key={grad.id}><GraduationPagePrint grad={grad} bookData={bookData} /></PrintPage>)}
        {getSchoolYears(bookData.events || []).map(sy => {
          const syEvents = sortEventsDesc((bookData.events || []).filter(e => e.schoolYear === sy));
          return (
            <React.Fragment key={sy}>
              <PrintPage><YearDividerPrint schoolYear={sy} bookData={bookData} /></PrintPage>
              {syEvents.map(evt => <PrintPage key={evt.id}><EventPagePrint event={evt} bookData={bookData} /></PrintPage>)}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function PrintPage({ children }) {
  return (
    <div className="print-page" style={{ width: '210mm', minHeight: '297mm', background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

// ── Print page content components ────────────────────────────────────────────

function CoverPagePrint({ bookData }) {
  const coverGrad = [...bookData.graduationPages].sort((a, b) => b.year - a.year)[0];
  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: 'linear-gradient(135deg, #1a1830 0%, #0e0c1a 100%)', color: '#fff', padding: '20mm', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4mm', marginBottom: 'auto' }}>
        {bookData.schoolLogo
          ? <img src={bookData.schoolLogo} alt="" style={{ height: '14mm', objectFit: 'contain' }} />
          : <ByzantineCross size={34} color="#fbbf24" />}
        <div style={{ fontSize: '11pt', fontWeight: 700, letterSpacing: '0.15em', opacity: 0.7, textTransform: 'uppercase' }}>{bookData.schoolName}</div>
      </div>

      {coverGrad?.image ? (
        <div style={{ flex: 1, margin: '10mm 0', borderRadius: '6mm', overflow: 'hidden', maxHeight: '130mm' }}>
          <img src={coverGrad.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div style={{ flex: 1, margin: '10mm 0', borderRadius: '6mm', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '130mm' }}>
          <span style={{ opacity: 0.4, fontSize: '10pt' }}>Ballagási fotó</span>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 'auto' }}>
        <div style={{ fontSize: '36pt', fontWeight: 900, color: '#a855f7', letterSpacing: '-1px', lineHeight: 1 }}>ÉVKÖNYV</div>
        <div style={{ fontSize: '16pt', fontWeight: 300, opacity: 0.7, marginTop: '3mm' }}>{bookData.currentYear - 1}/{bookData.currentYear}</div>
      </div>
    </div>
  );
}

function PrincipalPagePrint({ bookData }) {
  return (
    <div style={{ width: '210mm', minHeight: '297mm', padding: '20mm', display: 'flex', flexDirection: 'column', gap: '8mm', boxSizing: 'border-box', background: '#fff' }}>
      <div style={{ fontSize: '9pt', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7c3aed', borderBottom: '2px solid #7c3aed', paddingBottom: '3mm' }}>
        {bookData.schoolName}
      </div>
      <div style={{ display: 'flex', gap: '8mm', alignItems: 'flex-start', flex: 1 }}>
        {bookData.principalPhoto && (
          <img src={bookData.principalPhoto} alt="" style={{ width: '50mm', height: '65mm', objectFit: 'cover', borderRadius: '4mm', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20pt', fontWeight: 800, marginBottom: '6mm' }}>Igazgatói köszöntő</div>
          <div style={{ fontSize: '11pt', lineHeight: 1.9, color: '#374151', fontStyle: 'italic', borderLeft: '4px solid #7c3aed', paddingLeft: '5mm' }}>
            {bookData.principalQuote || ''}
          </div>
          {bookData.principalName && (
            <div style={{ marginTop: '8mm', fontSize: '10pt', fontWeight: 700, color: '#7c3aed' }}>— {bookData.principalName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GraduationPagePrint({ grad, bookData }) {
  return (
    <div style={{ width: '210mm', minHeight: '297mm', padding: '15mm', display: 'flex', flexDirection: 'column', gap: '6mm', boxSizing: 'border-box', background: '#fff' }}>
      <div style={{ fontSize: '9pt', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7c3aed' }}>{bookData.schoolName} • Ballagás</div>
      <div style={{ fontSize: '22pt', fontWeight: 900 }}>{grad.caption}</div>
      {grad.image ? (
        <div style={{ flex: 1, borderRadius: '4mm', overflow: 'hidden' }}>
          <img src={grad.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div style={{ flex: 1, background: '#f5f3ff', borderRadius: '4mm', border: '2px dashed #c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#a78bfa' }}>Tabló kép helye</span>
        </div>
      )}
    </div>
  );
}

function YearDividerPrint({ schoolYear, bookData }) {
  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: 'linear-gradient(135deg, #1a1830 0%, #0e0c1a 100%)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4mm', boxSizing: 'border-box' }}>
      {bookData.schoolLogo && <img src={bookData.schoolLogo} alt="" style={{ height: '18mm', objectFit: 'contain', marginBottom: '8mm', opacity: 0.8 }} />}
      <div style={{ fontSize: '11pt', letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.5 }}>Tanév</div>
      <div style={{ fontSize: '42pt', fontWeight: 900, color: '#a855f7' }}>{schoolYear}</div>
    </div>
  );
}

function EventPagePrint({ event, bookData }) {
  const imgs = getVisibleEventImages(event);
  const grid = getEventImageGrid(imgs.length);
  const { title, body } = splitEventTitle(event.text);
  return (
    <div style={{ width: '210mm', minHeight: '297mm', padding: '15mm', display: 'flex', flexDirection: 'column', gap: '6mm', boxSizing: 'border-box', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '4mm' }}>
        <div style={{ fontSize: '9pt', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{bookData.schoolName}</div>
        <div style={{ fontSize: '9pt', color: '#6b7280', fontWeight: 600 }}>{event.date}</div>
      </div>

      {/* Images — rugalmas magasság, max 120mm, de csökken ha hosszú a szöveg */}
      {imgs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: grid.hero ? '1.6fr 1fr' : `repeat(${grid.cols}, 1fr)`,
          gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
          gap: '3mm',
          maxHeight: '120mm',
          borderRadius: '4mm',
          overflow: 'hidden',
          flexShrink: 1,
          background: grid.single ? '#f3f4f6' : 'transparent',
        }}>
          {imgs.map((img, idx) => (
            <div key={idx} style={{ gridRow: grid.hero && idx === 0 ? 'span 2' : 'auto', overflow: 'hidden', background: '#f3f4f6', minHeight: 0 }}>
              <img src={img.thumbnail || img.url} referrerPolicy="no-referrer" alt="" style={{ width: '100%', height: '100%', objectFit: grid.single ? 'contain' : 'cover' }} />
            </div>
          ))}
        </div>
      )}

      {/* Text — kiemelt cím + halvány dekoratív blokk, rugalmas, görgethető ha kell */}
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4mm', overflow: 'auto' }}>
        {title && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '14pt', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.3 }}>{title}</div>
            <div style={{ width: '30mm', height: '0.8mm', background: 'linear-gradient(90deg,#d97706,#f59e0b)', margin: '2mm auto 0', borderRadius: '1mm' }} />
          </div>
        )}
        {body && (
          <div style={{
            background: 'linear-gradient(135deg,#fffcf5,#fef9c3)', borderLeft: '1.2mm solid #d97706',
            borderRadius: '0 3mm 3mm 0', padding: '5mm 6mm', fontSize: '11pt', lineHeight: 1.9,
            color: '#1e293b', whiteSpace: 'pre-wrap', overflow: 'hidden',
          }}>
            {body}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: '8pt', color: '#d1d5db', borderTop: '1px solid #f3f4f6', paddingTop: '3mm', textAlign: 'center' }}>
        {bookData.schoolName} • {event.schoolYear} tanév
      </div>
    </div>
  );
}
