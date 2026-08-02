export type ConversionMode = 'readable' | 'universal';
export type DirectionMode = 'textToMorse' | 'morseToText';

export type ScriptCode = 'auto' | 'latin' | 'bangla' | 'devanagari' | 'arabic' | 'hebrew' | 'cyrillic' | 'greek' | 'chinese' | 'japanese' | 'korean' | 'thai' | 'georgian' | 'armenian';

export interface ConversionResult {
  originalText: string;
  detectedScript: ScriptCode;
  romanizedText: string;
  morseCode: string;
  unsupportedChars: string[];
  mode: ConversionMode;
  direction: DirectionMode;
}

export interface AudioSettings {
  wpm: number;
  farnsworthWpm: number;
  useFarnsworth: boolean;
  frequency: number;
  volume: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTextIndex: number;
  currentMorseIndex: number;
  currentSymbol: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  originalText: string;
  morseCode: string;
  mode: ConversionMode;
  script: ScriptCode;
}
