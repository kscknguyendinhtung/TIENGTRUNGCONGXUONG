
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, SentenceAnalysis } from '../types';
import { speakText } from '../services/geminiService';
import { MindmapView } from './MindmapView';

interface FlashcardViewProps { 
  currentUser: string; 
  onDataChange?: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ currentUser, onDataChange }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [isRandom, setIsRandom] = useState(false);
  const [frontMode, setFrontMode] = useState<'chinese' | 'vietnamese'>('chinese');
  const [studyFilter, setStudyFilter] = useState<'all' | 'unmastered'>('all');
  
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isAutoSpeak, setIsAutoSpeak] = useState(true);
  const [autoInterval, setAutoInterval] = useState(4); 
  const [playbackSpeed, setPlaybackSpeed] = useState(1.1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);
  const [newWord, setNewWord] = useState({ text: '', pinyin: '', meaning: '', hanViet: '' });

  useEffect(() => {
    loadCards();
  }, [currentUser]);

  const loadCards = () => {
    const localSentences = localStorage.getItem(`reading_${currentUser}`);
    const localManual = localStorage.getItem(`manual_words_${currentUser}`);
    const localMastery = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    
    let extractedCards: Flashcard[] = [];
    const wordSet = new Set<string>();

    if (localSentences) {
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
              mastered: localMastery[w.text] || false
            });
          }
        });
      });
    }

    if (localManual) {
      const manual: Flashcard[] = JSON.parse(localManual);
      manual.forEach(w => {
        if (!wordSet.has(w.word)) {
          wordSet.add(w.word);
          extractedCards.push({ ...w, mastered: localMastery[w.word] || false });
        }
      });
    }

    setCards(extractedCards);
  };

  const filteredCards = useMemo(() => {
    return studyFilter === 'unmastered' ? cards.filter(c => !c.mastered) : cards;
  }, [cards, studyFilter]);

  const displayCards = useMemo(() => {
    const list = [...filteredCards];
    if (isRandom) list.sort(() => Math.random() - 0.5);
    return list;
  }, [filteredCards, isRandom]);

  const currentCard = displayCards[currentIndex] || null;

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [studyFilter, isRandom]);

  useEffect(() => {
    if (isAutoSpeak && currentCard && viewMode === 'card') {
      const textToSpeak = !isFlipped 
        ? (frontMode === 'chinese' ? currentCard.word : currentCard.meaning)
        : (frontMode === 'chinese' ? currentCard.meaning : currentCard.word);
      const lang = (!isFlipped ? frontMode === 'chinese' : frontMode !== 'chinese') ? 'cn' : 'vn';
      speakText(textToSpeak, lang, playbackSpeed);
    }
  }, [currentIndex, isFlipped, frontMode, isAutoSpeak, viewMode, playbackSpeed]);

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

  const toggleMastery = (card: Flashcard) => {
    const masteryMap = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    masteryMap[card.word] = !card.mastered;
    localStorage.setItem(`mastery_${currentUser}`, JSON.stringify(masteryMap));
    setCards(cards.map(c => c.word === card.word ? { ...c, mastered: !c.mastered } : c));
    if (onDataChange) onDataChange();
  };

  const deleteWord = (word: string) => {
    if (!confirm(`Xóa từ "${word}" khỏi danh sách học?`)) return;
    
    // Xóa khỏi manual nếu có
    const manual = JSON.parse(localStorage.getItem(`manual_words_${currentUser}`) || '[]');
    const updatedManual = manual.filter((w: Flashcard) => w.word !== word);
    localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify(updatedManual));

    // Xóa khỏi tất cả các bài học reading
    const reading = JSON.parse(localStorage.getItem(`reading_${currentUser}`) || '[]');
    const updatedReading = reading.map((s: SentenceAnalysis) => ({
      ...s,
      words: s.words.filter(w => w.text !== word)
    }));
    localStorage.setItem(`reading_${currentUser}`, JSON.stringify(updatedReading));

    loadCards();
    if (onDataChange) onDataChange();
  };

  const addManualWord = () => {
    if (!newWord.text || !newWord.meaning) return alert("Nhập ít nhất Hán tự và Nghĩa!");
    const manual = JSON.parse(localStorage.getItem(`manual_words_${currentUser}`) || '[]');
    const entry: Flashcard = {
      id: `manual-${Date.now()}`,
      word: newWord.text,
      pinyin: newWord.pinyin,
      meaning: newWord.meaning,
      hanViet: newWord.hanViet,
      isManual: true,
      mastered: false
    };
    localStorage.setItem(`manual_words_${currentUser}`, JSON.stringify([...manual, entry]));
    setNewWord({ text: '', pinyin: '', meaning: '', hanViet: '' });
    setShowAddModal(false);
    loadCards();
    if (onDataChange) onDataChange();
  };

  if (cards.length === 0 && !showAddModal) return (
    <div className="py-20 px-6 text-center flex flex-col items-center">
      <div className="text-6xl mb-6 opacity-20">🗂️</div>
      <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">Chưa có từ vựng</h3>
      <button onClick={() => setShowAddModal(true)} className="mt-6 bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest shadow-lg active:scale-95 uppercase">Thêm từ đầu tiên</button>
    </div>
  );

  return (
    <div className="px-5 py-4 max-w-lg mx-auto pb-28">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-rose-600 uppercase tracking-tighter">Flashcards</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowMindmap(true)} className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm active:scale-90">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </button>
            <button onClick={() => setShowAddModal(true)} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-sm active:scale-90">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
            </button>
            <div className="bg-slate-100 p-1 rounded-xl flex">
              <button onClick={() => setViewMode('card')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>THẺ</button>
              <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>LIST</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setStudyFilter('all')} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${studyFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>TẤT CẢ ({cards.length})</button>
          <button onClick={() => setStudyFilter('unmastered')} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${studyFilter === 'unmastered' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>CHƯA THUỘC</button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setFrontMode(frontMode === 'chinese' ? 'vietnamese' : 'chinese')} className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${frontMode === 'chinese' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>Mặt trước: {frontMode === 'chinese' ? 'HÁN TỰ' : 'NGHĨA'}</button>
          <button onClick={() => setIsRandom(!isRandom)} className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${isRandom ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}>{isRandom ? 'XÁO: BẬT' : 'XÁO: TẮT'}</button>
        </div>

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
        </div>
      </div>

      {displayCards.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-[32px] border border-slate-100 shadow-sm">
           <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Trống</p>
        </div>
      ) : viewMode === 'card' && currentCard ? (
        <div className="flex flex-col items-center">
          <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-3">THẺ {currentIndex + 1} / {displayCards.length}</div>
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
          {displayCards.map((card, idx) => (
            <div key={idx} className="bg-white p-5 rounded-[28px] border border-slate-100 flex items-center justify-between group active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-black chinese-font text-slate-900">{card.word}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-rose-600 uppercase tracking-tighter">{card.pinyin}</span>
                    <span className="text-[7px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">{card.hanViet}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 leading-tight">{card.meaning}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => deleteWord(card.word)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-400 transition-all opacity-0 group-hover:opacity-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
                <button onClick={() => toggleMastery(card)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${card.mastered ? 'bg-green-500 text-white' : 'bg-slate-50 text-slate-300'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 z-[150]">
          <div className="bg-white w-full max-w-sm p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-2xl font-black mb-1 text-slate-900 tracking-tighter uppercase">Thêm từ vựng</h2>
            <p className="text-slate-400 text-[10px] font-bold mb-8 uppercase tracking-wider">Nhập thông tin từ mới.</p>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Hán tự</label>
                <input type="text" value={newWord.text} onChange={(e) => setNewWord({...newWord, text: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Pinyin</label>
                  <input type="text" value={newWord.pinyin} onChange={(e) => setNewWord({...newWord, pinyin: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Hán Việt</label>
                  <input type="text" value={newWord.hanViet} onChange={(e) => setNewWord({...newWord, hanViet: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nghĩa tiếng Việt</label>
                <input type="text" value={newWord.meaning} onChange={(e) => setNewWord({...newWord, meaning: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
               <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] tracking-widest uppercase">Hủy</button>
               <button onClick={addManualWord} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-lg uppercase">Thêm</button>
            </div>
          </div>
        </div>
      )}

      {showMindmap && (
        <MindmapView 
          user={currentUser} 
          words={cards.map(c => ({ text: c.word, pinyin: c.pinyin, meaning: c.meaning, hanViet: c.hanViet }))} 
          onClose={() => setShowMindmap(false)} 
        />
      )}
    </div>
  );
};
