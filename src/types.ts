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

export type TimingProtocolPreset =
  | 'itu-standard'
  | 'farnsworth'
  | 'qrq-high-speed'
  | 'light-weighting'
  | 'american-railroad'
  | 'qrss-beacon'
  | 'custom';

export interface MorseTimingConfig {
  mode: 'standard' | 'advanced';
  protocolPreset: TimingProtocolPreset;
  dotDurationMs: number;
  dashRatio: number;
  intraElementGapRatio: number;
  charGapRatio: number;
  wordGapRatio: number;
  useFarnsworth: boolean;
  farnsworthCharWpm: number;
  farnsworthOverallWpm: number;
}

export interface TimingDurations {
  dotDur: number;
  dashDur: number;
  gap: number;
  letterGap: number;
  wordGap: number;
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
  isFavorite?: boolean;
  notes?: string;
}

export type ChatModel = 'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingSources?: GroundingSource[];
  searchQueries?: string[];
  modelUsed?: string;
  isError?: boolean;
}

export interface ChatRolePreset {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
}

export type LiveVoiceState = 'idle' | 'connecting' | 'connected' | 'error';

