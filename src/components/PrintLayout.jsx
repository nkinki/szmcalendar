import React from 'react';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { 
  HUNGARIAN_MONTHS, 
  HUNGARIAN_DAYS_SHORT, 
  getDaysInMonth, 
  getFirstDayOfMonth, 
  getNameDay, 
  getHoliday 
} from '../utils/hungarianCalendar';

export default function PrintLayout({ calendarData, setViewMode }) {
  const { year, months } = calendarData;

  const handlePrint = () => {
    window.print();
  };

  const renderCollage = (images, layout) => {
    if (images.length === 0) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400 p-8 border border-dashed border-gray-300 rounded-lg">
          <span className="text-xs">Nincs kép kiválasztva ehhez a hónaphoz</span>
        </div>
      );
    }

    const gridClass = `collage-grid-${layout}`;
    return (
      <div className={`${gridClass} w-full h-full`}>
        {images.map((img, idx) => (
          <img key={idx} src={img} alt="" className="w-full h-full object-cover" />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111019] text-white">
      {/* Top Navbar - Hidden on print */}
      <div className="header-bar glass sticky top-0 z-50 print:hidden">
        <button 
          onClick={() => setViewMode('editor')} 
          className="btn btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Vissza a Szerkesztőbe
        </button>

        <h1 className="text-lg font-bold text-white font-heading m-0 flex items-center gap-2">
          <Printer className="text-purple-500" /> Nyomdai Előnézet (PDF Mentés)
        </h1>

        <button 
          onClick={handlePrint} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Printer size={16} /> Mentés PDF-ként / Nyomtatás
        </button>
      </div>

      {/* Warning banner about print settings */}
      <div className="max-w-4xl mx-auto mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3 print:hidden mx-6">
        <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
        <div>
          <h4 className="text-sm font-bold text-yellow-400">Fontos nyomtatási beállítások PDF mentésnél:</h4>
          <ul className="text-xs text-gray-400 list-disc list-inside mt-1 flex flex-col gap-1">
            <li>Állítsd a tájolást <strong>Fekvő (Landscape)</strong> módra.</li>
            <li>A papírméret legyen <strong>A4</strong>.</li>
            <li>Kapcsold be a <strong>Háttérgrafikák (Background graphics)</strong> opciót, különben a képek nem fognak megjelenni.</li>
            <li>A margókat állítsd a <strong>Minimum</strong> vagy <strong>Nincs (None)</strong> értékre a vágójelek helyes megjelenéséhez.</li>
          </ul>
        </div>
      </div>

      {/* Screen Preview Container - showing A4 landscape sheets sequential */}
      <div className="flex flex-col items-center gap-8 py-10 px-4 print:p-0 print:gap-0">
        <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider print:hidden">NAPTÁRLAPOK ELŐNÉZETE</span>
        
        {months.map((mData, mIdx) => {
          const daysInMonth = getDaysInMonth(year, mIdx + 1);
          const firstDayOffset = getFirstDayOfMonth(year, mIdx + 1);

          return (
            <div 
              key={mIdx} 
              className="print-page bg-white text-black shadow-2xl rounded-lg overflow-hidden border border-gray-200 print:shadow-none print:border-none print:rounded-none relative"
              style={{ width: '297mm', height: '210mm' }}
            >
              {/* Trim Markers (Vágójelek) inside corners */}
              <div className="print-page-trim-marker-bl" />
              <div className="print-page-trim-marker-tr" />

              <div className="calendar-page-layout">
                {/* Photo collage area */}
                <div className="photo-area h-[48%] relative overflow-hidden rounded-lg">
                  {renderCollage(mData.images, mData.layout)}
                  {mData.caption && (
                    <div className="photo-caption text-xs">{mData.caption}</div>
                  )}
                </div>

                {/* Calendar Grid Area */}
                <div className="calendar-grid-section h-[48%] flex flex-col justify-between">
                  <div className="calendar-month-title-container border-b-2 border-black pb-1 mb-2 flex justify-between items-baseline">
                    <h2 className="calendar-month-title text-2xl font-black uppercase text-black">{HUNGARIAN_MONTHS[mIdx]}</h2>
                    <span className="calendar-year-title text-base font-bold text-gray-500">{year}</span>
                  </div>

                  <div className="calendar-days-grid flex-grow grid grid-cols-7 gap-1">
                    {HUNGARIAN_DAYS_SHORT.map((dayName, idx) => (
                      <div key={idx} className="day-name-header text-[10px] font-bold text-center text-gray-600">
                        {dayName}
                      </div>
                    ))}

                    {/* Empty offsets */}
                    {Array.from({ length: firstDayOffset }).map((_, idx) => (
                      <div key={`offset-${idx}`} className="calendar-cell other-month border border-gray-200 bg-gray-50 opacity-20"></div>
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const dayOfWeek = (day - 1 + firstDayOffset) % 7;
                      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
                      
                      const nameDay = getNameDay(mIdx + 1, day);
                      const holiday = getHoliday(mIdx + 1, day);
                      const customEvent = mData.events[day];

                      return (
                        <div 
                          key={day} 
                          className={`calendar-cell border border-gray-200 p-1 flex flex-col justify-between text-black rounded ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                          style={{ minHeight: '35px' }}
                        >
                          <div className="cell-number-row flex justify-between items-start">
                            <span className={`cell-day-number text-xs font-bold ${isWeekend ? 'text-rose-600' : 'text-black'}`}>{day}</span>
                            <span className="cell-name-day text-[6px] text-gray-500 scale-90 origin-top-right truncate max-w-[70%]">{nameDay}</span>
                          </div>

                          {/* Event Indicators */}
                          {holiday && (
                            <div className="text-[7px] leading-tight bg-rose-50 border-l border-rose-500 text-rose-700 px-1 py-0.5 rounded truncate font-semibold">
                              {holiday}
                            </div>
                          )}

                          {customEvent && (
                            <div className={`text-[7px] leading-tight px-1 py-0.5 rounded truncate font-medium border-l ${customEvent.isHoliday ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-purple-50 border-purple-500 text-purple-700'}`}>
                              {customEvent.text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
