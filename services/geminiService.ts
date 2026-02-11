
import { GoogleGenAI, Type } from "@google/genai";
import { SentenceAnalysis, MindmapCategory, Flashcard } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// Helper to clean JSON string from Markdown code blocks
const cleanJsonString = (text: string): string => {
  if (!text) return "[]";
  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return clean;
};

// Helper: Robust CSV Parser
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

// --- SYNC FUNCTION 1: READING & GRAMMAR (Script 1) ---
export const syncReadingData = async (scriptUrl: string, user: string, readingData: SentenceAnalysis[]) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return false;
  const payload = {
    user: user,
    action: 'save_reading', // Tag action for script handling
    reading: readingData
  };
  try {
    await fetch(scriptUrl, { 
      method: 'POST', 
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload) 
    });
    return true;
  } catch (e) { console.error("Reading Sync Error", e); return false; }
};

// --- SYNC FUNCTION 2: VOCABULARY (Script 2) ---
export const syncVocabData = async (scriptUrl: string, user: string, cards: Flashcard[]) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return false;
  const payload = {
    user: user,
    action: 'save_vocab', // Tag action for script handling
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
    await fetch(scriptUrl, { 
      method: 'POST', 
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload) 
    });
    return true;
  } catch (e) { console.error("Vocab Sync Error", e); return false; }
};

// --- GENERIC FETCH FUNCTION (GET) ---
export const fetchFromScript = async (scriptUrl: string, user: string) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return null;
  try {
    const url = `${scriptUrl}?user=${encodeURIComponent(user)}&action=get`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error(`Fetch Error for ${scriptUrl}`, e);
    return null;
  }
};

// ... existing code ...
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
        data.push({
          word: col[0],
          pinyin: col[1],
          hanViet: col[2],
          meaning: col[3],
          category: col[4] || 'Khác',
          mastered: (col[5] && (col[5].toLowerCase() === 'true' || col[5] === '1')) || false
        });
      }
    }
    return data;
  } catch (e) {
    console.error("CSV Fetch Error:", e);
    return [];
  }
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
    - category: Tự động phân loại chính xác vào 1 trong các nhóm: 
       "Danh từ", "Động từ", "Tính từ", "Mẫu câu", "Sản xuất" (SMT, Máy móc), "Chất lượng" (QC/QA), "Nhân sự", "Văn phòng", "Khác".
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
          properties: {
            text: { type: Type.STRING },
            pinyin: { type: Type.STRING },
            meaning: { type: Type.STRING },
            hanViet: { type: Type.STRING },
            category: { type: Type.STRING }
          }
        }
      }
    }
  });

  try {
    const jsonStr = cleanJsonString(response.text || "[]");
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Lỗi parse từ vựng:", e);
    return [];
  }
};

export const analyzeImageAndExtractText = async (base64Images: string[]): Promise<SentenceAnalysis[]> => {
  const imageParts = base64Images.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: {
      parts: [...imageParts, { text: `NHIỆM VỤ: OCR tiếng Trung và phân tích từ vựng/ngữ pháp chi tiết.` }]
    },
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
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  pinyin: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  hanViet: { type: Type.STRING },
                  category: { type: Type.STRING }
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
  } catch (e) { return []; }
};

export const generateMindmap = async (words: {text: string, pinyin: string, meaning: string, hanViet: string}[]): Promise<MindmapCategory[]> => {
  const wordList = words.map(w => w.text).join(', ');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `NHIỆM VỤ: Phân loại danh sách từ vựng vào các nhóm cây thư mục logic (Ngữ pháp, Chuyên ngành). Từ vựng: ${wordList}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            words: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } }
            }
          },
          required: ["name", "words"]
        }
      }
    }
  });

  try {
    const jsonStr = cleanJsonString(response.text || "[]");
    return JSON.parse(jsonStr);
  } catch (e) { return []; }
};

export const speakText = (text: string, lang: 'cn' | 'vn', speed: number = 1.0) => {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = speed;
  utterance.volume = 1.0; 

  if (lang === 'cn') {
    utterance.lang = 'zh-CN';
  } else {
    utterance.lang = 'vi-VN';
  }

  const voices = synth.getVoices();
  if (voices.length > 0) {
    let selectedVoice = null;
    if (lang === 'cn') {
        selectedVoice = voices.find(v => v.lang === 'zh-CN' && !v.name.includes("Siri")) || 
                        voices.find(v => v.lang === 'zh-CN') || 
                        voices.find(v => v.lang.startsWith('zh')); 
    } else {
        selectedVoice = voices.find(v => v.lang === 'vi-VN') || 
                        voices.find(v => v.lang.startsWith('vi'));
    }
    if (selectedVoice) utterance.voice = selectedVoice;
  }
  synth.speak(utterance);
};
// Remove old functions to avoid confusion
export const syncToGoogleSheets = async (scriptUrl: string, data: any) => { return false; };
export const syncUserSheet = async (scriptUrl: string, user: string, cards: any[], reading: any[]) => { return false; };
