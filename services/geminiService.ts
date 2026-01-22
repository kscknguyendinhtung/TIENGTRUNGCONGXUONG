import { GoogleGenAI, Type } from "@google/genai";
import { SentenceAnalysis } from "../types";

// Khởi tạo AI trực tiếp với key từ môi trường
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const analyzeImageAndExtractText = async (base64Images: string[]): Promise<SentenceAnalysis[]> => {
  const imageParts = base64Images.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: {
      parts: [
        ...imageParts,
        { 
          text: `NHIỆM VỤ: OCR tiếng Trung và phân tích từ vựng/ngữ pháp chi tiết.
          YÊU CẦU:
          1. Trích xuất text tiếng Trung chính xác.
          2. Pinyin kèm dấu thanh.
          3. Nghĩa tiếng Việt tự nhiên nhất.
          4. HÁN VIỆT: Phải cung cấp âm Hán Việt chuẩn cho từng từ.
          5. TỪ VỰNG: Chia nhỏ câu thành các từ/cụm từ ý nghĩa.
          6. NGỮ PHÁP: Giải thích các cấu trúc quan trọng trong đoạn văn.` 
        }
      ]
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
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (e) {
    console.error("Lỗi parse JSON Gemini:", e);
    return [];
  }
};

export const speakText = (text: string, lang: 'cn' | 'vn', speed: number = 1.0) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'cn' ? 'zh-CN' : 'vi-VN';
  utterance.rate = speed;
  window.speechSynthesis.speak(utterance);
};

export const syncToGoogleSheets = async (scriptUrl: string, data: any) => {
  if (!scriptUrl || scriptUrl.includes("YOUR_SCRIPT_URL")) return false;
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const fetchFromGoogleSheets = async (scriptUrl: string, user: string) => {
  if (!scriptUrl || scriptUrl.includes("YOUR_SCRIPT_URL")) return null;
  try {
    const response = await fetch(`${scriptUrl}?user=${encodeURIComponent(user)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
};