
import { GoogleGenAI, Type } from "@google/genai";
import { SentenceAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// OCR & Phân tích hình ảnh bằng Gemini vẫn được giữ nguyên
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
          text: `NHIỆM VỤ OCR & TRÍCH XUẤT TỪ VỰNG TOÀN DIỆN:
          1. OCR CHÍNH XÁC: Trích xuất 100% Hán tự.
          2. TRÍCH XUẤT TỪ VỰNG CHI TIẾT: Phải bao gồm cả THỰC TỪ (danh, động, tính) và đặc biệt là HƯ TỪ (trợ từ 的, 地, 得, 了, 过, 吧, 呢, 吗...), TỪ NỐI (và, nhưng, vì vậy...), GIỚI TỪ.
          3. THÔNG TIN: text, pinyin, meaning, hanViet.
          4. NGỮ PHÁP: Giải thích kỹ các cấu trúc xuất hiện trong đoạn.` 
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
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};

/**
 * SỬ DỤNG TTS CỦA TRÌNH DUYỆT (WEB SPEECH API)
 * Phản hồi tức thì, không có độ trễ mạng.
 */
export const speakText = (text: string, lang: 'cn' | 'vn', speed: number = 1.0) => {
  if (!('speechSynthesis' in window)) {
    console.error("Trình duyệt không hỗ trợ TTS.");
    return;
  }

  // Hủy các yêu cầu đọc đang dang dở để tránh xếp hàng quá lâu
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Thiết lập ngôn ngữ
  utterance.lang = lang === 'cn' ? 'zh-CN' : 'vi-VN';
  
  // Thiết lập tốc độ (0.1 đến 10)
  utterance.rate = speed;
  
  // Tìm kiếm giọng đọc phù hợp (nếu có)
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.includes(utterance.lang) && (v.name.includes('Google') || v.name.includes('Premium')));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
};

// Cần thiết để khởi tạo giọng đọc trên một số trình duyệt
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}

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

// Mock function for compatibility (no longer needed for Web Speech API but keeps imports clean)
export const initAudioContext = () => {};
