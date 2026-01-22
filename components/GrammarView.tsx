
import React, { useState, useEffect } from 'react';
import { analyzeImageAndExtractText, speakText } from '../services/geminiService';
import { SentenceAnalysis } from '../types';

interface GrammarViewProps { currentUser: string; }

export const GrammarView: React.FC<GrammarViewProps> = ({ currentUser }) => {
  const [data, setData] = useState<SentenceAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`reading_${currentUser}`);
    if (saved) setData(JSON.parse(saved));
  }, [currentUser]);

  const handleProcess = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const updated = [...data, ...result];
      setData(updated);
      localStorage.setItem(`reading_${currentUser}`, JSON.stringify(updated));
    } catch (err) {
      alert("Lỗi phân tích ngữ pháp.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-emerald-600 tracking-tight uppercase">Phân tích Ngữ pháp</h2>
        <div className="flex gap-2">
          <input type="file" id="grammar-upload" hidden multiple onChange={handleProcess} />
          <label htmlFor="grammar-upload" className="bg-emerald-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black cursor-pointer shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">
            {loading ? 'ĐANG QUÉT...' : 'QUÉT NGỮ PHÁP'}
          </label>
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center py-20 bg-emerald-50 rounded-[40px] border-2 border-dashed border-emerald-100">
           <p className="text-emerald-300 font-black text-xs uppercase tracking-widest">Chưa có dữ liệu phân tích</p>
        </div>
      )}

      <div className="space-y-8">
        {data.map((s, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 border-l-[12px] border-l-emerald-500 overflow-hidden">
            {/* Header mục */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase tracking-widest">BÀI HỌC {idx + 1}</span>
            </div>

            {/* Khối Ruby-style words */}
            <div className="flex flex-wrap gap-x-5 gap-y-10 mb-10 items-end">
              {s.words.map((w, wIdx) => (
                <div key={wIdx} className="flex flex-col items-center cursor-pointer group" onClick={() => setSelectedWord(w)}>
                  <span className="text-[9px] text-red-500 font-black mb-1.5 uppercase tracking-tighter leading-none">{w.pinyin}</span>
                  <span className="text-3xl font-black chinese-font group-hover:text-emerald-600 transition-colors leading-none">{w.text}</span>
                  <span className="text-[9px] text-slate-300 font-bold uppercase mt-2 tracking-widest leading-none">{w.hanViet}</span>
                </div>
              ))}
            </div>
            
            {/* Phân tích ngữ pháp chi tiết */}
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 relative">
              <div className="absolute top-0 right-10 translate-y-[-50%] bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md">
                Cấu trúc điểm nhấn
              </div>
              <ul className="space-y-8">
                {s.grammarPoints.map((gp, gIdx) => (
                  <li key={gIdx} className="text-slate-700 flex items-start gap-5">
                    <span className="bg-white border-2 border-emerald-100 text-emerald-600 w-8 h-8 rounded-2xl flex shrink-0 items-center justify-center text-xs font-black shadow-sm">{gIdx + 1}</span>
                    <div className="flex-1">
                      <p className="text-slate-800 font-bold text-base leading-relaxed whitespace-pre-line">
                        {gp}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {selectedWord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setSelectedWord(null)}>
          <div className="bg-white p-10 rounded-[48px] shadow-2xl max-w-sm w-full text-center border-b-[12px] border-emerald-500" onClick={e => e.stopPropagation()}>
            <h3 className="text-7xl font-black mb-6 chinese-font text-slate-800 tracking-tighter">{selectedWord.text}</h3>
            <div className="flex flex-col items-center gap-1 mb-8">
              <p className="text-emerald-600 font-black text-2xl uppercase tracking-tighter">{selectedWord.pinyin}</p>
              <p className="text-red-500 font-black text-xl uppercase tracking-[0.2em]">{selectedWord.hanViet}</p>
            </div>
            <p className="text-slate-600 text-xl font-bold mb-10 leading-snug">{selectedWord.meaning}</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => speakText(selectedWord.text, 'cn')} className="py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs active:scale-95 shadow-lg shadow-emerald-100 transition">NGHE TRUNG</button>
              <button onClick={() => setSelectedWord(null)} className="py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs active:scale-95 transition">ĐÓNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
