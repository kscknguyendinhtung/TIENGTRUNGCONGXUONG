
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppTab, USERS, SentenceAnalysis, Flashcard } from './types';
import { FlashcardView } from './components/FlashcardView';
import { ReadingView } from './components/ReadingView';
import { GrammarView } from './components/GrammarView';
import { syncVocabData, syncReadingData, fetchFromScript, fetchPublicSheetCsv } from './services/geminiService';

const DEFAULT_READING_SCRIPT = "https://script.google.com/macros/s/AKfycbzdN-mfGNk1Q4vNekSzxVl7msBzJDaMwhjoQTJpW1b6x7vq-GF3fjWyTgxvFI9phVtrHA/exec";
const DEFAULT_VOCAB_SCRIPT = "https://script.google.com/macros/s/AKfycbxN75HBHoEdyp1WV8Lrh18WyDoWNkBgpwzi2S6Q9BjIC35_BXzWBLFGVKoXzs37CsY3/exec";
const TONY_SHEET_URL = "https://docs.google.com/spreadsheets/d/1lm5zQSzWfqayTM8nJttDLqwIfmRN7FeOIfT9HthYQqg/edit";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.USER_SELECT);
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('current_user'));
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [dataVersion, setDataVersion] = useState(0); // Dùng để force refresh các view
  
  // Script 1: Reading/Grammar
  const [readingScriptUrl, setReadingScriptUrl] = useState(() => {
    return localStorage.getItem('reading_script_url') || DEFAULT_READING_SCRIPT;
  });

  // Script 2: Vocabulary
  const [vocabScriptUrl, setVocabScriptUrl] = useState(() => {
    return localStorage.getItem('vocab_script_url') || DEFAULT_VOCAB_SCRIPT;
  });
  
  const [sheetUrl, setSheetUrl] = useState(() => {
    const user = localStorage.getItem('current_user');
    if (user === 'Tony') return TONY_SHEET_URL;
    return user ? (localStorage.getItem(`sheet_url_${user}`) || "") : "";
  });
  
  const [syncState, setSyncState] = useState<'idle' | 'pending' | 'syncing' | 'error'>('idle');
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stats, setStats] = useState({ vocabCount: 0, masteredCount: 0, lessonsCount: 0 });

  const loadStats = useCallback((user: string) => {
    const readingData = JSON.parse(localStorage.getItem(`reading_${user}`) || '[]');
    const masteryData = JSON.parse(localStorage.getItem(`mastery_${user}`) || '{}');
    const manualData = JSON.parse(localStorage.getItem(`manual_words_${user}`) || '[]');
    
    const uniqueWords = new Set();
    readingData.forEach((s: SentenceAnalysis) => s.words?.forEach(w => uniqueWords.add(w.text)));
    manualData.forEach((m: any) => uniqueWords.add(m.word));

    const masteredCount = Object.values(masteryData).filter(v => v === true).length;

    setStats({
      vocabCount: uniqueWords.size,
      masteredCount: masteredCount,
      lessonsCount: readingData.length
    });
  }, []);

  const loadCloudData = async (user: string) => {
    setSyncState('syncing');
    console.log("Đang tải dữ liệu Cloud cho:", user);
    
    try {
      // Tải song song từ cả 2 Script
      const [readingRes, vocabRes] = await Promise.all([
        fetchFromScript(readingScriptUrl, user),
        fetchFromScript(vocabScriptUrl, user)
      ]);

      let hasUpdate = false;

      // 1. Xử lý Script 1 (Luyện đọc & Ngữ pháp)
      if (readingRes && readingRes.reading && Array.isArray(readingRes.reading)) {
        localStorage.setItem(`reading_${user}`, JSON.stringify(readingRes.reading));
        console.log(`Đã tải ${readingRes.reading.length} bài học từ Script 1`);
        hasUpdate = true;
      }

      // 2. Xử lý Script 2 (Từ vựng & Tiến độ)
      if (vocabRes && vocabRes.cards && Array.isArray(vocabRes.cards)) {
         const restoredCards: Flashcard[] = vocabRes.cards.map((d: any, i: number) => ({
             id: `restored-${i}-${Date.now()}`,
             word: d.word,
             pinyin: d.pinyin,
             hanViet: d.hanViet,
             meaning: d.meaning,
             category: d.category,
             mastered: d.mastered,
             isManual: true
         }));
         localStorage.setItem(`manual_words_${user}`, JSON.stringify(restoredCards));
         
         const newMastery: Record<string, boolean> = {};
         restoredCards.forEach(c => {
             if (c.mastered) newMastery[c.word] = true;
         });
         localStorage.setItem(`mastery_${user}`, JSON.stringify(newMastery));
         console.log(`Đã tải ${restoredCards.length} từ vựng từ Script 2`);
         hasUpdate = true;
      }

      if (hasUpdate) {
        setDataVersion(v => v + 1); // Kích hoạt làm mới các View
        loadStats(user);
        setSyncState('idle');
      } else {
        // Nếu không có dữ liệu trên Script, thử fallback về Sheet CSV
        if (sheetUrl) {
          await triggerCloudRestoreFromSheet(user);
        } else {
          setSyncState('idle');
        }
      }

    } catch (e) {
      console.error("Lỗi khi tải dữ liệu cloud", e);
      setSyncState('error');
    }
  };

  const triggerCloudRestoreFromSheet = async (user: string) => {
    if (!sheetUrl) return;
    try {
        const cloudData = await fetchPublicSheetCsv(sheetUrl);
        if (cloudData && cloudData.length > 0) {
            const restoredCards: Flashcard[] = cloudData.map((d, i) => ({
                id: `restored-csv-${i}`,
                word: d.word,
                pinyin: d.pinyin,
                hanViet: d.hanViet,
                meaning: d.meaning,
                category: d.category,
                mastered: d.mastered,
                isManual: true
            }));
            localStorage.setItem(`manual_words_${user}`, JSON.stringify(restoredCards));
            const newMastery: Record<string, boolean> = {};
            restoredCards.forEach(c => { if (c.mastered) newMastery[c.word] = true; });
            localStorage.setItem(`mastery_${user}`, JSON.stringify(newMastery));
            setDataVersion(v => v + 1);
            loadStats(user);
        }
        setSyncState('idle');
    } catch(e) { 
      setSyncState('error'); 
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('reading_script_url')) {
       localStorage.setItem('reading_script_url', DEFAULT_READING_SCRIPT);
       setReadingScriptUrl(DEFAULT_READING_SCRIPT);
    }
    if (!localStorage.getItem('vocab_script_url')) {
       localStorage.setItem('vocab_script_url', DEFAULT_VOCAB_SCRIPT);
       setVocabScriptUrl(DEFAULT_VOCAB_SCRIPT);
    }

    if (currentUser) {
       loadStats(currentUser);
       loadCloudData(currentUser);
    }
  }, [currentUser]); 

  const triggerCloudBackup = useCallback((user: string) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setSyncState('pending');

    syncTimeoutRef.current = setTimeout(async () => {
      setSyncState('syncing');
      try {
        const manualData: Flashcard[] = JSON.parse(localStorage.getItem(`manual_words_${user}`) || '[]');
        const masteryData: Record<string, boolean> = JSON.parse(localStorage.getItem(`mastery_${user}`) || '{}');
        const vocabPayload = manualData.map(c => ({ ...c, mastered: !!masteryData[c.word] }));
        const readingData: SentenceAnalysis[] = JSON.parse(localStorage.getItem(`reading_${user}`) || '[]');

        await Promise.all([
          vocabScriptUrl ? syncVocabData(vocabScriptUrl, user, vocabPayload) : Promise.resolve(),
          readingScriptUrl ? syncReadingData(readingScriptUrl, user, readingData) : Promise.resolve()
        ]);
        
        setSyncState('idle');
        loadStats(user);
      } catch (e) {
        console.error("Lưu dữ liệu thất bại", e);
        setSyncState('error');
      }
    }, 2000);
  }, [vocabScriptUrl, readingScriptUrl, loadStats]);


  const selectUser = async (user: string) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', user);
    
    let newSheetUrl = "";
    if (user === 'Tony') {
      newSheetUrl = TONY_SHEET_URL;
    } else {
      newSheetUrl = localStorage.getItem(`sheet_url_${user}`) || "";
    }
    
    setSheetUrl(newSheetUrl);
    localStorage.setItem('global_sheet_url', newSheetUrl);
    setActiveTab(AppTab.HOME);
    loadCloudData(user);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    setActiveTab(AppTab.USER_SELECT);
  };

  if (activeTab === AppTab.USER_SELECT) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-blue-600 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-rose-600 blur-[120px] rounded-full"></div>
        </div>

        <div className="relative z-10 text-center mb-10 w-full">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_-12px_rgba(37,99,235,0.5)]">
            <span className="text-4xl font-black italic">文</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Zhongwen Master</h1>
          <p className="text-slate-500 font-black uppercase text-[9px] tracking-[0.4em]">Tiếng Trung Công Xưởng</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm relative z-10">
          {USERS.map(user => (
            <button 
              key={user}
              onClick={() => selectUser(user)}
              className="group bg-white/5 hover:bg-blue-600 backdrop-blur-md p-6 rounded-[32px] font-black transition-all border border-white/10 hover:border-blue-400 shadow-xl active:scale-95 text-center"
            >
              <div className="text-xl mb-1">{user}</div>
              <div className="text-[7px] opacity-40 uppercase tracking-widest font-black">Nhấn để vào</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Dùng key={dataVersion} để force re-mount khi dữ liệu cloud được tải về
    switch (activeTab) {
      case AppTab.VOCABULARY: 
        return <FlashcardView 
          key={`vocab-${dataVersion}`}
          currentUser={currentUser!} 
          onDataChange={() => triggerCloudBackup(currentUser!)}
          sheetUrl={sheetUrl}
          scriptUrl={vocabScriptUrl}
        />;
      case AppTab.READING: 
        return <ReadingView 
          key={`reading-${dataVersion}`}
          currentUser={currentUser!} 
          onDataChange={() => triggerCloudBackup(currentUser!)} 
        />;
      case AppTab.GRAMMAR: 
        return <GrammarView 
          key={`grammar-${dataVersion}`}
          currentUser={currentUser!} 
          onDataChange={() => triggerCloudBackup(currentUser!)} 
        />;
      default:
        return (
          <div className="px-5 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/10">
                    {currentUser?.charAt(0)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-[3px] border-slate-50 rounded-full"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Chào, {currentUser}!</h1>
                  <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-1">Chọn kỹ năng học tập</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSyncModal(true)} className="w-10 h-10 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
                <button onClick={logout} className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl shadow-sm flex items-center justify-center text-rose-400 active:scale-90 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </button>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-3">
               {[
                 { label: 'Từ vựng', val: stats.vocabCount, color: 'rose' },
                 { label: 'Đã thuộc', val: stats.masteredCount, color: 'emerald' },
                 { label: 'Bài học', val: stats.lessonsCount, color: 'blue' }
               ].map(s => (
                 <div key={s.label} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm text-center">
                   <div className={`text-xl font-black mb-0.5 text-${s.color}-600`}>{s.val}</div>
                   <div className="text-[7px] font-black uppercase text-slate-400 tracking-widest">{s.label}</div>
                 </div>
               ))}
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
               <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-600/20 rounded-full blur-[60px]"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-3">
                   <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                       syncState === 'syncing' ? 'bg-amber-400 animate-pulse' : 
                       syncState === 'pending' ? 'bg-blue-400' :
                       syncState === 'error' ? 'bg-rose-500' : 'bg-emerald-400'
                   }`}></div>
                   <h3 className="text-[8px] font-black uppercase tracking-[0.3em] opacity-60">
                       {syncState === 'syncing' ? 'ĐANG ĐỒNG BỘ...' : 
                        syncState === 'pending' ? 'CHỜ LƯU...' : 
                        syncState === 'error' ? 'LỖI ĐỒNG BỘ' : 'ĐÃ KẾT NỐI'}
                   </h3>
                </div>
                <p className="text-xl font-black leading-tight mb-6 max-w-[200px]">Dữ liệu tự động tải khi mở App và lưu sau 2 giây.</p>
                <div className="flex gap-2">
                    <button 
                    onClick={() => triggerCloudBackup(currentUser!)} 
                    disabled={syncState === 'syncing'}
                    className="bg-white text-slate-900 px-6 py-4 rounded-2xl font-black text-[10px] shadow-lg active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 flex-1 justify-center"
                    >
                    {syncState === 'syncing' ? (
                        <div className="w-3 h-3 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    )}
                    LƯU NGAY
                    </button>
                    <button 
                    onClick={() => loadCloudData(currentUser!)} 
                    disabled={syncState === 'syncing'}
                    className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] shadow-lg active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 flex-1 justify-center"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8"/></svg>
                    TẢI VỀ
                    </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 pt-1 pb-24">
              {[
                { tab: AppTab.VOCABULARY, color: 'rose', char: '字', title: 'Học Từ Vựng', sub: 'Flashcards & Mindmap' },
                { tab: AppTab.GRAMMAR, color: 'emerald', char: '法', title: 'Học Ngữ Pháp', sub: 'Grammar AI Analysis' },
                { tab: AppTab.READING, color: 'blue', char: '阅', title: 'Luyện Đọc AI', sub: 'OCR & Translation' }
              ].map(item => (
                <button 
                  key={item.tab} 
                  onClick={() => setActiveTab(item.tab)} 
                  className={`bg-white p-5 rounded-[32px] border border-slate-100 flex items-center justify-between group transition-all shadow-sm active:scale-[0.98] text-left`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 bg-slate-50 text-slate-300 rounded-[20px] flex items-center justify-center text-3xl font-black group-hover:bg-${item.color}-600 group-hover:text-white transition-all`}>{item.char}</div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-0.5">{item.title}</h2>
                      <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{item.sub}</p>
                    </div>
                  </div>
                  <div className={`w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto shadow-2xl flex flex-col relative font-sans">
      <main className="flex-grow">{renderContent()}</main>
      
      {activeTab !== AppTab.USER_SELECT && syncState !== 'idle' && (
         <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
             <div className={`w-1.5 h-1.5 rounded-full ${syncState === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`}></div>
             <span className="text-[7px] font-black text-white uppercase tracking-widest">
                {syncState === 'syncing' ? 'Đang tải...' : 'Chờ lưu...'}
             </span>
         </div>
      )}
      
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
          <div className="bg-white w-full max-w-sm p-8 rounded-[40px] shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-1 text-slate-900 tracking-tighter uppercase">Cài đặt Cloud</h2>
            <p className="text-slate-400 text-[10px] font-bold mb-8 uppercase tracking-wider">Cấu hình URL để đồng bộ dữ liệu.</p>
            <div className="space-y-6">
              
              <div>
                <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1 mb-2 block">Script 1: Luyện đọc & Ngữ pháp (Nặng)</label>
                <input 
                  type="text" 
                  value={readingScriptUrl} 
                  onChange={(e) => {
                    setReadingScriptUrl(e.target.value);
                    localStorage.setItem('reading_script_url', e.target.value);
                  }}
                  placeholder="https://script.google.com/..."
                  className="w-full px-5 py-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-bold text-xs focus:border-blue-500 shadow-inner text-blue-900"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1 mb-2 block">Script 2: Từ vựng & Tiến độ (Nhẹ)</label>
                <input 
                  type="text" 
                  value={vocabScriptUrl} 
                  onChange={(e) => {
                    setVocabScriptUrl(e.target.value);
                    localStorage.setItem('vocab_script_url', e.target.value);
                  }}
                  placeholder="https://script.google.com/..."
                  className="w-full px-5 py-4 bg-rose-50 border border-rose-100 rounded-2xl outline-none font-bold text-xs focus:border-rose-500 shadow-inner text-rose-900"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Google Sheets URL (Public CSV)</label>
                <input 
                  type="text" 
                  value={sheetUrl} 
                  onChange={(e) => {
                    setSheetUrl(e.target.value);
                    localStorage.setItem('global_sheet_url', e.target.value);
                    if (currentUser) {
                        localStorage.setItem(`sheet_url_${currentUser}`, e.target.value);
                    }
                  }}
                  placeholder={currentUser === 'Tony' ? "Mặc định (Tony)" : "https://docs.google.com/spreadsheets/d/..."}
                  disabled={currentUser === 'Tony'}
                  className={`w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs focus:border-blue-500 shadow-inner ${currentUser === 'Tony' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

            </div>
            <button onClick={() => setShowSyncModal(false)} className="w-full mt-8 py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-lg active:scale-95 transition-all uppercase">Lưu & Đóng</button>
          </div>
        </div>
      )}

      {activeTab !== AppTab.USER_SELECT && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 py-3 px-6 flex justify-around max-w-lg mx-auto z-40 rounded-t-[40px] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          {[
            { tab: AppTab.HOME, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
            { tab: AppTab.VOCABULARY, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Học Từ' },
            { tab: AppTab.GRAMMAR, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: 'Ngữ Pháp' },
            { tab: AppTab.READING, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: 'Quét AI' },
          ].map(item => (
            <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`flex flex-col items-center transition-all duration-300 ${activeTab === item.tab ? 'text-blue-600' : 'text-slate-300'}`}>
              <div className={`p-2.5 rounded-2xl transition-all ${activeTab === item.tab ? 'bg-blue-50' : 'bg-transparent'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg>
              </div>
              <span className={`text-[8px] font-black mt-0.5 uppercase tracking-widest transition-opacity ${activeTab === item.tab ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;
