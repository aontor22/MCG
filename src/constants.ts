import { ScriptCode } from './types';

export const LATIN_TO_MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};

export const MORSE_TO_LATIN = Object.entries(LATIN_TO_MORSE).reduce((acc, [k, v]) => {
  acc[v] = k; return acc;
}, {} as Record<string, string>);

export const HEX_TO_MORSE: Record<string, string> = {
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.'
};

export const MORSE_TO_HEX = Object.entries(HEX_TO_MORSE).reduce((acc, [k, v]) => {
  acc[v] = k; return acc;
}, {} as Record<string, string>);

export const SAMPLE_TEXTS = [
  { label: 'English (Latin)', script: 'latin' as ScriptCode, text: 'SOS. HELLO WORLD 123' },
  { label: 'Bangla', script: 'bangla' as ScriptCode, text: 'আমি বাংলা লিখি এবং শিখি।' },
  { label: 'Hindi (Devanagari)', script: 'devanagari' as ScriptCode, text: 'नमस्ते दुनिया, आप कैसे हैं?' },
  { label: 'Arabic', script: 'arabic' as ScriptCode, text: 'مرحبا بكم في العالم الرقمي' },
  { label: 'Chinese (Simplified)', script: 'chinese' as ScriptCode, text: '你好，世界！和平与爱。' },
  { label: 'Japanese', script: 'japanese' as ScriptCode, text: 'こんにちは世界、モールス信号。' },
  { label: 'Cyrillic (Russian)', script: 'cyrillic' as ScriptCode, text: 'Привет мир! Радиосвязь работает.' },
  { label: 'Greek', script: 'greek' as ScriptCode, text: 'Γειά σου Κόσμε' },
  { label: 'Universal Unicode (Emoji)', script: 'auto' as ScriptCode, text: 'বাংলা 🌍 العربية 中文' }
];

export const SCRIPT_LIST = [
  { code: 'auto', name: 'Auto Detect', direction: 'ltr' },
  { code: 'latin', name: 'English / Latin', direction: 'ltr' },
  { code: 'bangla', name: 'Bangla', direction: 'ltr' },
  { code: 'devanagari', name: 'Hindi (Devanagari)', direction: 'ltr' },
  { code: 'arabic', name: 'Arabic / Persian / Urdu', direction: 'rtl' },
  { code: 'hebrew', name: 'Hebrew', direction: 'rtl' },
  { code: 'cyrillic', name: 'Cyrillic (Russian/etc.)', direction: 'ltr' },
  { code: 'greek', name: 'Greek', direction: 'ltr' },
  { code: 'chinese', name: 'Chinese (CJK)', direction: 'ltr' },
  { code: 'japanese', name: 'Japanese', direction: 'ltr' },
  { code: 'korean', name: 'Korean', direction: 'ltr' },
  { code: 'thai', name: 'Thai', direction: 'ltr' },
  { code: 'georgian', name: 'Georgian', direction: 'ltr' },
  { code: 'armenian', name: 'Armenian', direction: 'ltr' }
];
