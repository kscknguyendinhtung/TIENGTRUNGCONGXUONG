
import React, { useState, useEffect, useCallback } from 'react';
import { AppTab, USERS } from './types';
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

  // Hàm tạo timestamp định dạng Hà Nội (GMT+7)
  const getHanoiTimestamp = () => {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  };

  // Hàm đồng bộ xuôi (POST) - Lưu lên Cloud
  const triggerCloudBackup = useCallback(async (user: string) => {
    if (!scriptUrl) return;
    setSyncing(true);
    const data = {
      user: user,
      reading: JSON.parse(localStorage.getItem(`reading_${user}`) || '[]'),
      mastery: JSON.parse(localStorage.getItem(`mastery_${user}`) || '{}'),
      timestamp: getHanoiTimestamp() // Sử dụng giờ Hà Nội
    };
    await syncToGoogleSheets(scriptUrl, data);
    setSyncing(false);
  }, [scriptUrl]);

  // Đồng bộ ngược khi chọn user (GET) - Lấy từ Cloud
  const selectUser = async (user: string) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', user);
    setSyncing(true);
    
    const cloudData = await fetchFromGoogleSheets(scriptUrl, user);
    if (cloudData) {
      if (cloudData.reading) localStorage.setItem(`reading_${user}`, JSON.stringify(cloudData.reading));
      if (cloudData.mastery) localStorage.setItem(`mastery_${user}`, JSON.stringify(cloudData.mastery));
      console.log("Dữ liệu đã được đồng bộ từ Cloud.");
    }
    
    setSyncing(false);
    setActiveTab(AppTab.HOME);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    setActiveTab(AppTab.USER_SELECT);
  };

  if (activeTab === AppTab.USER_SELECT) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans text-center">
        <div className="mb-12">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-blue-500/50">
            <span className="text-4xl font-black">文</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Zhongwen Master</h1>
          <p className="text-slate-500 mt-2 font-black uppercase text-[10px] tracking-[0.4em]">Cloud Sync Platform</p>
        </div>
        
        {syncing && (
          <div className="mb-8 flex items-center gap-3 bg-blue-500/20 px-6 py-3 rounded-2xl border border-blue-500/30">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest">Đang kết nối Cloud...</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          {USERS.map(user => (
            <button 
              key={user}
              onClick={() => selectUser(user)}
              className="group relative bg-slate-800 hover:bg-blue-600 p-8 rounded-[40px] font-black transition-all border border-slate-700 hover:border-blue-400 shadow-xl overflow-hidden active:scale-95"
            >
              <span className="relative z-10">{user}</span>
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
          <div className="p-6 space-y-4">
            <header className="flex justify-between items-center mb-8 mt-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-900 rounded-[20px] flex items-center justify-center text-white font-black text-xl shadow-lg">
                  {currentUser?.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">Chào, {currentUser}!</h1>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Tài khoản đồng bộ</span>
                    {syncing && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSyncModal(true)} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400 hover:text-blue-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
                <button onClick={logout} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </button>
              </div>
            </header>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                   <div className={`w-2 h-2 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">{syncing ? 'Đang đồng bộ...' : 'Đã đồng bộ Cloud'}</h3>
                </div>
                <p className="text-xl font-bold mb-6">Tiến độ học tập của bạn luôn được đồng bộ an toàn.</p>
                <button 
                  onClick={() => triggerCloudBackup(currentUser!)} 
                  disabled={syncing}
                  className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {syncing ? (
                    <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  )}
                  ĐỒNG BỘ THỦ CÔNG
                </button>
              </div>
            </div>

            <div className="grid gap-4 pt-4 pb-12">
              {[
                { tab: AppTab.VOCABULARY, color: 'red', char: '字', title: 'Từ Vựng', sub: 'Flashcards' },
                { tab: AppTab.GRAMMAR, color: 'emerald', char: '法', title: 'Ngữ Pháp', sub: 'Analysis' },
                { tab: AppTab.READING, color: 'blue', char: '阅', title: 'Luyện Đọc', sub: 'AI OCR' }
              ].map(item => (
                <button 
                  key={item.tab} 
                  onClick={() => setActiveTab(item.tab)} 
                  className={`bg-white p-8 rounded-[48px] border border-slate-100 flex items-center justify-between group hover:border-blue-500 transition-all shadow-sm active:scale-[0.98] text-left`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 bg-slate-50 text-slate-400 rounded-[24px] flex items-center justify-center text-3xl font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner`}>{item.char}</div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight">{item.title}</h2>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{item.sub}</p>
                    </div>
                  </div>
                  <div className={`w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-all`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-4xl mx-auto shadow-2xl flex flex-col relative">
      <main className="flex-grow">{renderContent()}</main>
      
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
          <div className="bg-white w-full max-w-md p-10 rounded-[56px] shadow-2xl">
            <h2 className="text-3xl font-black mb-2 text-slate-800 tracking-tighter uppercase">Cài đặt Cloud</h2>
            <p className="text-slate-400 text-xs font-bold mb-8">Google Apps Script URL cho đồng bộ hóa.</p>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 mb-2 block">Script URL</label>
                <input 
                  type="text" 
                  value={scriptUrl} 
                  onChange={(e) => {
                    setScriptUrl(e.target.value);
                    localStorage.setItem('global_script_url', e.target.value);
                  }}
                  placeholder="https://script.google.com/..."
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none font-bold text-sm focus:border-blue-500 transition-all shadow-inner"
                />
              </div>
            </div>
            <button onClick={() => setShowSyncModal(false)} className="w-full mt-10 py-6 bg-slate-900 text-white rounded-[30px] font-black text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all">LƯU CẤU HÌNH</button>
          </div>
        </div>
      )}

      {activeTab !== AppTab.USER_SELECT && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 py-5 px-10 flex justify-around max-w-4xl mx-auto z-40 rounded-t-[56px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.1)]">
          {[
            { tab: AppTab.HOME, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
            { tab: AppTab.VOCABULARY, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Từ vựng' },
            { tab: AppTab.GRAMMAR, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: 'Ngữ pháp' },
            { tab: AppTab.READING, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: 'Luyện đọc' },
          ].map(item => (
            <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`flex flex-col items-center transition-all ${activeTab === item.tab ? 'text-blue-600 scale-125' : 'text-slate-300 hover:text-slate-400'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d={item.icon}/></svg>
              <span className={`text-[8px] font-black mt-1.5 uppercase tracking-widest transition-opacity ${activeTab === item.tab ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;
