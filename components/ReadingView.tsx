import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageAndExtractText, speakText } from '../services/geminiService';
import { SentenceAnalysis } from '../types';

interface ReadingViewProps { 
  currentUser: string; 
  onDataChange?: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({ currentUser, onDataChange }) => {
  const [sentences, setSentences] = useState<SentenceAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.8);
  const [showMastered, setShowMastered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`reading_${currentUser}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      const withIds = parsed.map((s: any, idx: number) => ({
        ...s,
        id: s.id || `read-${idx}-${Date.now()}`
      }));
      setSentences(withIds);
    } else {
      setSentences([]);
    }
  }, [currentUser]);

  const save = (data: SentenceAnalysis[]) => {
    setSentences(data);
    localStorage.setItem(`reading_${currentUser}`, JSON.stringify(data));
    // Trigger callback to App so stats and cloud are updated
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
      const newSentences = result.map((s, idx) => ({ 
        ...s, 
        id: `read-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`, 
        mastered: false 
      }));
      save([...sentences, ...newSentences]);
    } catch (err) {
      alert("Lỗi phân tích hình ảnh.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleMastered = (id: string) => {
    const updated = sentences.map(s => s.id === id ? { ...s, mastered: !s.mastered } : s);
    save(updated);
  };

  const deleteLesson = (id: string) => {
    if (window.confirm("Xóa bài học này? Dữ liệu từ vựng liên quan sẽ bị gỡ bỏ.")) {
      const filtered = sentences.filter(s => s.id !== id);
      save(filtered);
    }
  };

  const filterChineseOnly = (text: string) => {
    return text.replace(/[^\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\n\r\s]/g, '').trim();
  };

  const currentList = sentences.filter(s => !!s.mastered === showMastered);

  return (
    <div className="px-5 pb-28 pt-4 max-w-lg mx-auto bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Luyện Đọc AI</h2>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black shadow-lg active:scale-95 transition-all text-[10px] tracking-widest disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'ĐANG QUÉT...' : 'QUÉT ẢNH'}
        </button>
        <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleFileUpload} />
      </div>

      <div className="bg-slate-50 p-5 rounded-[28px] mb-6 border border-slate-100 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tốc độ đọc: {playbackSpeed}x</span>
          <div className="flex gap-1">
            {[0.8, 1.0, 1.2].map(s => (
              <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>{s}x</button>
            ))}
          </div>
        </div>
        <input type="range" min="0.5" max="2.0" step="0.1" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-2xl">
        <button onClick={() => setShowMastered(false)} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${!showMastered ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>ĐANG HỌC ({sentences.filter(s => !s.mastered).length})</button>
        <button onClick={() => setShowMastered(true)} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${showMastered ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>ĐÃ THUỘC ({sentences.filter(s => s.mastered).length})</button>
      </div>

      <div className="space-y-12">
        {currentList.length === 0 ? (
          <div className="py-20 text-center">
             <div className="text-4xl mb-4">📖</div>
             <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Không có bài học nào</p>
          </div>
        ) : currentList.map((s, idx) => (
          <div key={s.id} className="relative group animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-5">
               <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md">BÀI {idx + 1}</span>
               <div className="flex gap-2">
                 <button onClick={() => deleteLesson(s.id)} className="w-9 h-9 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl active:scale-90 transition-transform">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                 </button>
                 <button onClick={() => speakText(s.chinese, 'cn', playbackSpeed)} className="w-9 h-9 flex items-center justify-center bg-blue-100 text-blue-600 rounded-xl active:scale-90 transition-transform"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>
                 <button onClick={() => toggleMastered(s.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${s.mastered ? 'bg-green-500 text-white' : 'bg-emerald-50 text-emerald-500'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></button>
               </div>
            </div>

            <div className="mb-6">
              <h4 className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-4">TỪ VỰNG TRONG BÀI</h4>
              <div className="flex flex-wrap gap-x-3 gap-y-6 items-end">
                {s.words.map((w, wIdx) => (
                  <div key={wIdx} className="flex flex-col items-center cursor-pointer group active:opacity-60" onClick={() => setSelectedWord(w)}>
                    <span className="text-[8px] font-black text-blue-400 uppercase mb-0.5">{w.pinyin}</span>
                    <span className="text-2xl font-black text-slate-950 chinese-font leading-none">{w.text}</span>
                    <span className="text-[7px] font-black text-slate-300 uppercase mt-1 tracking-tighter">{w.hanViet}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 p-6 bg-slate-900 rounded-[28px] shadow-lg relative overflow-hidden">
              <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4">VĂN BẢN GỐC</h4>
              <p className="text-white text-2xl font-black leading-relaxed chinese-font whitespace-pre-wrap">{filterChineseOnly(s.chinese)}</p>
            </div>
            
            <div className="mb-6 border-l-4 border-blue-100 pl-4 py-0.5">
              <h4 className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">PHIÊN ÂM</h4>
              <p className="text-blue-600 text-sm font-black italic leading-snug tracking-tight">{s.pinyin}</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-[28px] border border-slate-100/50">
              <h4 className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">DỊCH NGHĨA</h4>
              <p className="text-slate-800 font-bold text-sm leading-relaxed">{s.meaning}</p>
            </div>

            {idx !== currentList.length - 1 && <div className="mt-12 border-b border-slate-100"></div>}
          </div>
        ))}
      </div>

      {selectedWord && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 z-[100]" onClick={() => setSelectedWord(null)}>
          <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center border-b-[8px] border-blue-600" onClick={e => e.stopPropagation()}>
            <h3 className="text-6xl font-black mb-6 chinese-font text-slate-950 tracking-tighter">{selectedWord.text}</h3>
            <div className="flex flex-col gap-1 mb-6">
              <span className="text-blue-600 font-black text-xl uppercase tracking-tighter">{selectedWord.pinyin}</span>
              <span className="text-rose-500 font-black text-lg uppercase tracking-widest">{selectedWord.hanViet}</span>
            </div>
            <p className="text-slate-600 text-lg font-bold mb-8 leading-tight">{selectedWord.meaning}</p>
            <div className="flex gap-3">
              <button onClick={() => speakText(selectedWord.text, 'cn')} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] shadow-lg active:scale-95">NGHE</button>
              <button onClick={() => setSelectedWord(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px]">ĐÓNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};