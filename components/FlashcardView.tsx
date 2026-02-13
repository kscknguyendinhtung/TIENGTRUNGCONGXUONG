import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, SentenceAnalysis } from '../types';
// Fixed: Removed fetchPublicSheetCsv as it is not exported from geminiService
import { speakText, extractVocabulary, syncVocabData, toggleBackgroundMode } from '../services/geminiService';

interface FlashcardViewProps { 
  currentUser: string; 
  manualCards: Flashcard[];
  onDataChange?: () => void;
  scriptUrl: string;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ currentUser, manualCards, onDataChange, scriptUrl }) => {
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

  // Lọc từ vựng
  const categories = useMemo(() => {
    const cats = new Set<string>();
    manualCards.forEach(c => c.category && cats.add(c.category));
    return Array.from(cats).sort();
  }, [manualCards]);

  const filteredCards = useMemo(() => {
    let list = manualCards;
    if (studyFilter === 'unmastered') list = list.filter(c => !c.mastered);
    if (topicFilter !== 'all') list = list.filter(c => c.category === topicFilter);
    return list;
  }, [manualCards, studyFilter, topicFilter]);

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

  const handleToggleBackground = () => {
    const newState = !isBackgroundAudio;
    setIsBackgroundAudio(newState);
    toggleBackgroundMode(newState);
  };

  const deleteWord = async (word: string) => {
    if (!confirm(`Xóa từ "${word}"?`)) return;
    const updated = manualCards.filter(w => w.word !== word);
    localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updated));
    if (onDataChange) onDataChange();
  };

  const toggleMastery = async (card: Flashcard) => {
    const masteryMap = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    const newState = !card.mastered;
    masteryMap[card.word] = newState;
    localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(masteryMap));
    
    const updated = manualCards.map(m => m.word === card.word ? { ...m, mastered: newState } : m);
    localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updated));

    if (onDataChange) onDataChange();
  };

  const handleProcessAdd = async () => {
    setIsProcessing(true);
    let newWordsRaw: any[] = [];
    try {
      if (addMode === 'image') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        const b64Promise = new Promise<string>(r => { reader.onload = (e) => r((e.target?.result as string).split(',')[1]); reader.readAsDataURL(file); });
        const b64 = await b64Promise;
        newWordsRaw = await extractVocabulary({ imageBase64: b64 });
      } else {
        if (!inputText.trim()) return;
        newWordsRaw = await extractVocabulary({ text: inputText });
      }
      if (newWordsRaw.length > 0) {
        const formatted: Flashcard[] = newWordsRaw.map((w, idx) => ({ id: `m-${Date.now()}-${idx}`, word: w.text, pinyin: w.pinyin, meaning: w.meaning, hanViet: w.hanViet, category: w.category, isManual: true, mastered: false }));
        localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify([...formatted, ...manualCards]));
        setInputText(''); setShowAddModal(false); if (onDataChange) onDataChange();
      }
    } catch (e) { alert("Lỗi xử lý."); } finally { setIsProcessing(false); }
  };

  const handleCardSelect = (index: number) => {
    setCurrentIndex(index);
    setViewMode('card');
    setIsFlipped(false);
    setIsAutoPlay(false); 
  };

  if (manualCards.length === 0 && !showAddModal) return (
    <div className="py-20 px-6 text-center flex flex-col items-center">
      <div className="text-6xl mb-6 opacity-20">🗂️</div>
      <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">Chưa có từ vựng. Hãy nhấn Quét AI hoặc Tải về ở Home.</h3>
      <button onClick={() => setShowAddModal(true)} className="mt-8 bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest shadow-lg uppercase">Thêm từ thủ công</button>
    </div>
  );

  return (
    <div className="px-5 py-4 max-w-lg mx-auto pb-28">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-rose-600 uppercase tracking-tighter">Từ vựng & Thẻ</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg></button>
            <div className="bg-slate-100 p-1 rounded-xl flex">
              <button onClick={() => setViewMode('card')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>THẺ</button>
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
      </div>

      {viewMode === 'card' && currentCard ? (
        <div className="flex flex-col items-center">
          <div className="flex justify-between w-full items-end mb-3 px-2">
             <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">THẺ {currentIndex + 1} / {displayCards.length}</div>
             <button onClick={() => deleteWord(currentCard.word)} className="text-rose-300 hover:text-rose-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
          </div>
          <div className="w-full h-[380px] relative transition-all duration-500 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`absolute inset-0 transition-all duration-700 ${isFlipped ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
              <div className="h-full bg-white border-b-4 border-rose-500 rounded-[40px] shadow-xl flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-7xl font-black text-slate-950 chinese-font mb-4">{currentCard.word}</h1>
                <p className="text-xl text-blue-600 font-black uppercase">{currentCard.pinyin}</p>
                <button onClick={(e) => { e.stopPropagation(); speakText(currentCard.word, 'cn', playbackSpeed); }} className="mt-8 w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:text-blue-600 border border-slate-100"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>
              </div>
            </div>
            <div className={`absolute inset-0 transition-all duration-700 ${!isFlipped ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
              <div className="h-full bg-slate-900 rounded-[40px] shadow-xl flex flex-col items-center justify-center p-8 text-white text-center">
                <h2 className="text-3xl font-black mb-6 uppercase text-blue-100">{currentCard.hanViet}</h2>
                <div className="w-12 h-0.5 bg-slate-800 rounded-full mb-6"></div>
                <h2 className="text-2xl font-black leading-tight">{currentCard.meaning}</h2>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8 w-full">
            <button className="flex-1 bg-white border border-slate-200 text-slate-400 py-4 rounded-2xl font-black text-[9px] active:scale-95 transition" onClick={() => { setIsFlipped(false); setCurrentIndex(prev => prev > 0 ? prev - 1 : displayCards.length - 1); }}>TRƯỚC</button>
            <button onClick={() => toggleMastery(currentCard)} className={`flex-1 py-4 rounded-2xl font-black text-[9px] transition-all ${currentCard.mastered ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{currentCard.mastered ? 'ĐÃ THUỘC' : 'GHI NHỚ'}</button>
            <button className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-black text-[9px] shadow-lg active:scale-95 transition" onClick={() => { setIsFlipped(false); setCurrentIndex(prev => prev < displayCards.length - 1 ? prev + 1 : 0); }}>SAU</button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2 pb-20">
          <div className="grid grid-cols-12 gap-1 px-4 py-3 text-[8px] font-black uppercase text-slate-400">
             <div className="col-span-3">Hán tự</div><div className="col-span-2">Pinyin</div><div className="col-span-2">Hán Việt</div><div className="col-span-3">Nghĩa</div><div className="col-span-2 text-right">M</div>
          </div>
          {displayCards.map((card, idx) => (
            <div key={idx} onClick={() => handleCardSelect(idx)} className={`bg-white px-4 py-3 rounded-xl border grid grid-cols-12 gap-1 items-center active:scale-[0.99] transition-all ${card.mastered ? 'bg-green-50/30 border-green-100' : 'border-slate-100'}`}>
               <div className="col-span-3 font-black chinese-font text-slate-900 truncate">{card.word}</div>
               <div className="col-span-2 text-[9px] font-bold text-rose-500 truncate">{card.pinyin}</div>
               <div className="col-span-2 text-[9px] font-bold text-blue-500 truncate">{card.hanViet}</div>
               <div className="col-span-3 text-[9px] font-bold text-slate-600 truncate">{card.meaning}</div>
               <div className="col-span-2 flex justify-end">
                 <button onClick={(e) => { e.stopPropagation(); toggleMastery(card); }} className={`w-6 h-6 rounded-lg flex items-center justify-center ${card.mastered ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-300'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg></button>
               </div>
            </div>
          ))}
        </div>
      ) : null}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 z-[150]">
          <div className="bg-white w-full max-w-sm p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-2xl font-black mb-1 text-slate-900 tracking-tighter uppercase">Thêm từ vựng</h2>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Dán văn bản..." className="w-full h-32 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm resize-none" />
            <div className="flex gap-3 mt-8">
               <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase">Hủy</button>
               <button onClick={handleProcessAdd} disabled={isProcessing} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2">{isProcessing ? 'ĐANG PHÂN TÍCH...' : 'THÊM NGAY'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
