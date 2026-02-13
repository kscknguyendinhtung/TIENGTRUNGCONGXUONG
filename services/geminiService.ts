
import { GoogleGenAI, Type } from "@google/genai";
import { SentenceAnalysis, MindmapCategory, Flashcard } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
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

// --- SYNC FUNCTION 1: READING & GRAMMAR (Script 1) ---
export const syncReadingData = async (scriptUrl: string, user: string, readingData: SentenceAnalysis[]) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return false;
  const payload = { user: user, action: 'save_reading', reading: readingData };
  try {
    await fetch(scriptUrl, { 
      method: 'POST', 
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload) 
    });
    return true;
  } catch (e) { return false; }
};

// --- SYNC FUNCTION 2: VOCABULARY (Script 2) ---
export const syncVocabData = async (scriptUrl: string, user: string, cards: Flashcard[]) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return false;
  const payload = {
    user: user,
    action: 'save_vocab',
    cards: cards.map(c => ({
      word: c.word, pinyin: c.pinyin, hanViet: c.hanViet, meaning: c.meaning,
      category: c.category || 'Khác', mastered: c.mastered || false
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
  } catch (e) { return false; }
};

// --- FETCH FROM SCRIPT (Sửa lỗi tải về) ---
export const fetchFromScript = async (scriptUrl: string, user: string) => {
  if (!scriptUrl || !scriptUrl.startsWith("http")) return null;
  try {
    const url = `${scriptUrl}?user=${encodeURIComponent(user)}&action=get&_t=${Date.now()}`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return null;
    const text = await response.text();
    // Google Apps Script trả về HTML nếu có lỗi quyền hoặc redirect
    if (text.trim().startsWith("<")) {
      console.warn("Script returned HTML instead of JSON. Check access permissions.");
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn("Fetch Error:", e);
    return null;
  }
};

/**
 * Fetches vocabulary data from a public Google Sheet CSV export.
 * If the URL is an 'edit' link, it is converted to an 'export?format=csv' link.
 */
export const fetchPublicSheetCsv = async (sheetUrl: string): Promise<any[]> => {
  if (!sheetUrl || !sheetUrl.startsWith("http")) return [];
  try {
    let url = sheetUrl;
    if (url.includes('/edit')) {
      url = url.replace(/\/edit.*$/, '/export?format=csv');
    } else if (url.includes('docs.google.com/spreadsheets/d/') && !url.includes('format=csv')) {
      const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (idMatch) {
        url = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv`;
      }
    }

    const response = await fetch(url);
    if (!response.ok) return [];
    const csvText = await response.text();
    
    // Basic CSV parsing for standard format with header
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: any = {};
      headers.forEach((header, index) => {
        let val = values[index]?.trim() || "";
        if (header === 'mastered') {
          obj[header] = val.toLowerCase() === 'true' || val === '1';
        } else {
          obj[header] = val;
        }
      });
      return obj;
    });
  } catch (e) {
    console.error("fetchPublicSheetCsv error:", e);
    return [];
  }
};

export const extractVocabulary = async (input: { text?: string, imageBase64?: string }): Promise<any[]> => {
  const parts: any[] = [];
  if (input.imageBase64) {
    parts.push({ inlineData: { data: input.imageBase64, mimeType: 'image/jpeg' } });
    parts.push({ text: "OCR hình ảnh này và trích xuất danh sách từ vựng chuẩn." });
  } else if (input.text) {
    parts.push({ text: `Phân tích từ vựng: \n${input.text}` });
  }
  parts.push({
    text: `Trả về JSON Array: {text, pinyin, hanViet, meaning, category (Danh từ, Động từ, Tính từ, Mẫu câu, Sản xuất, Chất lượng, Nhân sự, Văn phòng, Khác)}.`
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
    return JSON.parse(cleanJsonString(response.text || "[]"));
  } catch (e) { return []; }
};

export const analyzeImageAndExtractText = async (base64Images: string[]): Promise<SentenceAnalysis[]> => {
  const imageParts = base64Images.map(base64 => ({ inlineData: { data: base64, mimeType: 'image/jpeg' } }));
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: { parts: [...imageParts, { text: "OCR và phân tích ngữ pháp tiếng Trung chuyên sâu." }] },
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
    return JSON.parse(cleanJsonString(response.text || "[]"));
  } catch (e) { return []; }
};

export const generateMindmap = async (words: {text: string, pinyin: string, meaning: string, hanViet: string}[]): Promise<MindmapCategory[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Phân loại từ vựng vào các nhóm logic: ${JSON.stringify(words)}`,
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
          }
        }
      }
    }
  });
  try {
    return JSON.parse(cleanJsonString(response.text || "[]"));
  } catch (e) { return []; }
};

export const speakText = (text: string, lang: 'cn' | 'vn', speed: number = 1.0) => {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = speed;
  utterance.lang = lang === 'cn' ? 'zh-CN' : 'vi-VN';
  const voices = synth.getVoices();
  const voice = voices.find(v => v.lang.startsWith(lang === 'cn' ? 'zh' : 'vi'));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
};
