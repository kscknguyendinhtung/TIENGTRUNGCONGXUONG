
import React, { useState } from 'react';
import { analyzeImageAndExtractText, speakText } from '../services/geminiService';
import { SentenceAnalysis } from '../types';

interface GrammarViewProps { 
  currentUser: string;
  sentences: SentenceAnalysis[]; // Nhận trực tiếp từ App.tsx
  onDataChange?: () => void;
}

export const GrammarView: React.FC<GrammarViewProps> = ({ currentUser, sentences, onDataChange }) => {
  const [loading, setLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<any>(null);

  const handleProcess = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    const base64Promises = files.map((file: File) => new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string || "").split(',')[1] || "");
      reader.readAsDataURL(file);
    }));
    const base64Images = await Promise.all(base64Promises);
    try {
      const result = await analyzeImageAndExtractText(base64Images);
      const withIds = result.map((s, idx) => ({ ...s, id: `grammar-${Date.now()}-${idx}`, mastered: false }));
      
      const updated = [...withIds, ...sentences];
      localStorage.setItem(`reading_${currentUser}`, JSON.stringify(updated));
      if (onDataChange) onDataChange();
    } catch (err) {
      alert("Lỗi phân tích ngữ pháp.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 py-4 max-w-lg mx-auto pb-28">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-emerald-600 tracking-tight uppercase">Phân tích Ngữ pháp</h2>
        <div className="flex gap-2">
          <input type="file" id="grammar-upload" hidden multiple onChange={handleProcess} />
          <label htmlFor="grammar-upload" className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black cursor-pointer shadow-lg active:scale-95 transition-all uppercase tracking-widest">
            {loading ? 'ĐANG QUÉT...' : 'QUÉT NGỮ PHÁP'}
          </label>
        </div>
      </div>

      {sentences.length === 0 && (
        <div className="text-center py-16 bg-emerald-50 rounded-[32px] border-2 border-dashed border-emerald-100">
           <p className="text-emerald-300 font-black text-[10px] uppercase tracking-widest">Chưa có bài học - Hãy bấm Tải về ở Home</p>
        </div>
      )}

      <div className="space-y-6">
        {sentences.map((s, idx) => (
          <div key={s.id || idx} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 border-l-[8px] border-l-emerald-500 overflow-hidden">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[8px] font-black bg-slate-900 text-white px-3 py-1 rounded-full uppercase tracking-widest">BÀI {idx + 1}</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-7 mb-8 items-end">
              {s.words.map((w, wIdx) => (
                <div key={wIdx} className="flex flex-col items-center cursor-pointer group active:opacity-60 text-center" onClick={() => setSelectedWord(w)}>
                  <span className="text-[8px] text-rose-500 font-black mb-1 uppercase tracking-tighter leading-none">{w.pinyin}</span>
                  <span className="text-2xl font-black chinese-font leading-none">{w.text}</span>
                  <span className="text-[8px] text-slate-300 font-bold uppercase mt-1 tracking-widest leading-none">{w.hanViet}</span>
                  <span className="text-[7px] font-bold text-emerald-600 uppercase mt-1 tracking-tight line-clamp-1 leading-none">{w.meaning}</span>
                </div>
              ))}
            </div>
            
            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 relative pt-8">
              <div className="absolute top-0 right-6 translate-y-[-50%] bg-emerald-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md">
                Cấu trúc
              </div>
              <ul className="space-y-6">
                {s.grammarPoints.map((gp, gIdx) => (
                  <li key={gIdx} className="text-slate-700 flex items-start gap-4">
                    <span className="bg-white border border-emerald-100 text-emerald-600 w-6 h-6 rounded-lg flex shrink-0 items-center justify-center text-[10px] font-black shadow-sm">{gIdx + 1}</span>
                    <div className="flex-1">
                      <p className="text-slate-800 font-bold text-[13px] leading-relaxed whitespace-pre-line">{gp}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {selectedWord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50" onClick={() => setSelectedWord(null)}>
          <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center border-b-[8px] border-emerald-500" onClick={e => e.stopPropagation()}>
            <h3 className="text-6xl font-black mb-5 chinese-font text-slate-800 tracking-tighter">{selectedWord.text}</h3>
            <div className="flex flex-col items-center gap-0.5 mb-6">
              <p className="text-emerald-600 font-black text-xl uppercase tracking-tighter">{selectedWord.pinyin}</p>
              <p className="text-rose-500 font-black text-lg uppercase tracking-[0.1em]">{selectedWord.hanViet}</p>
            </div>
            <p className="text-slate-600 text-lg font-bold mb-8 leading-snug">{selectedWord.meaning}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => speakText(selectedWord.text, 'cn')} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] active:scale-95 shadow-lg transition">NGHE</button>
              <button onClick={() => setSelectedWord(null)} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] active:scale-95 transition">ĐÓNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
