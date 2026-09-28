import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Image as ImageIcon, 
  Trash2, 
  FileText, 
  Settings, 
  Layout, 
  Edit3, 
  Plus, 
  Printer, 
  BookOpen,
  Upload,
  X,
  FolderOpen,
  CheckCircle,
  Home
} from 'lucide-react';
import { 
  HUNGARIAN_MONTHS, 
  HUNGARIAN_DAYS_SHORT, 
  getDaysInMonth, 
  getFirstDayOfMonth, 
  getNameDay, 
  getHoliday 
} from '../utils/hungarianCalendar';

// LocalStorage key for persisting media library
const MEDIA_LIBRARY_KEY = 'iskoNaptar_mediaLibrary';

export default function CalendarEditor({ calendarData, setCalendarData, setViewMode, onBackToMenu }) {
  const { year, months } = calendarData;
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [mediaLibrary, setMediaLibrary] = useState([]); // [{ id, date, text, images: [dataUrl,...] }]
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDay, setEditingDay] = useState(null);
  const [cellText, setCellText] = useState('');
  const [cellIsHoliday, setCellIsHoliday] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntryText, setNewEntryText] = useState('');
  const [newEntryDate, setNewEntryDate] = useState('');
  const [newEntryImages, setNewEntryImages] = useState([]); // dataUrls
  const [editingEntryId, setEditingEntryId] = useState(null);
  const fileInputRef = useRef(null);
  const entryFileInputRef = useRef(null);

  // Load media library from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MEDIA_LIBRARY_KEY);
      if (saved) setMediaLibrary(JSON.parse(saved));
    } catch {}
  }, []);

  // Save media library to localStorage whenever it changes
  const saveMediaLibrary = (lib) => {
    setMediaLibrary(lib);
    try { localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(lib)); } catch {}
  };

  // Convert file to base64 dataURL
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Handle image files dropped or selected for new entry
  const handleEntryImages = async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const dataUrls = await Promise.all(imageFiles.map(fileToDataUrl));
    setNewEntryImages(prev => [...prev, ...dataUrls]);
  };

  // Save new/edited entry to media library
  const handleSaveEntry = () => {
    if (!newEntryText.trim() && newEntryImages.length === 0) return;
    const entry = {
      id: editingEntryId || `entry_${Date.now()}`,
      date: newEntryDate,
      text: newEntryText,
      images: newEntryImages,
    };
    const updated = editingEntryId
      ? mediaLibrary.map(e => e.id === editingEntryId ? entry : e)
      : [entry, ...mediaLibrary];
    saveMediaLibrary(updated);
    setShowAddEntry(false);
    setNewEntryText('');
    setNewEntryDate('');
    setNewEntryImages([]);
    setEditingEntryId(null);
  };

  // Delete entry from media library
  const handleDeleteEntry = (id) => {
    saveMediaLibrary(mediaLibrary.filter(e => e.id !== id));
  };

  // Open edit form for existing entry
  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setNewEntryText(entry.text);
    setNewEntryDate(entry.date);
    setNewEntryImages(entry.images);
    setShowAddEntry(true);
  };

  // Filtered entries for search
  const filteredEntries = mediaLibrary.filter(entry =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentMonthData = months[selectedMonthIndex];
  const daysInMonth = getDaysInMonth(year, selectedMonthIndex + 1);
  const firstDayOffset = getFirstDayOfMonth(year, selectedMonthIndex + 1);

  // Assign photo to the current month
  const handleAssignPhoto = (imgSrc, text) => {
    const updatedMonths = [...months];
    const month = updatedMonths[selectedMonthIndex];
    if (month.images.length < 4 && !month.images.includes(imgSrc)) {
      month.images = [...month.images, imgSrc];
      if (!month.caption && text) {
        month.caption = text.substring(0, 150) + (text.length > 150 ? '...' : '');
      }
      setCalendarData({ ...calendarData, months: updatedMonths });
    }
  };

  // Remove photo from current month
  const handleRemovePhoto = (imgIndex) => {
    const updatedMonths = [...months];
    const month = updatedMonths[selectedMonthIndex];
    month.images = month.images.filter((_, idx) => idx !== imgIndex);
    setCalendarData({ ...calendarData, months: updatedMonths });
  };

  // Change image collage layout
  const handleLayoutChange = (layoutType) => {
    const updatedMonths = [...months];
    updatedMonths[selectedMonthIndex].layout = layoutType;
    setCalendarData({ ...calendarData, months: updatedMonths });
  };

  // Edit Caption
  const handleCaptionChange = (e) => {
    const updatedMonths = [...months];
    updatedMonths[selectedMonthIndex].caption = e.target.value;
    setCalendarData({ ...calendarData, months: updatedMonths });
  };

  // Change Year
  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value, 10) || 2026;
    setCalendarData({ ...calendarData, year: newYear });
  };

  // Open Edit Day Cell dialog
  const handleOpenEditDay = (day) => {
    const currentEvent = currentMonthData.events[day] || { text: '', isHoliday: false };
    setEditingDay(day);
    setCellText(currentEvent.text);
    setCellIsHoliday(currentEvent.isHoliday);
  };

  // Save Day Cell edits
  const handleSaveDay = () => {
    const updatedMonths = [...months];
    const month = updatedMonths[selectedMonthIndex];
    
    if (cellText.trim() || cellIsHoliday) {
      month.events[editingDay] = {
        text: cellText.trim(),
        isHoliday: cellIsHoliday
      };
    } else {
      delete month.events[editingDay];
    }

    setCalendarData({ ...calendarData, months: updatedMonths });
    setEditingDay(null);
  };

  // Helper to render collage preview in editor
  const renderCollagePreview = (images, layout) => {
    if (images.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-8">
          <ImageIcon size={48} className="stroke-[1.5] text-purple-400 opacity-60" />
          <span className="text-sm font-medium">Húzz ide vagy válassz képeket a Facebook listából!</span>
        </div>
      );
    }

    const gridClass = `collage-grid-${layout}`;
    return (
      <div className={gridClass}>
        {images.map((img, idx) => (
          <div key={idx} className="relative group w-full h-full">
            <img src={img} alt="" className="w-full h-full object-cover" />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleRemovePhoto(idx);
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              title="Kép törlése"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar: Media Library */}
      <div className="sidebar glass">
        <div className="feed-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="feed-title">Média Könyvtár</h2>
              <p className="feed-subtitle">Töltsd fel a képeket a gépedről</p>
            </div>
            <button
              onClick={() => { setShowAddEntry(true); setEditingEntryId(null); setNewEntryText(''); setNewEntryDate(''); setNewEntryImages([]); }}
              className="btn btn-primary py-1.5 px-3 text-xs"
            >
              <Plus size={14} /> Új bejegyzés
            </button>
          </div>

          <div className="relative mt-3">
            <input
              type="text"
              placeholder="Keresés..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="feed-list">
          {filteredEntries.length === 0 ? (
            <div
              className={`flex flex-col items-center gap-3 p-8 text-center border-2 border-dashed rounded-2xl transition-all ${isDraggingOver ? 'border-purple-500 bg-purple-500/10' : 'border-white/10'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  const dataUrls = await Promise.all(
                    Array.from(files).filter(f => f.type.startsWith('image/')).map(fileToDataUrl)
                  );
                  if (dataUrls.length > 0) {
                    setNewEntryImages(dataUrls);
                    setShowAddEntry(true);
                  }
                }
              }}
            >
              <Upload size={32} className="text-purple-400 opacity-60" />
              <div>
                <p className="text-sm font-medium text-white">Húzz ide képeket</p>
                <p className="text-xs text-gray-500 mt-1">vagy klikk az "Új bejegyzés" gombra</p>
              </div>
            </div>
          ) : (
            filteredEntries.map(entry => (
              <div key={entry.id} className="post-card border border-white/5 bg-white/[0.02]">
                <div className="post-header flex justify-between items-center">
                  <span>{entry.date || 'Dátum nélkül'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditEntry(entry)} className="text-gray-500 hover:text-purple-400 transition-colors" title="Szerkesztés">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-500 hover:text-red-400 transition-colors" title="Törlés">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {entry.text && (
                  <p className="post-text" title={entry.text}>{entry.text}</p>
                )}

                {entry.images.length > 0 && (
                  <div className="post-images-preview">
                    {entry.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative cursor-pointer group rounded overflow-hidden"
                        onClick={() => handleAssignPhoto(img, entry.text)}
                        title="Hozzáadás a hónaphoz"
                      >
                        <img src={img} alt="" className="post-image-thumb" />
                        <div className="absolute inset-0 bg-purple-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Plus size={16} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-gray-500">{entry.images.length} kép</span>
                  {entry.text && (
                    <button
                      onClick={() => {
                        const updatedMonths = [...months];
                        updatedMonths[selectedMonthIndex].caption = entry.text;
                        setCalendarData({ ...calendarData, months: updatedMonths });
                      }}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                    >
                      <FileText size={10} /> Szöveg beillesztése
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Calendar Designer */}
      <div className="main-content">
        {/* Top bar with modes */}
        <div className="header-bar glass">
          <div className="flex items-center gap-4">
            {onBackToMenu && (
              <button 
                onClick={onBackToMenu} 
                className="btn btn-secondary flex items-center gap-2 py-1.5 px-3 text-xs" 
                title="Vissza a főmenübe"
              >
                <Home size={14} /> Főmenü
              </button>
            )}
            <div className="logo-container">
              <CalendarIcon className="text-purple-500" size={24} />
              <span className="logo-text">ISKO-NAPTÁR TERVEZŐ</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400 uppercase font-semibold">Év:</span>
              <select 
                value={year} 
                onChange={handleYearChange}
                className="bg-transparent border-none text-white text-sm font-bold focus:outline-none cursor-pointer"
              >
                <option value={2026} className="bg-[#100f1a]">2026</option>
                <option value={2027} className="bg-[#100f1a]">2027</option>
                <option value={2028} className="bg-[#100f1a]">2028</option>
              </select>
            </div>

            <button onClick={() => setViewMode('flipbook')} className="btn btn-secondary">
              <BookOpen size={16} /> Digitális Naptár (Flipbook)
            </button>
            
            <button onClick={() => setViewMode('print')} className="btn btn-primary">
              <Printer size={16} /> Nyomdai PDF Letöltés
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div className="editor-workspace">
          {/* Month Selector Tabs */}
          <div className="flex flex-wrap gap-2 justify-center max-w-4xl p-2 rounded-xl bg-white/[0.02] border border-white/5">
            {HUNGARIAN_MONTHS.map((mName, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedMonthIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  selectedMonthIndex === idx 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {mName}
              </button>
            ))}
          </div>

          {/* Month Editor Board (Visual Page Representation) */}
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-6">
            
            {/* Template & Layout Config side card */}
            <div className="md:col-span-1.5 flex flex-col gap-4">
              <div className="glass border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layout size={16} className="text-purple-400" />
                  Kollázs Elrendezés
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => handleLayoutChange(num)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs gap-2 transition-all ${
                        currentMonthData.layout === num 
                          ? 'border-purple-500 bg-purple-500/10 text-white' 
                          : 'border-white/5 hover:border-white/20 text-gray-400'
                      }`}
                    >
                      <div className="font-bold">{num} Kép</div>
                      <span className="text-[10px] text-gray-500">
                        {num === 1 ? 'Teljes oldal' : `${num} rácsos`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings size={16} className="text-purple-400" />
                  Képaláírás & Jegyzet
                </h3>
                <textarea
                  placeholder="Írd ide a hónap kiemelt leírását..."
                  value={currentMonthData.caption}
                  onChange={handleCaptionChange}
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            {/* The Visual Calendar Page */}
            <div className="md:col-span-3.5 glass-light border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden">
              <div className="calendar-page-layout">
                {/* Photo area mockup */}
                <div className={`photo-area ${currentMonthData.images.length === 0 ? 'active' : ''}`}>
                  {renderCollagePreview(currentMonthData.images, currentMonthData.layout)}
                  {currentMonthData.caption && (
                    <div className="photo-caption">
                      {currentMonthData.caption}
                    </div>
                  )}
                </div>

                {/* Calendar grid section */}
                <div className="calendar-grid-section">
                  <div className="calendar-month-title-container">
                    <h1 className="calendar-month-title">
                      {HUNGARIAN_MONTHS[selectedMonthIndex]}
                    </h1>
                    <span className="calendar-year-title">{year}</span>
                  </div>

                  <div className="calendar-days-grid">
                    {/* Day name headers */}
                    {HUNGARIAN_DAYS_SHORT.map((dayName, idx) => (
                      <div key={idx} className="day-name-header">
                        {dayName}
                      </div>
                    ))}

                    {/* Empty spacer cells for day offsets */}
                    {Array.from({ length: firstDayOffset }).map((_, idx) => (
                      <div key={`offset-${idx}`} className="calendar-cell other-month"></div>
                    ))}

                    {/* Days of the month */}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const dayOfWeek = (day - 1 + firstDayOffset) % 7; // 0 = Mon, 5 = Sat, 6 = Sun
                      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
                      
                      // Get name days and holidays
                      const nameDay = getNameDay(selectedMonthIndex + 1, day);
                      const holiday = getHoliday(selectedMonthIndex + 1, day);

                      // Get user added events
                      const customEvent = currentMonthData.events[day];

                      return (
                        <div 
                          key={day} 
                          className={`calendar-cell ${isWeekend ? 'weekend' : ''}`}
                        >
                          <div className="cell-number-row">
                            <span className="cell-day-number">{day}</span>
                            <span className="cell-name-day" title={nameDay}>{nameDay}</span>
                          </div>

                          {/* Display custom event or public holiday */}
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

                          {/* Edit cell button */}
                          <button 
                            className="edit-cell-btn" 
                            onClick={() => handleOpenEditDay(day)}
                            title="Nap szerkesztése"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add/Edit Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#151320] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderOpen size={18} className="text-purple-400" />
                {editingEntryId ? 'Bejegyzés szerkesztése' : 'Új bejegyzés hozzáadása'}
              </h3>
              <button onClick={() => { setShowAddEntry(false); setNewEntryImages([]); }} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Dátum (opcionális)</label>
              <input
                type="text"
                value={newEntryDate}
                onChange={(e) => setNewEntryDate(e.target.value)}
                placeholder="pl. 2026. március 15."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Text */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Szöveg / Leírás</label>
              <textarea
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
                placeholder="Másold be a Facebook poszt szövegét..."
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Image upload area */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Képek</label>
              <div
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${isDraggingOver ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-purple-400'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  await handleEntryImages(e.dataTransfer.files);
                }}
                onClick={() => entryFileInputRef.current?.click()}
              >
                <Upload size={24} className="text-purple-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Húzz ide képeket, vagy klikk a tallózáshoz</p>
                <p className="text-[10px] text-gray-600 mt-1">JPG, PNG, WEBP — több fájl egyszerre is</p>
                <input
                  ref={entryFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleEntryImages(e.target.files)}
                />
              </div>

              {/* Preview uploaded images */}
              {newEntryImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {newEntryImages.map((img, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setNewEntryImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <button onClick={() => { setShowAddEntry(false); setNewEntryImages([]); }} className="btn btn-secondary py-1.5 px-4">
                Mégse
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={!newEntryText.trim() && newEntryImages.length === 0}
                className="btn btn-primary py-1.5 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle size={16} /> Mentés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Day Event Modal Dialog */}
      {editingDay !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#151320] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Edit3 size={18} className="text-purple-400" />
              {HUNGARIAN_MONTHS[selectedMonthIndex]} {editingDay}. szerkesztése
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Adj hozzá egyedi iskolai eseményt (pl. kirándulás, témazáró, ünnepség) ehhez a naphoz.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Esemény leírása</label>
                <input 
                  type="text" 
                  value={cellText}
                  onChange={(e) => setCellText(e.target.value)}
                  placeholder="Pl. Iskolai kirándulás"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="isHoliday" 
                  checked={cellIsHoliday}
                  onChange={(e) => setCellIsHoliday(e.target.checked)}
                  className="w-4 h-4 bg-black/40 border border-white/10 rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="isHoliday" className="text-xs text-gray-300 font-semibold cursor-pointer">
                  Iskolai szünet / Tanítás nélküli nap (piros kiemelés)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <button 
                onClick={() => setEditingDay(null)} 
                className="btn btn-secondary py-1.5 px-4"
              >
                Mégse
              </button>
              <button 
                onClick={handleSaveDay} 
                className="btn btn-primary py-1.5 px-4"
              >
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
