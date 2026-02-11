
import { GoogleGenAI, Type } from "@google/genai";
import { SentenceAnalysis, MindmapCategory } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// Helper to clean JSON string from Markdown code blocks
const cleanJsonString = (text: string): string => {
  if (!text) return "[]";
  let clean = text.trim();
  // Remove ```json and ``` wrap
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

// Fetch data from Public Google Sheet (CSV format via GVIZ API)
export const fetchPublicSheetCsv = async (sheetUrl: string): Promise<any[]> => {
  try {
    // 1. Extract Sheet ID
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) throw new Error("URL Sheet không hợp lệ");
    const sheetId = match[1];

    // 2. Construct CSV Export URL (Google Visualization API)
    // tqx=out:csv -> output as CSV
    // sheet=Sheet1 -> optional, defaults to first sheet
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Không thể truy cập Sheet. Hãy đảm bảo Sheet đang để chế độ 'Anyone with the link can view'.");
    
    const text = await response.text();
    const rows = parseCSV(text);

    // 3. Convert CSV rows to Objects
    // Assume format: [Word, Pinyin, HanViet, Meaning, Category, Status]
    // Filter header if present
    const data = [];
    const startRow = (rows[0][0].includes("Hán tự") || rows[0][0].includes("Word")) ? 1 : 0;

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

// Helper to extract words from either text or image
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
    
    QUY TẮC XỬ LÝ QUAN TRỌNG ĐỂ TRÁNH LỆCH DÒNG:
    1. Xử lý từng dòng (hoặc từng câu) độc lập. KHÔNG lấy nghĩa của dòng dưới đắp lên dòng trên.
    2. Chấp nhận đa định dạng đầu vào trên cùng một danh sách:
       - Dạng 1: [Tiếng Trung] [Pinyin] [Tiếng Việt]
       - Dạng 2: [Tiếng Việt] [Tiếng Trung]
       - Dạng 3: [Tiếng Trung] (thiếu nghĩa) -> Hãy tự điền nghĩa.
    3. Nếu một dòng bị lỗi hoặc thiếu thông tin, hãy dùng kiến thức của bạn để điền thông tin còn thiếu cho chính dòng đó.
    
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
    const result = JSON.parse(jsonStr);
    return Array.isArray(result) ? result : [];
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
                  hanViet: { type: Type.STRING },
                  category: { type: Type.STRING, description: "Loại từ (Danh/Động/Tính) hoặc Chủ đề (Sản xuất/QC...)" }
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
    console.error("Lỗi parse JSON Gemini:", e);
    return [];
  }
};

export const generateMindmap = async (words: {text: string, pinyin: string, meaning: string, hanViet: string}[]): Promise<MindmapCategory[]> => {
  const wordList = words.map(w => w.text).join(', ');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `NHIỆM VỤ: Phân loại danh sách từ vựng tiếng Trung sau đây vào các nhóm cây thư mục logic.
    DANH SÁCH TỪ VỰNG: ${wordList}
    
    CÁC NHÓM ƯU TIÊN PHÂN LOẠI:
    1. Ngữ pháp: Danh từ, Động từ, Tính từ, Trạng từ, Liên từ, Trợ từ, Lượng từ, Mẫu câu.
    2. Không gian/Thời gian: Phương hướng, Vị trí, Thời gian, Thứ tự.
    3. Chuyên ngành Công nghiệp: 
       - Sản xuất (SMT, Cơ khí, Máy móc, Bảo trì, Thiết bị).
       - Quản lý (Nhân sự, Kho bãi, Văn phòng, Chất lượng/QC).
    
    YÊU CẦU: 
    1. Trả về mảng các category. 
    2. Trong mỗi category, danh sách từ chỉ cần chứa trường "text" khớp với từ vựng đầu vào.
    3. Phân loại thật chính xác theo ngữ nghĩa chuyên môn.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Tên nhóm phân loại (ví dụ: Động từ, SMT, QC...)" },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Hán tự gốc" }
                }
              }
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
  } catch (e) {
    console.error("Lỗi parse Mindmap:", e);
    return [];
  }
};

export const speakText = (text: string, lang: 'cn' | 'vn', speed: number = 1.0) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.text = text.trim();
    utterance.rate = speed;
    const targetLang = lang === 'cn' ? 'zh-CN' : 'vi-VN';
    utterance.lang = targetLang;
    let voices = window.speechSynthesis.getVoices();
    const findVoice = () => {
      voices = window.speechSynthesis.getVoices();
      let selectedVoice = voices.find(v => v.lang.replace('_', '-') === targetLang) || 
                          voices.find(v => v.lang.startsWith(lang === 'cn' ? 'zh' : 'vi'));
      if (selectedVoice) utterance.voice = selectedVoice;
      window.speechSynthesis.speak(utterance);
    };
    if (voices.length === 0) window.speechSynthesis.onvoiceschanged = findVoice;
    else findVoice();
    utterance.onend = () => window.speechSynthesis.cancel();
  }, 50);
};

export const syncToGoogleSheets = async (scriptUrl: string, data: any) => {
  if (!scriptUrl || scriptUrl.includes("YOUR_SCRIPT_URL")) return false;
  try {
    await fetch(scriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return true;
  } catch (e) { return false; }
};

export const fetchFromGoogleSheets = async (scriptUrl: string, user: string) => {
  if (!scriptUrl || scriptUrl.includes("YOUR_SCRIPT_URL")) return null;
  try {
    const response = await fetch(`${scriptUrl}?user=${encodeURIComponent(user)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};
