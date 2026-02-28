
export interface Flashcard {
  id: string;
  word: string;
  pinyin: string;
  meaning: string;
  hanViet: string;
  phonetic?: string;
  category?: string; // New field for sorting
  mastered?: boolean;
  isManual?: boolean;
}

export interface SentenceAnalysis {
  id: string;
  chinese: string;
  pinyin: string;
  meaning: string;
  grammarPoints: string[];
  words: {
    text: string;
    pinyin: string;
    meaning: string;
    hanViet: string;
    phonetic?: string;
    category?: string; // New field
  }[];
  mastered?: boolean;
}

export interface MindmapCategory {
  name: string;
  words: {
    text: string;
    pinyin: string;
    meaning: string;
    hanViet: string;
    phonetic?: string;
    category?: string;
  }[];
}

export enum AppTab {
  HOME = 'home',
  VOCABULARY = 'vocabulary',
  GRAMMAR = 'grammar',
  READING = 'reading',
  USER_SELECT = 'user_select'
}

export const USERS = ["Tony", "Alex", "Tam", "Bich", "Fono", "Hannah", "Ryan", "Loan"];
