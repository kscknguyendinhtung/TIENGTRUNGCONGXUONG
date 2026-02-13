
import { GoogleGenAI, Type } from "@google/genai";
import { SentenceAnalysis, Flashcard, MindmapCategory } from "../types";

// Initialize Gemini API client following the provided guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- BACKGROUND AUDIO HACK FOR IOS ---
const SILENT_AUDIO_BASE64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//oeAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAD9MYXZjNTguMTM0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASAAAAAAAASQAAAAJlAAAA8AAAAA//oeZAAAAABiAAAAAAAAAAARAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAA//oeZAAAAABiAAAAAAAAAAARAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAA//oeZAAAAABiAAAAAAAAAAARAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAA//oeZAAAAABiAAAAAAAAAAARAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAA//oeZAAAAABiAAAAAAAAAAARAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAA";

let backgroundAudio: HTMLAudioElement | null = null;

export const toggleBackgroundMode = (enable: boolean) => {
  if (enable) {
    if (!backgroundAudio) {
      backgroundAudio = new Audio(SILENT_AUDIO_BASE64);
      backgroundAudio.loop = true;
      backgroundAudio.volume = 0.01;
    }
    backgroundAudio.play().catch(e => console.log("Bg Audio play failed", e));
    
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Zhongwen Master',
        artist: 'Đang chạy ngầm...',
        album: 'Luyện nghe thụ động',
        artwork: [{ src: 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', () => backgroundAudio?.play());
      navigator.mediaSession.setActionHandler('pause', () => backgroundAudio?.pause());
    }
  } else {
    if (backgroundAudio) {
      backgroundAudio.pause();
      backgroundAudio = null;
    }
  }
};

const cleanJsonString = (text: string): string => {
  if (!text) return "[]";
  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return clean;
};

const parseCSV = (str: string) => {
  const arr: string[][] = [];
  let quote = false;
  let col = 0, row = 0;
  for (let c = 0; c < str.length; c++) {
    const cc = str[c], nc = str[c + 1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
    if (cc == '"') { quote = !quote; continue; }
    if (cc == ',' && !quote) { ++col; continue; }
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }
    arr[row][col] += cc;
  }
  return arr;
};

export const syncReadingData = async (scriptUrl: string, user: string, readingData: SentenceAnalysis[]) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return false;
  const payload = { user: user, action: 'save_reading', reading: readingData };
  try {
    await fetch(scriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    return true;
  } catch (e) { console.error("Reading Sync Error", e); return false; }
};

export const syncVocabData = async (scriptUrl: string, user: string, cards: Flashcard[]) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return false;
  const payload = {
    user: user,
    action: 'save_vocab',
    cards: cards.map(c => ({ 
      word: c.word, 
      pinyin: c.pinyin, 
      hanViet: c.hanViet, 
      meaning: c.meaning, 
      category: c.category || 'Khác', 
      mastered: c.mastered || false 
    }))
  };
  try {
    await fetch(scriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    return true;
  } catch (e) { console.error("Vocab Sync Error", e); return false; }
};

export const fetchFromScript = async (scriptUrl: string, user: string) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return null;
  try {
    const url = `${scriptUrl}?user=${encodeURIComponent(user)}&action=get&_t=${Date.now()}`;
    const response = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.trim().startsWith("<")) return null; 
    return JSON.parse(text);
  } catch (e) { console.warn(`Fetch Error for ${scriptUrl}`, e); return null; }
};

export const fetchPublicSheetCsv = async (sheetUrl: string): Promise<any[]> => {
  try {
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) throw new Error("URL Sheet không hợp lệ");
    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Không thể truy cập Sheet.");
    const text = await response.text();
    const rows = parseCSV(text);
    const data = [];
    const startRow = (rows[0] && (rows[0][0].includes("Hán tự") || rows[0][0].includes("Word"))) ? 1 : 0;
    for (let i = startRow; i < rows.length; i++) {
      const col = rows[i];
      if (col.length >= 4 && col[0]) {
        data.push({ word: col[0], pinyin: col[1], hanViet: col[2], meaning: col[3], category: col[4] || 'Khác', mastered: (col[5] && (col[5].toLowerCase() === 'true' || col[5] === '1')) || false });
      }
    }
    return data;
  } catch (e) { console.error("CSV Fetch Error:", e); return []; }
};

export const extractVocabulary = async (input: { text?: string, imageBase64?: string }): Promise<any[]> => {
  const parts: any[] = [];
  if (input.imageBase64) {
    parts.push({ inlineData: { data: input.imageBase64, mimeType: 'image/jpeg' } });
    parts.push({ text: "OCR hình ảnh này và trích xuất toàn bộ từ vựng tiếng Trung quan trọng." });
  } else if (input.text) {
    parts.push({ text: `Phân tích danh sách từ vựng này: \n${input.text}` });
  }
  parts.push({
    text: `
    NHIỆM VỤ: Chuyển đổi dữ liệu đầu vào thành danh sách từ vựng JSON chuẩn.
    YÊU CẦU ĐẦU RA CHO MỖI TỪ (JSON Object):
    - text: Chữ Hán (Giản thể).
    - pinyin: Pinyin chuẩn có dấu thanh.
    - hanViet: Âm Hán Việt.
    - meaning: Nghĩa tiếng Việt ngắn gọn, súc tích.
    - category: BẮT BUỘC phân loại vào 1 trong các nhóm sau: "Danh từ", "Động từ", "Tính từ", "Mẫu câu", "Sản xuất", "Chất lượng", "Nhân sự", "Văn phòng", "Khác".
    `
  });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING }, pinyin: { type: Type.STRING }, meaning: { type: Type.STRING }, hanViet: { type: Type.STRING }, category: { type: Type.STRING } }
        }
      }
    }
  });
  try {
    const jsonStr = cleanJsonString(response.text || "[]");
    return JSON.parse(jsonStr);
  } catch (e) { console.error("Lỗi parse từ vựng:", e); return []; }
};

export const analyzeImageAndExtractText = async (base64Images: string[]): Promise<SentenceAnalysis[]> => {
  const imageParts = base64Images.map(base64 => ({ inlineData: { data: base64, mimeType: 'image/jpeg' } }));
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: { parts: [...imageParts, { 
      text: `NHIỆM VỤ: OCR tiếng Trung và phân tích từ vựng/ngữ pháp chi tiết. 
      Yêu cầu BẮT BUỘC phân loại từ vựng vào 1 trong các danh mục: "Danh từ", "Động từ", "Tính từ", "Mẫu câu", "Sản xuất", "Chất lượng", "Nhân sự", "Văn phòng", "Khác".` 
    }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            chinese: { type: Type.STRING },
            pinyin: { type: Type.STRING },
            meaning: { type: Type.STRING },
            grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            words: { type: Type.ARRAY, items: { 
              type: Type.OBJECT, 
              properties: { 
                text: { type: Type.STRING }, 
                pinyin: { type: Type.STRING }, 
                meaning: { type: Type.STRING }, 
                hanViet: { type: Type.STRING }, 
                category: { type: Type.STRING } 
              } 
            } }
          }
        }
      }
    }
  });
  try {
    const jsonStr = cleanJsonString(response.text || "[]");
    return JSON.parse(jsonStr);
  } catch (e) { return []; }
};

// Generate AI-categorized mindmap from list of words for structured learning
export const generateMindmap = async (words: { text: string, pinyin: string, meaning: string, hanViet: string }[]): Promise<MindmapCategory[]> => {
  const prompt = `
    NHIỆM VỤ: Phân tích và sắp xếp danh sách từ vựng tiếng Trung sau đây vào các nhóm logic (Mindmap) để người học dễ ghi nhớ nhất.
    YÊU CẦU:
    - Phân nhóm theo các danh mục: "Danh từ", "Động từ", "Tính từ", "Mẫu câu", "Sản xuất", "Chất lượng", "Nhân sự", "Văn phòng", "Khác".
    - Trả về kết quả dưới dạng JSON Array các đối tượng Category.
    - Đảm bảo trích xuất chính xác các trường: text, pinyin, meaning, hanViet từ dữ liệu đầu vào.

    Dữ liệu từ vựng:
    ${JSON.stringify(words)}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Tên nhóm chủ đề hoặc từ loại" },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  pinyin: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  hanViet: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    }
  });

  try {
    const jsonStr = cleanJsonString(response.text || "[]");
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Lỗi parse Mindmap:", e);
    return [];
  }
};

const activeUtterances: SpeechSynthesisUtterance[] = [];

export const speakText = (text: string, lang: 'cn' | 'vn', speed: number = 1.0) => {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = speed;
  utterance.volume = 1.0; 
  if (lang === 'cn') { utterance.lang = 'zh-CN'; } else { utterance.lang = 'vi-VN'; }
  const voices = synth.getVoices();
  if (voices.length > 0) {
    let selectedVoice = null;
    if (lang === 'cn') {
        selectedVoice = voices.find(v => v.lang === 'zh-CN' && !v.name.includes("Siri")) || voices.find(v => v.lang === 'zh-CN') || voices.find(v => v.lang.startsWith('zh')); 
    } else {
        selectedVoice = voices.find(v => v.lang === 'vi-VN') || voices.find(v => v.lang.startsWith('vi'));
    }
    if (selectedVoice) utterance.voice = selectedVoice;
  }
  activeUtterances.push(utterance);
  utterance.onend = () => {
    const index = activeUtterances.indexOf(utterance);
    if (index > -1) activeUtterances.splice(index, 1);
  };
  synth.speak(utterance);
};
