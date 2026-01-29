import React, { useState, useEffect } from 'react';
import { MindmapCategory } from '../types';
import { generateMindmap } from '../services/geminiService';

interface MindmapViewProps {
  words: {text: string, pinyin: string, meaning: string}[];
  user: string;
  onClose: () => void;
}

const LOADING_STEPS = [
  "Khởi tạo AI Engine...",
  "Thu thập dữ liệu từ vựng...",
  "Phân tích cấu trúc ngữ pháp...",
  "Phân loại theo nhóm chuyên sâu...",
  "Dựng cây sơ đồ tư duy...",
  "Hoàn tất xử lý..."
];

export const MindmapView: React.FC<MindmapViewProps> = ({ words, user, onClose }) => {
  const [mindmap, setMindmap] = useState<MindmapCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [masteryMap, setMasteryMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem(`mindmap_${user}`);
    if (saved) setMindmap(JSON.parse(saved));
    
    const mastery = localStorage.getItem(`mastery_${user}`);
    if (mastery) setMasteryMap(JSON.parse(mastery));
  }, [user]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
        setProgress(prev => (prev < 95 ? prev + Math.random() * 8 : prev));
      }, 1500);
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
      setMindmap(data);
      localStorage.setItem(`mindmap_${user}`, JSON.stringify(data));
      setExpandedNodes(data.map(d => d.name));
      setProgress(100);
    } catch (e) {
      alert("Lỗi kết nối AI. Vui lòng thử lại.");
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[200] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 flex justify-between items-center shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">AI Tree Map</h2>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em]">NotebookLM Style Classification</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-[9px] tracking-widest shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2 uppercase"
          >
            {loading ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : null}
            {loading ? "PROCESSING..." : "GENERATE MAP"}
          </button>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center active:scale-90 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300">
             <div className="w-full max-w-xs space-y-6">
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                     <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
                   <div 
                     className="h-full bg-blue-600 transition-all duration-1000 ease-out"
                     style={{ width: `${progress}%` }}
                   ></div>
                </div>
                <div className="space-y-1">
                   <p className="text-slate-900 font-black text-xs uppercase tracking-widest">{LOADING_STEPS[loadingStep]}</p>
                   <p className="text-blue-500 text-[9px] font-bold uppercase tracking-widest">Progress: {Math.round(progress)}%</p>
                </div>
             </div>
          </div>
        )}

        {mindmap.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="w-32 h-32 bg-white rounded-[40px] flex items-center justify-center mb-8 shadow-sm border border-slate-100">
               <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest max-w-[240px] leading-relaxed">Sơ đồ sẽ phân loại từ vựng theo cấu trúc ngữ pháp thông minh của NotebookLM</p>
            <button onClick={handleGenerate} className="mt-8 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-blue-100 active:scale-95 transition-all">Bắt đầu tạo sơ đồ</button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {mindmap.map((cat, idx) => (
              <div key={idx} className="relative">
                {/* Branch Line for Categories */}
                {idx !== mindmap.length - 1 && (
                   <div className="absolute left-[1.125rem] top-12 bottom-0 w-0.5 bg-slate-200"></div>
                )}
                
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                  <button 
                    onClick={() => toggleNode(cat.name)}
                    className="w-full px-6 py-5 flex justify-between items-center transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center text-[10px] font-black shadow-lg">
                        {cat.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <span className="text-base font-black text-slate-900 tracking-tight uppercase">{cat.name}</span>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{cat.words.length} Vocabulary Items</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1.5">
                        {cat.words.slice(0, 3).map((w, i) => (
                          <div key={i} className={`w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[6px] font-black ${masteryMap[w.text] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {masteryMap[w.text] ? '✓' : ''}
                          </div>
                        ))}
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform duration-500 ${expandedNodes.includes(cat.name) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </button>
                  
                  {expandedNodes.includes(cat.name) && (
                    <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-4 duration-500">
                      <div className="grid grid-cols-1 gap-3 relative">
                        {cat.words.map((w, wIdx) => {
                          const isMastered = !!masteryMap[w.text];
                          return (
                            <div key={wIdx} className="relative pl-8">
                              {/* Horizontal Tree Line */}
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-0.5 bg-slate-100"></div>
                              {/* Vertical Branch Line */}
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-100"></div>
                              
                              <div className={`p-4 rounded-2xl border transition-all flex justify-between items-center group active:scale-[0.98] ${isMastered ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className={`text-lg font-black chinese-font tracking-tight ${isMastered ? 'text-emerald-700' : 'text-slate-900'}`}>{w.text}</span>
                                    {isMastered && (
                                      <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm">✓</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{w.pinyin}</span>
                                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                    <p className="text-[10px] font-bold text-slate-500 leading-tight">{w.meaning}</p>
                                  </div>
                                </div>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isMastered ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-200 border border-slate-100'}`}>
                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center">
         <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <span className="text-[8px] font-black uppercase text-slate-400">Đã thuộc</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-slate-200"></div>
               <span className="text-[8px] font-black uppercase text-slate-400">Đang học</span>
            </div>
         </div>
         <p className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Total: {words.length} Words</p>
      </div>
    </div>
  );
};