
import React, { useState, useEffect, useMemo } from 'react';
import { MindmapCategory } from '../types';
import { generateMindmap, speakText } from '../services/geminiService';

interface WordData {
  text: string;
  pinyin: string;
  meaning: string;
  hanViet: string;
}

interface MindmapViewProps {
  words: WordData[];
  user: string;
  onClose: () => void;
}

const LOADING_STEPS = [
  "Khởi tạo AI Engine...",
  "Phân loại ngữ pháp & chuyên ngành...",
  "Sắp xếp cấu trúc Mindmap...",
  "Hoàn tất xử lý..."
];

export const MindmapView: React.FC<MindmapViewProps> = ({ words, user, onClose }) => {
  const [mindmap, setMindmap] = useState<MindmapCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [masteryMap, setMasteryMap] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'mastered' | 'unmastered'>('all');

  // Create a local lookup map for "re-hydration"
  const localWordLookup = useMemo(() => {
    const map: Record<string, WordData> = {};
    words.forEach(w => {
      map[w.text] = w;
    });
    return map;
  }, [words]);

  useEffect(() => {
    const saved = localStorage.getItem(`mindmap_${user}`);
    if (saved) {
      try {
        const parsed: MindmapCategory[] = JSON.parse(saved);
        // Re-hydrate saved data with latest word info just in case
        const hydrated = parsed.map(cat => ({
          ...cat,
          words: cat.words.map(w => localWordLookup[w.text] || w)
        }));
        setMindmap(hydrated);
        setExpandedNodes(hydrated.map((d: any) => d.name));
      } catch (e) {
        setMindmap([]);
      }
    }
    
    const mastery = localStorage.getItem(`mastery_${user}`);
    if (mastery) setMasteryMap(JSON.parse(mastery));
  }, [user, localWordLookup]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
        setProgress(prev => (prev < 95 ? prev + Math.random() * 20 : prev));
      }, 1000);
    } else {
      setLoadingStep(0);
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const toggleNode = (name: string) => {
    setExpandedNodes(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleGenerate = async () => {
    if (words.length === 0) return alert("Không có từ vựng nào để phân tích!");
    setLoading(true);
    setProgress(5);
    try {
      const data = await generateMindmap(words);
      
      // CRITICAL: Re-hydrate AI results with local data to prevent empty fields
      const hydratedData = data.map(category => ({
        ...category,
        words: category.words.map(aiWord => {
          const localMatch = localWordLookup[aiWord.text];
          return localMatch ? { ...localMatch } : aiWord;
        })
      }));

      setMindmap(hydratedData);
      localStorage.setItem(`mindmap_${user}`, JSON.stringify(hydratedData));
      setExpandedNodes(hydratedData.map(d => d.name));
      setProgress(100);
    } catch (e) {
      console.error(e);
      alert("Lỗi AI. Vui lòng thử lại.");
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const filteredMindmap = useMemo(() => {
    return mindmap.map(cat => ({
      ...cat,
      words: cat.words.filter(w => {
        const isMastered = !!masteryMap[w.text];
        if (filter === 'mastered') return isMastered;
        if (filter === 'unmastered') return !isMastered;
        return true;
      })
    })).filter(cat => cat.words.length > 0);
  }, [mindmap, masteryMap, filter]);

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-none">Cây Thư Mục AI</h2>
            <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sắp xếp Logic & Chuyên ngành</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] tracking-widest shadow-md active:scale-95 disabled:opacity-50 uppercase"
          >
            {loading ? "ĐANG QUÉT..." : "PHÂN LOẠI LẠI"}
          </button>
          <button onClick={onClose} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 active:scale-90 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex gap-2">
        <button 
          onClick={() => setFilter('all')}
          className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          TẤT CẢ
        </button>
        <button 
          onClick={() => setFilter('mastered')}
          className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${filter === 'mastered' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          ĐÃ THUỘC
        </button>
        <button 
          onClick={() => setFilter('unmastered')}
          className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${filter === 'unmastered' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          CHƯA THUỘC
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-5 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-10 text-center animate-in fade-in">
             <div className="w-full max-w-xs space-y-6">
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${progress}%` }}></div>
                </div>
                <div>
                   <p className="text-slate-900 font-black text-[11px] uppercase tracking-widest mb-1">{LOADING_STEPS[loadingStep]}</p>
                   <p className="text-indigo-500 text-[9px] font-bold uppercase tracking-widest">{Math.round(progress)}%</p>
                </div>
             </div>
          </div>
        )}

        {filteredMindmap.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
               <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest mb-8 text-center max-w-[200px]">
              {mindmap.length === 0 ? "Nhấn nút để AI tự động sắp xếp từ vựng vào các thư mục Ngữ pháp & Công xưởng" : "Không tìm thấy từ vựng nào phù hợp với bộ lọc này"}
            </p>
            {mindmap.length === 0 && (
              <button onClick={handleGenerate} className="bg-slate-900 text-white px-10 py-5 rounded-[24px] font-black text-[11px] tracking-widest uppercase shadow-xl active:scale-95">Bắt đầu phân loại AI</button>
            )}
            {mindmap.length > 0 && (
              <button onClick={() => setFilter('all')} className="bg-slate-900 text-white px-10 py-4 rounded-[20px] font-black text-[10px] tracking-widest uppercase shadow-xl active:scale-95">Xem tất cả</button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-12">
            {filteredMindmap.map((cat, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                <button 
                  onClick={() => toggleNode(cat.name)}
                  className="w-full px-6 py-5 flex justify-between items-center transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-[10px] font-black uppercase shadow-lg shadow-slate-200">
                      {cat.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <span className="text-base font-black text-slate-800 tracking-tight uppercase">{cat.name}</span>
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{cat.words.length} mục từ</p>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-slate-300 transition-transform ${expandedNodes.includes(cat.name) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                
                {expandedNodes.includes(cat.name) && (
                  <div className="p-4 grid grid-cols-1 gap-3 border-t border-slate-50 animate-in slide-in-from-top-2">
                    {cat.words.map((w, wIdx) => {
                      const isMastered = !!masteryMap[w.text];
                      return (
                        <div key={wIdx} className={`p-5 rounded-[28px] border flex justify-between items-center transition-all active:scale-[0.98] ${isMastered ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <div className="flex-1 space-y-2">
                            {/* Line 1: Hán ngữ */}
                            <div className="flex items-center gap-3">
                              <span className={`text-3xl font-black chinese-font leading-none ${isMastered ? 'text-emerald-700' : 'text-slate-900'}`}>{w.text}</span>
                              {isMastered && <span className="bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black shadow-md">✓</span>}
                            </div>
                            
                            <div className="grid grid-cols-1 gap-1">
                                {/* Line 2: Pinyin */}
                                <div className="flex items-center gap-2">
                                   <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest w-12 shrink-0">Pinyin</span>
                                   <span className="text-[11px] font-black text-rose-600 uppercase tracking-tighter">{w.pinyin || '---'}</span>
                                </div>

                                {/* Line 3: Hán Việt */}
                                <div className="flex items-center gap-2">
                                   <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest w-12 shrink-0">Hán Việt</span>
                                   <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase leading-none tracking-tighter">{w.hanViet || '---'}</span>
                                </div>

                                {/* Line 4: Nghĩa Việt */}
                                <div className="flex items-start gap-2 pt-0.5">
                                   <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest w-12 shrink-0 mt-0.5">Nghĩa</span>
                                   <p className="text-[12px] font-bold text-slate-600 leading-tight">{w.meaning || '---'}</p>
                                </div>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => speakText(w.text, 'cn')}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all ${isMastered ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-300 border border-slate-100 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100'}`}
                          >
                             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Summary */}
      <div className="bg-white border-t border-slate-100 px-8 py-5 flex justify-between items-center shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
         <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
               <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Đã thuộc</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
               <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Đang học</span>
            </div>
         </div>
         <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">{filteredMindmap.reduce((acc, cat) => acc + cat.words.length, 0)} TỪ VỰNG</span>
      </div>
    </div>
  );
};
