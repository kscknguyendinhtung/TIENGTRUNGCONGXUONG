
import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageAndExtractText, speakText } from '../services/geminiService';
import { SentenceAnalysis } from '../types';

interface ReadingViewProps { 
  currentUser: string; 
  onDataChange?: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({ currentUser, onDataChange }) => {
  const [sentences, setSentences] = useState<(SentenceAnalysis & { id: string, mastered?: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.8);
  const [showMastered, setShowMastered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`reading_${currentUser}`);
    if (saved) setSentences(JSON.parse(saved));
  }, [currentUser]);

  const save = (data: any) => {
    setSentences(data);
    localStorage.setItem(`reading_${currentUser}`, JSON.stringify(data));
    if (onDataChange) onDataChange();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    const base64Promises = files.map((file: File) => new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve((result || "").split(',')[1] || "");
      };
      reader.readAsDataURL(file);
    }));
    const base64Images = await Promise.all(base64Promises);
    try {
      const result = await analyzeImageAndExtractText(base64Images);
      const newSentences = result.map((s, idx) => ({ ...s, id: Date.now() + '-' + idx, mastered: false }));
      save([...sentences, ...newSentences]);
    } catch (err) {
      alert("Lỗi phân tích.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMastered = (id: string) => {
    save(sentences.map(s => s.id === id ? { ...s, mastered: !s.mastered } : s));
  };

  const filterChineseOnly = (text: string) => {
    return text.replace(/[^\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\n\r\s]/g, '').trim();
  };

  const currentList = sentences.filter(s => s.mastered === showMastered);

  return (
    <div className="p-4 pb-32 max-w-3xl mx-auto bg-white min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Luyện Đọc</h2>
        <div className="flex gap-2">
           <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95 text-xs"
            disabled={loading}
          >
            {loading ? 'ĐANG QUÉT...' : 'QUÉT ẢNH'}
          </button>
        </div>
        <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleFileUpload} />
      </div>

      <div className="bg-slate-50 p-6 rounded-[32px] mb-8 border border-slate-100 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tốc độ đọc: {playbackSpeed}x</span>
          <div className="flex gap-1">
            {[0.5, 0.8, 1.0, 1.2, 1.5].map(s => (
              <button 
                key={s} 
                onClick={() => setPlaybackSpeed(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <input 
          type="range" min="0.5" max="2.0" step="0.1" 
          value={playbackSpeed} 
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      <div className="flex gap-2 mb-10 bg-slate-100 p-1.5 rounded-[20px]">
        <button onClick={() => setShowMastered(false)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${!showMastered ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>ĐANG HỌC</button>
        <button onClick={() => setShowMastered(true)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${showMastered ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>ĐÃ THUỘC</button>
      </div>

      <div className="space-y-16">
        {currentList.map((s, idx) => (
          <div key={s.id} className="relative">
            <div className="flex justify-between items-center mb-6">
               <span className="bg-slate-900 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">MỤC {idx + 1}</span>
               <div className="flex gap-2">
                 <button onClick={() => speakText(s.chinese, 'cn', playbackSpeed)} className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors">
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                 </button>
                 <button onClick={() => toggleMastered(s.id)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${s.mastered ? 'bg-green-100 text-green-600' : 'bg-emerald-50 text-emerald-500'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                 </button>
               </div>
            </div>

            <div className="mb-10">
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6">PHÂN TÍCH TỪ</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-10 items-end">
                {s.words.map((w, wIdx) => (
                  <div key={wIdx} className="flex flex-col items-center cursor-pointer group" onClick={() => setSelectedWord(w)}>
                    <span className="text-[10px] font-black text-blue-400 uppercase mb-1">{w.pinyin}</span>
                    <span className="text-3xl font-black text-slate-950 chinese-font group-hover:text-blue-600 transition-colors leading-none">{w.text}</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase mt-1.5 tracking-tighter">{w.hanViet}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-10 p-8 bg-[#0f172a] rounded-[32px] shadow-2xl relative overflow-hidden">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">VĂN BẢN TIẾNG TRUNG</h4>
              <p className="text-white text-3xl font-black leading-[1.6] chinese-font whitespace-pre-wrap">
                {filterChineseOnly(s.chinese)}
              </p>
            </div>
            
            <div className="mb-10 border-l-[6px] border-blue-100 pl-6 py-1">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">PHIÊN ÂM ĐOẠN</h4>
              <p className="text-blue-600 text-lg font-black italic leading-relaxed whitespace-pre-wrap tracking-tight">
                {s.pinyin}
              </p>
            </div>

            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100/50">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">DỊCH NGHĨA</h4>
              <p className="text-slate-800 font-bold text-lg leading-relaxed whitespace-pre-wrap">
                {s.meaning}
              </p>
            </div>

            {idx !== currentList.length - 1 && <div className="mt-16 border-b border-slate-100"></div>}
          </div>
        ))}
      </div>

      {selectedWord && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={() => setSelectedWord(null)}>
          <div className="bg-white p-12 rounded-[48px] shadow-2xl max-w-sm w-full text-center border-b-[12px] border-blue-600" onClick={e => e.stopPropagation()}>
            <h3 className="text-8xl font-black mb-8 chinese-font text-slate-950 tracking-tighter">{selectedWord.text}</h3>
            <div className="flex flex-col gap-2 mb-10">
              <span className="text-blue-600 font-black text-2xl uppercase tracking-tighter">{selectedWord.pinyin}</span>
              <span className="text-red-500 font-black text-xl uppercase tracking-widest">{selectedWord.hanViet}</span>
            </div>
            <p className="text-slate-600 text-xl font-bold mb-10 leading-tight">{selectedWord.meaning}</p>
            <div className="flex gap-4">
              <button onClick={() => speakText(selectedWord.text, 'cn')} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition">NGHE</button>
              <button onClick={() => setSelectedWord(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs">ĐÓNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
