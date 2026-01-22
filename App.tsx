import React, { useState, useEffect, useCallback } from 'react';
import { AppTab, USERS, SentenceAnalysis } from './types';
import { FlashcardView } from './components/FlashcardView';
import { ReadingView } from './components/ReadingView';
import { GrammarView } from './components/GrammarView';
import { syncToGoogleSheets, fetchFromGoogleSheets } from './services/geminiService';

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzdN-mfGNk1Q4vNekSzxVl7msBzJDaMwhjoQTJpW1b6x7vq-GF3fjWyTgxvFI9phVtrHA/exec";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.USER_SELECT);
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('current_user'));
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('global_script_url') || DEFAULT_SCRIPT_URL);
  const [syncing, setSyncing] = useState(false);
  
  const [stats, setStats] = useState({ vocabCount: 0, masteredCount: 0, lessonsCount: 0 });

  const loadStats = useCallback((user: string) => {
    const readingData = JSON.parse(localStorage.getItem(`reading_${user}`) || '[]');
    const masteryData = JSON.parse(localStorage.getItem(`mastery_${user}`) || '{}');
    
    const uniqueWords = new Set();
    readingData.forEach((s: SentenceAnalysis) => {
      s.words?.forEach(w => uniqueWords.add(w.text));
    });

    const masteredCount = Object.values(masteryData).filter(v => v === true).length;

    setStats({
      vocabCount: uniqueWords.size,
      masteredCount: masteredCount,
      lessonsCount: readingData.length
    });
  }, []);

  useEffect(() => {
    if (currentUser) loadStats(currentUser);
  }, [currentUser, activeTab, loadStats]);

  const getHanoiTimestamp = () => {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  };

  const triggerCloudBackup = useCallback(async (user: string) => {
    if (!scriptUrl) return;
    setSyncing(true);
    const data = {
      user: user,
      reading: JSON.parse(localStorage.getItem(`reading_${user}`) || '[]'),
      mastery: JSON.parse(localStorage.getItem(`mastery_${user}`) || '{}'),
      timestamp: getHanoiTimestamp()
    };
    await syncToGoogleSheets(scriptUrl, data);
    setSyncing(false);
    loadStats(user);
  }, [scriptUrl, loadStats]);

  const selectUser = async (user: string) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', user);
    setSyncing(true);
    
    const cloudData = await fetchFromGoogleSheets(scriptUrl, user);
    if (cloudData) {
      if (cloudData.reading) localStorage.setItem(`reading_${user}`, JSON.stringify(cloudData.reading));
      if (cloudData.mastery) localStorage.setItem(`mastery_${user}`, JSON.stringify(cloudData.mastery));
    }
    
    setSyncing(false);
    loadStats(user);
    setActiveTab(AppTab.HOME);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    setActiveTab(AppTab.USER_SELECT);
  };

  if (activeTab === AppTab.USER_SELECT) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-white font-sans overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600 blur-[120px] rounded-full"></div>
        </div>

        <div className="relative z-10 text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[32px] mx-auto mb-8 flex items-center justify-center shadow-[0_0_50px_-12px_rgba(37,99,235,0.5)]">
            <span className="text-5xl font-black italic">文</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">Zhongwen Master</h1>
          <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.5em]">Lớp Học Tiếng Trung Công Xưởng</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full max-w-md relative z-10">
          {USERS.map(user => (
            <button 
              key={user}
              onClick={() => selectUser(user)}
              className="group bg-white/5 hover:bg-blue-600 backdrop-blur-md p-8 rounded-[40px] font-black transition-all border border-white/10 hover:border-blue-400 shadow-xl active:scale-95"
            >
              <div className="text-2xl mb-1">{user}</div>
              <div className="text-[8px] opacity-40 uppercase tracking-widest font-black">Nhấn để vào học</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.VOCABULARY: return <FlashcardView currentUser={currentUser!} onDataChange={() => triggerCloudBackup(currentUser!)} />;
      case AppTab.READING: return <ReadingView currentUser={currentUser!} onDataChange={() => triggerCloudBackup(currentUser!)} />;
      case AppTab.GRAMMAR: return <GrammarView currentUser={currentUser!} />;
      default:
        return (
          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[24px] flex items-center justify-center text-white font-black text-2xl shadow-xl border border-white/10">
                    {currentUser?.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-slate-50 rounded-full"></div>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chào, {currentUser}!</h1>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Hôm nay bạn muốn học gì?</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSyncModal(true)} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all active:scale-90">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
                <button onClick={logout} className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl shadow-sm flex items-center justify-center text-rose-400 hover:text-rose-600 transition-all active:scale-90">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </button>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-4">
               {[
                 { label: 'Từ vựng', val: stats.vocabCount, color: 'rose' },
                 { label: 'Đã thuộc', val: stats.masteredCount, color: 'emerald' },
                 { label: 'Bài học', val: stats.lessonsCount, color: 'blue' }
               ].map(s => (
                 <div key={s.label} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm text-center">
                   <div className={`text-2xl font-black mb-1 text-${s.color}-600`}>{s.val}</div>
                   <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{s.label}</div>
                 </div>
               ))}
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] group-hover:bg-rose-600/20 transition-all duration-1000"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className={`w-3 h-3 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                   <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Hệ thống Cloud: {syncing ? 'Đang đồng bộ' : 'Sẵn sàng'}</h3>
                </div>
                <p className="text-2xl font-black leading-tight mb-8 max-w-[240px]">Dữ liệu học tập được tự động sao lưu.</p>
                <button 
                  onClick={() => triggerCloudBackup(currentUser!)} 
                  disabled={syncing}
                  className="bg-white text-slate-900 px-8 py-5 rounded-[24px] font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {syncing ? (
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  )}
                  ĐỒNG BỘ NGAY
                </button>
              </div>
            </div>

            <div className="grid gap-5 pt-2 pb-20">
              {[
                { tab: AppTab.VOCABULARY, color: 'rose', char: '字', title: 'Học Từ Vựng', sub: 'Flashcards & Pronunciation' },
                { tab: AppTab.GRAMMAR, color: 'emerald', char: '法', title: 'Học Ngữ Pháp', sub: 'Smart Sentence Analysis' },
                { tab: AppTab.READING, color: 'blue', char: '阅', title: 'Luyện Đọc AI', sub: 'Camera OCR Scan & Translate' }
              ].map(item => (
                <button 
                  key={item.tab} 
                  onClick={() => setActiveTab(item.tab)} 
                  className={`bg-white p-8 rounded-[48px] border border-slate-100 flex items-center justify-between group hover:border-${item.color}-500 transition-all shadow-sm active:scale-[0.98] text-left hover:shadow-xl hover:shadow-${item.color}-500/5`}
                >
                  <div className="flex items-center gap-7">
                    <div className={`w-20 h-20 bg-slate-50 text-slate-300 rounded-[28px] flex items-center justify-center text-4xl font-black group-hover:bg-${item.color}-600 group-hover:text-white transition-all shadow-inner`}>{item.char}</div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">{item.title}</h2>
                      <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{item.sub}</p>
                    </div>
                  </div>
                  <div className={`w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-${item.color}-50 group-hover:text-${item.color}-600 transition-all`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-4xl mx-auto shadow-2xl flex flex-col relative font-sans">
      <main className="flex-grow">{renderContent()}</main>
      
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 z-[100] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md p-12 rounded-[56px] shadow-2xl border border-white/20">
            <h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tighter uppercase">Cài đặt Cloud</h2>
            <p className="text-slate-400 text-xs font-bold mb-10 leading-relaxed uppercase tracking-wider">Dán URL Google Apps Script để kích hoạt đồng bộ hóa dữ liệu.</p>
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-2 mb-3 block">Script Web App URL</label>
                <input 
                  type="text" 
                  value={scriptUrl} 
                  onChange={(e) => {
                    setScriptUrl(e.target.value);
                    localStorage.setItem('global_script_url', e.target.value);
                  }}
                  placeholder="https://script.google.com/..."
                  className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] outline-none font-bold text-sm focus:border-blue-500 transition-all shadow-inner"
                />
              </div>
            </div>
            <button onClick={() => setShowSyncModal(false)} className="w-full mt-12 py-7 bg-slate-900 text-white rounded-[28px] font-black text-xs tracking-[0.3em] shadow-2xl active:scale-95 transition-all uppercase">Lưu Cấu Hình</button>
          </div>
        </div>
      )}

      {activeTab !== AppTab.USER_SELECT && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-100/50 py-6 px-10 flex justify-around max-w-4xl mx-auto z-40 rounded-t-[56px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.08)]">
          {[
            { tab: AppTab.HOME, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
            { tab: AppTab.VOCABULARY, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Học Từ' },
            { tab: AppTab.GRAMMAR, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: 'Ngữ Pháp' },
            { tab: AppTab.READING, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: 'Quét AI' },
          ].map(item => (
            <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`flex flex-col items-center transition-all duration-300 ${activeTab === item.tab ? 'text-blue-600 -translate-y-2' : 'text-slate-300 hover:text-slate-400'}`}>
              <div className={`p-3 rounded-2xl transition-all ${activeTab === item.tab ? 'bg-blue-50' : 'bg-transparent'}`}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}/></svg>
              </div>
              <span className={`text-[9px] font-black mt-1 uppercase tracking-widest transition-opacity ${activeTab === item.tab ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;