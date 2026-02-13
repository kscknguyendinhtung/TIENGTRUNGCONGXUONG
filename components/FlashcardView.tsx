
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, SentenceAnalysis } from '../types';
import { speakText, extractVocabulary, fetchPublicSheetCsv, syncVocabData, toggleBackgroundMode } from '../services/geminiService';

interface FlashcardViewProps { 
  currentUser: string; 
  onDataChange?: () => void;
  sheetUrl?: string;
  onPull?: () => void;
  scriptUrl: string; // This will now be the Vocab Script URL
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ currentUser, onDataChange, sheetUrl, onPull, scriptUrl }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [isRandom, setIsRandom] = useState(false);
  const [frontMode, setFrontMode] = useState<'chinese' | 'vietnamese'>('chinese');
  const [studyFilter, setStudyFilter] = useState<'all' | 'unmastered'>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isBackgroundAudio, setIsBackgroundAudio] = useState(false);
  const [isAutoSpeak, setIsAutoSpeak] = useState(true);
  const [autoInterval, setAutoInterval] = useState(4); 
  const [playbackSpeed, setPlaybackSpeed] = useState(1.1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'text' | 'image'>('text');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk select states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // Auto Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadCards();
    // Bỏ tự động đồng bộ từ Sheet URL tại đây
  }, [currentUser, sheetUrl]);

  const handleToggleBackground = () => {
    const newState = !isBackgroundAudio;
    setIsBackgroundAudio(newState);
    toggleBackgroundMode(newState);
  };

  const loadCards = () => {
    const localSentences = localStorage.getItem(`reading_${currentUser}`);
    const localManual = localStorage.getItem(`manual_words_${currentUser}`);
    const localMastery = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    
    let extractedCards: Flashcard[] = [];
    const wordSet = new Set<string>();

    if (localSentences) {
      try {
        const sentences: SentenceAnalysis[] = JSON.parse(localSentences);
        sentences.forEach(s => {
          s.words?.forEach(w => {
            if (!wordSet.has(w.text)) {
              wordSet.add(w.text);
              extractedCards.push({
                id: `w-${w.text}`,
                word: w.text,
                pinyin: w.pinyin,
                meaning: w.meaning,
                hanViet: w.hanViet || '',
                category: w.category || 'Khác',
                mastered: localMastery[w.text] || false
              });
            }
          });
        });
      } catch(e) { console.error("Error loading sentences:", e); }
    }

    if (localManual) {
      try {
        const manual: Flashcard[] = JSON.parse(localManual);
        if (Array.isArray(manual)) {
          manual.forEach(w => {
            if (!wordSet.has(w.word)) {
              wordSet.add(w.word);
              extractedCards.push({ 
                ...w, 
                mastered: localMastery[w.word] || false 
              });
            }
          });
        }
      } catch(e) { console.error("Error loading manual cards:", e); }
    }
    setCards(extractedCards);
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cards.forEach(c => c.category && cats.add(c.category));
    return Array.from(cats).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    let list = cards;
    if (studyFilter === 'unmastered') list = list.filter(c => !c.mastered);
    if (topicFilter !== 'all') list = list.filter(c => c.category === topicFilter);
    return list;
  }, [cards, studyFilter, topicFilter]);

  const displayCards = useMemo(() => {
    const list = [...filteredCards];
    if (isRandom) list.sort(() => Math.random() - 0.5);
    return list;
  }, [filteredCards, isRandom]);

  const currentCard = displayCards[currentIndex] || null;

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [studyFilter, isRandom, topicFilter]);

  useEffect(() => {
    if (isAutoSpeak && currentCard && viewMode === 'card') {
      const textToSpeak = !isFlipped 
        ? (frontMode === 'chinese' ? currentCard.word : currentCard.meaning)
        : (frontMode === 'chinese' ? currentCard.meaning : currentCard.word);
      const lang = (!isFlipped ? frontMode === 'chinese' : frontMode !== 'chinese') ? 'cn' : 'vn';
      speakText(textToSpeak, lang, playbackSpeed);
    }
  }, [currentIndex, isFlipped, frontMode, isAutoSpeak, viewMode, playbackSpeed, currentCard]);

  useEffect(() => {
    if (isAutoPlay && viewMode === 'card' && displayCards.length > 0) {
      timerRef.current = setInterval(() => {
        setIsFlipped(prev => {
          if (!prev) return true; 
          setCurrentIndex(curr => (curr < displayCards.length - 1 ? curr + 1 : 0));
          return false; 
        });
      }, autoInterval * 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAutoPlay, autoInterval, displayCards.length, viewMode]);

  const getManualWords = (): Flashcard[] => {
    const raw = localStorage.getItem(`manual_words_${currentUser}`);
    return raw ? JSON.parse(raw) : [];
  };

  const deleteSelectedWords = async () => {
    if (selectedWords.size === 0) return;
    if (!confirm(`Xóa ${selectedWords.size} từ?`)) return;
    let updatedManual: Flashcard[] = [];
    try {
      const manual = getManualWords();
      updatedManual = manual.filter((w: Flashcard) => !selectedWords.has(w.word));
      localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedManual));
    } catch(e) { console.error("Error bulk deleting words", e); }
    const masteryMap = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    selectedWords.forEach(word => delete masteryMap[word]);
    localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(masteryMap));
    setSelectedWords(new Set());
    setIsSelectionMode(false);
    loadCards();
    if (onDataChange) onDataChange();
  };

  const deleteWord = async (word: string) => {
    if (!confirm(`Xóa từ "${word}"?`)) return;
    let updatedManual: Flashcard[] = [];
    try {
      const manual = getManualWords();
      updatedManual = manual.filter((w: Flashcard) => w.word !== word);
      localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedManual));
    } catch(e) { console.error("Error deleting word", e); }
    const masteryMap = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    delete masteryMap[word];
    localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(masteryMap));
    loadCards();
    if (onDataChange) onDataChange();
  };

  const toggleMastery = async (card: Flashcard) => {
    const masteryMap = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    const newState = !card.mastered;
    masteryMap[card.word] = newState;
    localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(masteryMap));
    setCards(prev => prev.map(c => c.word === card.word ? { ...c, mastered: newState } : c));
    const manual = getManualWords();
    const updatedManual = manual.map(m => m.word === card.word ? { ...m, mastered: newState } : m);
    localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedManual));
    if (onDataChange) onDataChange();
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev);
    setSelectedWords(new Set());
  };

  const handleSelectWord = (word: string) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word)) { newSelected.delete(word); } else { newSelected.add(word); }
    setSelectedWords(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedWords.size === displayCards.length) { setSelectedWords(new Set()); } else { setSelectedWords(new Set(displayCards.map(c => c.word))); }
  };

  const handleProcessAdd = async () => {
    setIsProcessing(true);
    let newWordsRaw: any[] = [];
    try {
      if (addMode === 'image') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
            reader.onload = (e) => resolve((e.target?.result as string).split(',')[1] || "");
            reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        newWordsRaw = await extractVocabulary({ imageBase64: base64 });
      } else {
        if (!inputText.trim()) return;
        newWordsRaw = await extractVocabulary({ text: inputText });
      }
      if (newWordsRaw.length > 0) {
        let manual = getManualWords();
        const formattedWords: Flashcard[] = newWordsRaw.map((w, idx) => ({
          id: `manual-${Date.now()}-${idx}`,
          word: w.text, pinyin: w.pinyin, meaning: w.meaning, hanViet: w.hanViet, category: w.category, isManual: true, mastered: false
        }));
        const updatedList = [...manual, ...formattedWords];
        localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedList));
        setInputText(''); setShowAddModal(false); loadCards();
        if (onDataChange) onDataChange();
      } else { alert("Không tìm thấy từ vựng nào!"); }
    } catch (e) { console.error(e); alert("Lỗi xử lý AI. Vui lòng thử lại."); } finally { setIsProcessing(false); }
  };
  
  const handleProcessImport = async () => {
    if (!importText.trim()) return;
    setIsProcessing(true);
    try {
      const lines = importText.split('\n').filter(l => l.trim());
      const newCards: Flashcard[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split('\t');
        const word = parts[0]?.trim();
        if (!word) return;
        newCards.push({ id: `import-${Date.now()}-${idx}`, word: word, pinyin: parts[1]?.trim() || '', hanViet: parts[2]?.trim() || '', meaning: parts[3]?.trim() || '', category: parts[4]?.trim() || 'Khác', mastered: false, isManual: true });
      });
      if (newCards.length > 0) {
        const manual = getManualWords();
        const existingWords = new Set(manual.map(m => m.word));
        const toAdd = newCards.filter(c => !existingWords.has(c.word));
        const updatedList = [...manual, ...toAdd];
        localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedList));
        setImportText(''); setShowImportModal(false); loadCards();
        if (onDataChange) onDataChange();
        alert(`Đã nhập ${toAdd.length} từ mới.`);
      } else { alert("Không có dữ liệu hợp lệ."); }
    } catch(e) { console.error(e); alert("Lỗi nhập liệu."); } finally { setIsProcessing(false); }
  };

  const handleCardSelect = (index: number) => {
    if (isSelectionMode) { handleSelectWord(displayCards[index].word); } else { setCurrentIndex(index); setViewMode('card'); setIsFlipped(false); setIsAutoPlay(false); }
  };

  const handleAutoSyncManual = async () => {
    if (!sheetUrl) { alert("Vui lòng cấu hình URL Google Sheets trước."); return; }
    setIsSyncing(true);
    try {
      const newData = await fetchPublicSheetCsv(sheetUrl);
      if (newData.length === 0) {
        if (window.confirm("Sheet đang TRỐNG.\nBạn có muốn XÓA SẠCH dữ liệu trên App để giống Sheet không?")) {
          localStorage.setItem(`manual_words_${currentUser}`, '[]'); localStorage.setItem(`mastery_${currentUser}`, '{}'); setCards([]);
          alert("Đã xóa sạch dữ liệu trên App."); if (onDataChange) onDataChange();
        }
        setIsSyncing(false); return;
      }
      const newCards: Flashcard[] = newData.map((d, i) => ({ id: `auto-${Date.now()}-${i}`, word: d.word, pinyin: d.pinyin, hanViet: d.hanViet, meaning: d.meaning, category: d.category, isManual: true, mastered: d.mastered }));
      
      let updatedManual: Flashcard[] = [];
      if (window.confirm(`Tìm thấy ${newCards.length} từ trên Sheet.\n\nNhấn OK để ĐỒNG BỘ 100% theo Sheet.\nNhấn Cancel để GỘP.`)) {
         updatedManual = newCards;
         const newMasteryMap: Record<string, boolean> = {};
         newCards.forEach(c => { if (c.mastered) { newMasteryMap[c.word] = true; } });
         localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(newMasteryMap));
      } else {
         const raw = localStorage.getItem(`manual_words_${currentUser}`);
         let manual: Flashcard[] = raw ? JSON.parse(raw) : [];
         const existingWords = new Set(newCards.map(c => c.word));
         const filteredManual = manual.filter(m => !existingWords.has(m.word));
         updatedManual = [...filteredManual, ...newCards];
         const currentMastery = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
         newCards.forEach(c => { if (c.mastered) currentMastery[c.word] = true; });
         localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(currentMastery));
      }
      localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedManual));
      alert(`Đã đồng bộ xong dữ liệu từ Sheet.`); loadCards();
      if (onDataChange) onDataChange();
    } catch (e) { console.error(e); alert("Lỗi đồng bộ. Vui lòng kiểm tra lại Link Sheet."); } finally { setIsSyncing(false); }
  };

  if (cards.length === 0 && !showAddModal && !showImportModal) return (
    <div className="py-20 px-6 text-center flex flex-col items-center">
      <div className="text-6xl mb-6 opacity-20">🗂️</div>
      <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">Chưa có dữ liệu từ vựng</h3>
      <p className="text-[10px] text-slate-400 mt-2">Vui lòng quay lại Home và bấm TẢI VỀ MÁY</p>
      <div className="flex flex-col gap-3 mt-8">
        <button onClick={() => setShowAddModal(true)} className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest shadow-lg active:scale-95 uppercase">Thêm từ thủ công</button>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 max-w-lg mx-auto pb-28">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-rose-600 uppercase tracking-tighter">Flashcards</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-transform">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
            </button>
            <div className="bg-slate-100 p-1 rounded-xl flex">
              <button onClick={() => { setViewMode('card'); setIsSelectionMode(false); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>THẺ</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>BẢNG</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
           <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-xl px-4 py-2.5 outline-none shadow-sm max-w-[50%] truncate">
             <option value="all">Tất cả chủ đề</option>
             {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
           </select>
           <div className="flex bg-slate-100 p-1 rounded-xl flex-1 min-w-max">
              <button onClick={() => setStudyFilter('all')} className={`flex-1 px-3 py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all ${studyFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>TẤT CẢ</button>
              <button onClick={() => setStudyFilter('unmastered')} className={`flex-1 px-3 py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all ${studyFilter === 'unmastered' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>CHƯA</button>
           </div>
        </div>
        
        {viewMode === 'card' && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setFrontMode(frontMode === 'chinese' ? 'vietnamese' : 'chinese')} className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${frontMode === 'chinese' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>Mặt trước: {frontMode === 'chinese' ? 'HÁN TỰ' : 'NGHĨA'}</button>
            <button onClick={() => setIsRandom(!isRandom)} className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${isRandom ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}>{isRandom ? 'XÁO: BẬT' : 'XÁO: TẮT'}</button>
          </div>
        )}

        {viewMode === 'card' && (
          <div className="bg-slate-900 p-5 rounded-[28px] text-white flex flex-col gap-3 shadow-lg">
             <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${isAutoPlay ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
                   <span className="text-[8px] font-black uppercase tracking-[0.2em]">TỰ ĐỘNG CHẠY</span>
                </div>
                <button onClick={() => setIsAutoPlay(!isAutoPlay)} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${isAutoPlay ? 'bg-rose-500 text-white' : 'bg-white text-slate-900'}`}>{isAutoPlay ? 'DỪNG' : 'BẮT ĐẦU'}</button>
             </div>
             <div className="flex items-center gap-3">
                <span className="text-[8px] font-bold text-slate-400 uppercase w-16">Tốc độ:</span>
                <input type="range" min="0.5" max="2.0" step="0.1" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"/>
                <span className="text-[9px] font-black w-6 text-right">{playbackSpeed}x</span>
             </div>
             <div className="flex items-center gap-3">
                <span className="text-[8px] font-bold text-slate-400 uppercase w-16">Chờ:</span>
                <input type="range" min="2" max="10" step="1" value={autoInterval} onChange={(e) => setAutoInterval(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                <span className="text-[9px] font-black w-6 text-right">{autoInterval}s</span>
             </div>
             <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Chạy ngầm (iOS):</span>
                <button onClick={handleToggleBackground} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${isBackgroundAudio ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{isBackgroundAudio ? 'ĐANG BẬT' : 'ĐÃ TẮT'}</button>
             </div>
          </div>
        )}
      </div>

      {displayCards.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-[32px] border border-slate-100 shadow-sm">
           <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{topicFilter !== 'all' ? 'Không có từ vựng trong chủ đề này' : 'Danh sách trống'}</p>
        </div>
      ) : viewMode === 'card' && currentCard ? (
        <div className="flex flex-col items-center">
          <div className="flex justify-between w-full items-end mb-3 px-2">
             <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">THẺ {currentIndex + 1} / {displayCards.length}</div>
             <div className="flex gap-2">
               <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest max-w-[120px] truncate">{currentCard.category || 'Khác'}</span>
               <button onClick={() => deleteWord(currentCard.word)} className="text-rose-300 hover:text-rose-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
             </div>
          </div>
          <div className="w-full h-[400px] relative transition-all duration-500 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`absolute inset-0 transition-all duration-700 ${isFlipped ? 'opacity-0 pointer-events-none [transform:rotateY(180deg)] scale-90' : 'opacity-100 scale-100 [transform:rotateY(0deg)]'}`}>
              <div className="h-full bg-white border-b-4 border-rose-500 rounded-[48px] shadow-xl flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <span className={`absolute top-6 right-6 text-[7px] font-black px-3 py-1.5 rounded-full tracking-widest uppercase ${currentCard.mastered ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-300'}`}>{currentCard.mastered ? 'THUỘC' : 'CHƯA'}</span>
                {frontMode === 'chinese' ? (
                  <>
                    <h1 className="text-7xl font-black text-slate-950 chinese-font mb-4 tracking-tighter">{currentCard.word}</h1>
                    <p className="text-xl text-blue-600 font-black uppercase tracking-tighter">{currentCard.pinyin}</p>
                    <button onClick={(e) => { e.stopPropagation(); speakText(currentCard.word, 'cn', playbackSpeed); }} className="mt-8 w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight px-4">{currentCard.meaning}</h2>
                    <button onClick={(e) => { e.stopPropagation(); speakText(currentCard.meaning, 'vn', playbackSpeed); }} className="mt-8 w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>
                  </>
                )}
              </div>
            </div>
            <div className={`absolute inset-0 transition-all duration-700 ${!isFlipped ? 'opacity-0 pointer-events-none [transform:rotateY(-180deg)] scale-90' : 'opacity-100 scale-100 [transform:rotateY(0deg)]'}`}>
              <div className="h-full bg-slate-900 rounded-[48px] shadow-xl flex flex-col items-center justify-center p-8 text-white border-b-4 border-blue-500 text-center relative">
                {frontMode === 'chinese' ? (
                  <>
                    <p className="text-blue-400 font-black text-[8px] uppercase tracking-[0.3em] mb-2">Hán Việt</p>
                    <h2 className="text-3xl font-black mb-6 uppercase tracking-tighter text-blue-100">{currentCard.hanViet}</h2>
                    <div className="w-12 h-0.5 bg-slate-800 rounded-full mb-6"></div>
                    <p className="text-emerald-400 font-black text-[8px] uppercase tracking-[0.3em] mb-2">Dịch Nghĩa</p>
                    <h2 className="text-2xl font-black tracking-tight leading-tight">{currentCard.meaning}</h2>
                  </>
                ) : (
                  <>
                    <h1 className="text-7xl font-black text-white chinese-font mb-4 tracking-tighter">{currentCard.word}</h1>
                    <p className="text-xl text-rose-500 font-black uppercase tracking-widest mb-2">{currentCard.pinyin}</p>
                    <p className="text-blue-400 font-black text-lg uppercase tracking-widest">{currentCard.hanViet}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8 w-full">
            <button className="flex-1 bg-white border border-slate-200 text-slate-400 py-4 rounded-2xl font-black text-[9px] tracking-widest active:scale-95 transition" onClick={() => { setIsFlipped(false); setCurrentIndex(prev => prev > 0 ? prev - 1 : displayCards.length - 1); }}>TRƯỚC</button>
            <button onClick={() => toggleMastery(currentCard)} className={`flex-1 py-4 rounded-2xl font-black text-[9px] tracking-widest transition-all ${currentCard.mastered ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{currentCard.mastered ? 'ĐÃ THUỘC' : 'GHI NHỚ'}</button>
            <button className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-black text-[9px] tracking-widest shadow-lg active:scale-95 transition" onClick={() => { setIsFlipped(false); setCurrentIndex(prev => prev < displayCards.length - 1 ? prev + 1 : 0); }}>SAU</button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3 pb-20">
          <div className="flex flex-col gap-3">
             <div className="flex gap-2">
               <button onClick={handleAutoSyncManual} disabled={isSyncing} className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm">
                   {isSyncing ? (<div className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>) : (<><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Tải từ Sheet</>)}
               </button>
             </div>
             <div className="flex justify-end mb-1"><button onClick={() => setShowImportModal(true)} className="text-[8px] font-black text-blue-500 uppercase tracking-widest hover:underline">Hoặc nhập thủ công (Paste)</button></div>
             <div className="flex justify-between items-center px-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">{isSelectionMode ? `Đã chọn: ${selectedWords.size}` : 'Chạm vào từ để học'}</p>
                <button onClick={toggleSelectionMode} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${isSelectionMode ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{isSelectionMode ? 'Hủy chọn' : 'Chọn nhiều'}</button>
             </div>
          </div>
          {isSelectionMode && (
             <div className="flex gap-2">
                <button onClick={handleSelectAll} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest">Chọn Tất Cả</button>
                {selectedWords.size > 0 && (<button onClick={deleteSelectedWords} className="flex-1 py-2 bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md">Xóa {selectedWords.size} Từ</button>)}
             </div>
          )}
          <div className="grid grid-cols-12 gap-1 px-4 py-3 bg-slate-100 rounded-t-xl text-[8px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
             <div className="col-span-2">Hán tự</div><div className="col-span-2">Pinyin</div><div className="col-span-2">Hán Việt</div><div className="col-span-4">Nghĩa</div><div className="col-span-2 text-right">Trạng thái</div>
          </div>
          <div className="space-y-1">
          {displayCards.map((card, idx) => (
            <div key={idx} onClick={() => handleCardSelect(idx)} className={`cursor-pointer bg-white px-4 py-3 rounded-lg border grid grid-cols-12 gap-1 items-center active:scale-[0.99] transition-all hover:shadow-sm ${isSelectionMode && selectedWords.has(card.word) ? 'border-rose-500 bg-rose-50' : 'border-slate-100'}`}>
               <div className="col-span-2 flex items-center gap-2">
                 {isSelectionMode && (<div className={`w-3 h-3 rounded border flex items-center justify-center ${selectedWords.has(card.word) ? 'bg-rose-500 border-rose-500' : 'border-slate-300'}`}>{selectedWords.has(card.word) && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}</div>)}
                 <span className="text-sm font-black chinese-font text-slate-900 truncate">{card.word}</span>
               </div>
               <div className="col-span-2"><span className="text-[9px] font-bold text-rose-500 truncate block">{card.pinyin}</span></div>
               <div className="col-span-2"><span className="text-[9px] font-bold text-blue-500 truncate block">{card.hanViet}</span></div>
               <div className="col-span-4"><span className="text-[9px] font-bold text-slate-600 line-clamp-2 leading-tight">{card.meaning}</span></div>
               <div className="col-span-2 flex justify-end items-center gap-2">
                 <button onClick={(e) => { e.stopPropagation(); toggleMastery(card); }} className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${card.mastered ? 'bg-green-500 text-white shadow-sm' : 'bg-slate-100 text-slate-300'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg></button>
                 {!isSelectionMode && (<button onClick={(e) => { e.stopPropagation(); deleteWord(card.word); }} className="text-slate-300 hover:text-rose-500 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>)}
               </div>
            </div>
          ))}
          </div>
        </div>
      ) : null}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 z-[150]">
          <div className="bg-white w-full max-w-sm p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-2xl font-black mb-1 text-slate-900 tracking-tighter uppercase">Thêm từ vựng</h2>
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
               <button onClick={() => setAddMode('text')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${addMode === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Nhập văn bản</button>
               <button onClick={() => setAddMode('image')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${addMode === 'image' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Quét Ảnh</button>
            </div>
            <div className="space-y-4">
              {addMode === 'text' ? (<div><textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Dán danh sách từ..." className="w-full h-32 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm text-slate-700 resize-none focus:border-blue-500 transition-colors" /></div>) : (
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all" onClick={() => fileInputRef.current?.click()}>
                   <input type="file" ref={fileInputRef} hidden accept="image/*" />
                   <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                   <span className="text-[9px] font-black uppercase tracking-widest">Chọn ảnh</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
               <button onClick={() => setShowAddModal(false)} disabled={isProcessing} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] tracking-widest uppercase">Hủy</button>
               <button onClick={handleProcessAdd} disabled={isProcessing || (addMode === 'text' && !inputText)} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-lg uppercase flex items-center justify-center gap-2">{isProcessing && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} {isProcessing ? 'Đang phân tích...' : 'Thêm ngay'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
