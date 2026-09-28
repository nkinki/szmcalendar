import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Sparkles, 
  BookOpen, 
  Printer 
} from 'lucide-react';
import { 
  HUNGARIAN_MONTHS, 
  HUNGARIAN_DAYS_SHORT, 
  getDaysInMonth, 
  getFirstDayOfMonth, 
  getNameDay, 
  getHoliday 
} from '../utils/hungarianCalendar';

export default function Flipbook({ calendarData, setViewMode }) {
  const { year, months } = calendarData;
  const [currentSheet, setCurrentSheet] = useState(0); // 0 = Cover, 1 = Jan, 2 = Feb... 12 = Dec, 13 = Back Cover

  // 12 months + 1 cover + 1 back cover = 14 sheets total
  const totalSheets = 13; // Sheets index 0 to 12

  const nextSheet = () => {
    if (currentSheet < totalSheets) {
      setCurrentSheet(currentSheet + 1);
    }
  };

  const prevSheet = () => {
    if (currentSheet > 0) {
      setCurrentSheet(currentSheet - 1);
    }
  };

  // Helper to render the collage
  const renderCollage = (images, layout) => {
    if (images.length === 0) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-8">
          <Sparkles size={32} className="text-gray-300 mb-2" />
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

  // Render a Calendar Grid for a given month index (0-11)
  const renderCalendarGrid = (mIdx) => {
    const mData = months[mIdx];
    const daysInMonth = getDaysInMonth(year, mIdx + 1);
    const firstDayOffset = getFirstDayOfMonth(year, mIdx + 1);

    return (
      <div className="calendar-page-layout">
        <div className="calendar-month-title-container">
          <h2 className="calendar-month-title">{HUNGARIAN_MONTHS[mIdx]}</h2>
          <span className="calendar-year-title">{year}</span>
        </div>

        <div className="calendar-days-grid">
          {HUNGARIAN_DAYS_SHORT.map((dayName, idx) => (
            <div key={idx} className="day-name-header">
              {dayName}
            </div>
          ))}

          {/* Spacers */}
          {Array.from({ length: firstDayOffset }).map((_, idx) => (
            <div key={`offset-${idx}`} className="calendar-cell other-month"></div>
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
                className={`calendar-cell ${isWeekend ? 'weekend' : ''}`}
              >
                <div className="cell-number-row">
                  <span className="cell-day-number">{day}</span>
                  <span className="cell-name-day" title={nameDay}>{nameDay}</span>
                </div>

                {holiday && (
                  <div className="cell-event-indicator holiday" title={holiday}>
                    {holiday}
                  </div>
                )}

                {customEvent && (
                  <div 
                    className={`cell-event-indicator ${customEvent.isHoliday ? 'holiday' : ''}`} 
                    title={customEvent.text}
                  >
                    {customEvent.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a090e] items-center justify-between p-6">
      {/* Top Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <button 
          onClick={() => setViewMode('editor')} 
          className="btn btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Vissza a Szerkesztőbe
        </button>

        <h1 className="text-xl font-bold text-white font-heading m-0 flex items-center gap-2">
          <BookOpen className="text-purple-500" /> Digitális Kalendárium (3D Lapozható)
        </h1>

        <button 
          onClick={() => window.print()} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Printer size={16} /> Nyomtatás / PDF mentés
        </button>
      </div>

      {/* 3D Flipbook Core Canvas */}
      <div className="flipbook-container flex-grow">
        <div className="book">
          {/* Central spine line */}
          <div className="book-spine-shadow" />

          {/* ========================================================
              SHEET 0: FRONT = COVER, BACK = JAN LEFT (PHOTO)
              ======================================================== */}
          <div className={`page page-right ${currentSheet > 0 ? 'flipped' : ''}`} style={{ zIndex: 13 }}>
            {/* Front Face: Book Cover */}
            <div className="page-face page-front bg-gradient-to-br from-[#1d1b26] to-[#0e0c14] border-l-4 border-purple-500 flex flex-col justify-between p-12 text-white shadow-2xl">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase tracking-widest text-purple-400 font-bold">Iskolai Emlékkönyv</span>
                <span className="text-lg font-bold text-gray-300">{year}</span>
              </div>
              
              <div className="my-auto text-center flex flex-col gap-4">
                <h1 className="text-5xl font-black font-heading leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
                  ISKOLAI<br />KALENDÁRIUM
                </h1>
                <div className="w-20 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded" />
                <p className="text-sm text-gray-400 max-w-sm mx-auto font-light leading-relaxed">
                  Az elmúlt tanév legszebb pillanatai, közös eseményei és emlékei Facebook bejegyzéseink alapján.
                </p>
              </div>

              <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-white/5 pt-6">
                <span>DIGITÁLIS & NYOMDAI KIADÁS</span>
                <span>LAPOZZ A FOLYTATÁSHOZ</span>
              </div>
            </div>
            
            {/* Back Face: Jan Left Page (Photo) */}
            <div className="page-face page-back bg-white p-8">
              <div className="w-full h-full flex flex-col justify-between">
                <div className="photo-area h-full">
                  {renderCollage(months[0].images, months[0].layout)}
                  {months[0].caption && (
                    <div className="photo-caption">{months[0].caption}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              SHEETS 1 to 11: MONTH SPREADS
              Sheet index:
                Sheet 1: Front = Jan Calendar (Right Page), Back = Feb Photo (Left Page)
                Sheet 2: Front = Feb Calendar (Right Page), Back = Mar Photo (Left Page)
                ...
                Sheet 11: Front = Nov Calendar (Right Page), Back = Dec Photo (Left Page)
              ======================================================== */}
          {Array.from({ length: 11 }).map((_, idx) => {
            const sheetIdx = idx + 1; // 1 to 11
            const leftMonthIdx = sheetIdx; // Month index for Back Face (Feb to Dec)
            const rightMonthIdx = sheetIdx - 1; // Month index for Front Face (Jan to Nov)

            return (
              <div 
                key={sheetIdx} 
                className={`page page-right ${currentSheet > sheetIdx ? 'flipped' : ''}`}
                style={{ zIndex: 13 - sheetIdx }}
              >
                {/* Front Face: Right page calendar grid */}
                <div className="page-face page-front bg-white p-8">
                  {renderCalendarGrid(rightMonthIdx)}
                </div>
                
                {/* Back Face: Left page photo layout */}
                <div className="page-face page-back bg-white p-8">
                  <div className="w-full h-full flex flex-col justify-between">
                    <div className="photo-area h-full">
                      {renderCollage(months[leftMonthIdx].images, months[leftMonthIdx].layout)}
                      {months[leftMonthIdx].caption && (
                        <div className="photo-caption">{months[leftMonthIdx].caption}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ========================================================
              SHEET 12: FRONT = DEC CALENDAR, BACK = BACK COVER
              ======================================================== */}
          <div className={`page page-right ${currentSheet > 12 ? 'flipped' : ''}`} style={{ zIndex: 1 }}>
            {/* Front Face: Dec Calendar */}
            <div className="page-face page-front bg-white p-8">
              {renderCalendarGrid(11)}
            </div>

            {/* Back Face: Book Back Cover */}
            <div className="page-face page-back bg-gradient-to-br from-[#0e0c14] to-[#1d1b26] border-r-4 border-purple-500 flex flex-col justify-between p-12 text-white shadow-2xl">
              <div className="text-right">
                <span className="text-xs uppercase tracking-widest text-purple-400 font-bold">Befejezés</span>
              </div>

              <div className="my-auto text-center flex flex-col gap-4">
                <Sparkles className="text-purple-400 mx-auto mb-2" size={32} />
                <h2 className="text-2xl font-bold font-heading">KÖSZÖNJÜK!</h2>
                <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                  Köszönjük minden diáknak, szülőnek és tanárnak, aki hozzájárult a tanév sikereihez és megörökítette a legszebb pillanatokat.
                </p>
                <div className="text-[11px] text-gray-500 mt-6 leading-relaxed">
                  Készült a Facebook oldal posztjaiból.<br />
                  Nyomdai változat elérhető PDF exportként.
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-600 border-t border-white/5 pt-6">
                © {year} Minden Jog Fenntartva
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Controls / Navigation */}
      <div className="flex flex-col items-center gap-2 mt-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={prevSheet} 
            disabled={currentSheet === 0}
            className={`btn btn-secondary p-3 rounded-full ${currentSheet === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
            title="Előző oldal"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-sm font-semibold text-gray-400">
            {currentSheet === 0 ? 'Borító' : currentSheet === totalSheets ? 'Hátlap' : `${currentSheet}. lap`}
          </span>

          <button 
            onClick={nextSheet} 
            disabled={currentSheet === totalSheets}
            className={`btn btn-secondary p-3 rounded-full ${currentSheet === totalSheets ? 'opacity-30 cursor-not-allowed' : ''}`}
            title="Következő oldal"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <p className="text-[11px] text-gray-500">
          Tipp: Használd a nyilakat a könyv lapozásához.
        </p>
      </div>
    </div>
  );
}
