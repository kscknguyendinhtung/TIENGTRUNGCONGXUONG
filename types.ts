
export interface Flashcard {
  id: string;
  word: string;
  pinyin: string;
  meaning: string;
  hanViet: string;
  mastered?: boolean;
}

export interface SentenceAnalysis {
  chinese: string;
  pinyin: string;
  meaning: string;
  grammarPoints: string[];
  words: {
    text: string;
    pinyin: string;
    meaning: string;
    hanViet: string;
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
