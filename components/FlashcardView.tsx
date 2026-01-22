import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, SentenceAnalysis } from '../types';
import { speakText } from '../services/geminiService';

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

  useEffect(() => {
    const localSentences = localStorage.getItem(`reading_${currentUser}`);
    const localMastery = JSON.parse(localStorage.getItem(`mastery_${currentUser}`) || '{}');
    if (localSentences) {
      const sentences: SentenceAnalysis[] = JSON.parse(localSentences);
      const extractedCards: Flashcard[] = [];
      
      sentences.forEach(s => {
        if (s.words && Array.isArray(s.words)) {
          s.words.forEach(w => {
            if (w.text && !extractedCards.find(c => c.word === w.text)) {
              extractedCards.push({
                id: `w-${w.text}-${Date.now()}`,
                word: w.text,
                pinyin: w.pinyin,
                meaning: w.meaning,
                hanViet: w.hanViet || '',
                mastered: localMastery[w.text] || false
              });
            }
          });
        }
      });
      setCards(extractedCards);
    }
  }, [currentUser]);

  const filteredCards = useMemo(() => {
    let result = studyFilter === 'unmastered' ? cards.filter(c => !c.mastered) : cards;
    return result;
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

  if (cards.length === 0) return (
    <div className="p-20 text-center flex flex-col items-center">
      <div className="text-8xl mb-8 opacity-20">🗂️</div>
      <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">Chưa có từ vựng</h3>
      <p className="text-slate-400 mt-4 max-w-xs text-xs font-bold italic leading-relaxed">Hãy quét ảnh ở tab Luyện Đọc để hệ thống tự động trích xuất thẻ từ vựng.</p>
    </div>
  );

  return (
    <div className="p-4 max-w-md mx-auto pb-32">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-rose-600 uppercase tracking-tighter">Flashcards</h2>
          <div className="bg-slate-100 p-1.5 rounded-2xl flex">
            <button onClick={() => setViewMode('card')} className={`px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>THẺ</button>
            <button onClick={() => setViewMode('list')} className={`px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>DANH SÁCH</button>
          </div>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-[20px]">
          <button 
            onClick={() => setStudyFilter('all')} 
            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${studyFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
          >
            HỌC TẤT CẢ ({cards.length})
          </button>
          <button 
            onClick={() => setStudyFilter('unmastered')} 
            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${studyFilter === 'unmastered' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}
          >
            CHƯA THUỘC ({cards.filter(c => !c.mastered).length})
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setFrontMode(frontMode === 'chinese' ? 'vietnamese' : 'chinese')}
            className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${frontMode === 'chinese' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}
          >
            Mặt trước: {frontMode === 'chinese' ? 'HÁN TỰ' : 'NGHĨA'}
          </button>
          <button 
            onClick={() => setIsRandom(!isRandom)}
            className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${isRandom ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}
          >
            {isRandom ? 'XÁO TRỘN: BẬT' : 'XÁO TRỘN: TẮT'}
          </button>
        </div>

        <div className="bg-slate-900 p-6 rounded-[32px] text-white flex flex-col gap-4 shadow-xl">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <div className={`w-2 h-2 rounded-full ${isAutoPlay ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
                 <span className="text-[10px] font-black uppercase tracking-widest">TỰ ĐỘNG CHẠY</span>
              </div>
              <button 
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`px-6 py-2 rounded-full text-[9px] font-black transition-all ${isAutoPlay ? 'bg-rose-500 text-white' : 'bg-white text-slate-900'}`}
              >
                {isAutoPlay ? 'DỪNG' : 'BẮT ĐẦU'}
              </button>
           </div>
           
           <div className="flex items-center gap-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase w-20">Tốc độ đọc:</span>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={playbackSpeed} 
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <span className="text-[10px] font-black w-8 text-right">{playbackSpeed}x</span>
           </div>

           <div className="flex items-center gap-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase w-20">Khoảng cách:</span>
              <input 
                type="range" min="2" max="10" step="1" 
                value={autoInterval} 
                onChange={(e) => setAutoInterval(parseInt(e.target.value))}
                className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-[10px] font-black w-8 text-right">{autoInterval}s</span>
           </div>
           <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Tự động đọc:</span>
              <button 
                onClick={() => setIsAutoSpeak(!isAutoSpeak)}
                className={`w-10 h-6 rounded-full relative transition-colors ${isAutoSpeak ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAutoSpeak ? 'left-5' : 'left-1'}`}></div>
              </button>
           </div>
        </div>
      </div>

      {displayCards.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-[48px] border border-slate-100 shadow-sm">
           <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Không có từ nào trong danh sách lọc.</p>
        </div>
      ) : viewMode === 'card' && currentCard ? (
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">THẺ {currentIndex + 1} / {displayCards.length}</div>
          <div 
            className="w-full h-[480px] relative transition-all duration-500 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`absolute inset-0 transition-all duration-700 ${isFlipped ? 'opacity-0 pointer-events-none [transform:rotateY(180deg)] scale-90' : 'opacity-100 scale-100 [transform:rotateY(0deg)]'}`}>
              <div className="h-full bg-white border-b-8 border-rose-500 rounded-[56px] shadow-2xl flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
                <span className={`absolute top-10 right-10 text-[9px] font-black px-4 py-2 rounded-full tracking-[0.2em] uppercase ${currentCard.mastered ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-300'}`}>
                  {currentCard.mastered ? 'ĐÃ THUỘC' : 'CHƯA THUỘC'}
                </span>
                
                {frontMode === 'chinese' ? (
                  <>
                    <h1 className="text-8xl font-black text-slate-950 chinese-font mb-6 tracking-tighter">{currentCard.word}</h1>
                    <p className="text-2xl text-blue-600 font-black uppercase tracking-tighter">{currentCard.pinyin}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); speakText(currentCard.word, 'cn', playbackSpeed); }}
                      className="mt-12 w-16 h-16 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100 shadow-sm"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-tight px-4">{currentCard.meaning}</h2>
                    <button 
                      onClick={(e) => { e.stopPropagation(); speakText(currentCard.meaning, 'vn', playbackSpeed); }}
                      className="mt-12 w-16 h-16 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 shadow-sm"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className={`absolute inset-0 transition-all duration-700 ${!isFlipped ? 'opacity-0 pointer-events-none [transform:rotateY(-180deg)] scale-90' : 'opacity-100 scale-100 [transform:rotateY(0deg)]'}`}>
              <div className="h-full bg-slate-900 rounded-[56px] shadow-2xl flex flex-col items-center justify-center p-12 text-white border-b-8 border-blue-500 text-center relative">
                {frontMode === 'chinese' ? (
                  <>
                    <p className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">Hán Việt</p>
                    <h2 className="text-4xl font-black mb-10 uppercase tracking-tighter text-blue-100">{currentCard.hanViet}</h2>
                    <div className="w-16 h-1 bg-slate-800 rounded-full mb-10"></div>
                    <p className="text-emerald-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">Dịch Nghĩa</p>
                    <h2 className="text-3xl font-black tracking-tight leading-tight">{currentCard.meaning}</h2>
                    <button 
                      onClick={(e) => { e.stopPropagation(); speakText(currentCard.meaning, 'vn', playbackSpeed); }}
                      className="mt-12 w-16 h-16 flex items-center justify-center bg-slate-800 text-slate-500 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <h1 className="text-8xl font-black text-white chinese-font mb-6 tracking-tighter">{currentCard.word}</h1>
                    <p className="text-2xl text-rose-500 font-black uppercase tracking-widest mb-4">{currentCard.pinyin}</p>
                    <p className="text-blue-400 font-black text-xl uppercase tracking-widest mb-10">{currentCard.hanViet}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); speakText(currentCard.word, 'cn', playbackSpeed); }}
                      className="w-16 h-16 flex items-center justify-center bg-slate-800 text-slate-500 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-lg"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-12 w-full">
            <button className="flex-1 bg-white border-2 border-slate-100 text-slate-400 py-6 rounded-3xl font-black text-[10px] tracking-widest active:scale-95 transition shadow-sm" onClick={() => { setIsFlipped(false); setCurrentIndex(prev => prev > 0 ? prev - 1 : displayCards.length - 1); }}>TRƯỚC</button>
            <button onClick={() => toggleMastery(currentCard)} className={`flex-1 py-6 rounded-3xl font-black text-[10px] tracking-widest shadow-xl transition-all ${currentCard.mastered ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600 active:bg-slate-300'}`}>
              {currentCard.mastered ? 'ĐÃ THUỘC' : 'GHI NHỚ'}
            </button>
            <button className="flex-1 bg-rose-600 text-white py-6 rounded-3xl font-black text-[10px] tracking-widest shadow-xl active:scale-95 transition" onClick={() => { setIsFlipped(false); setCurrentIndex(prev => prev < displayCards.length - 1 ? prev + 1 : 0); }}>SAU</button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-4 pb-24">
          {displayCards.map((card, idx) => (
            <div key={idx} className="bg-white p-7 rounded-[40px] border border-slate-100 flex items-center justify-between group hover:shadow-xl hover:border-rose-100 transition-all active:scale-[0.98]">
              <div className="flex items-center gap-6">
                <span className="text-4xl font-black chinese-font text-slate-900">{card.word}</span>
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-sm font-black text-rose-600 uppercase tracking-tighter">{card.pinyin}</span>
                    <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">{card.hanViet}</span>
                  </div>
                  <p className="text-base font-bold text-slate-500 leading-tight">{card.meaning}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => speakText(card.word, 'cn', playbackSpeed)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                </button>
                <button onClick={() => toggleMastery(card)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${card.mastered ? 'bg-green-500 text-white' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};