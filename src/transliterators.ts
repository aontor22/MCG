import { ScriptCode } from './types';

const BANGLA_MAP: Record<string, string> = {
  অ: 'A', আ: 'A', ই: 'I', ঈ: 'I', উ: 'U', ঊ: 'U', ঋ: 'RI', এ: 'E', ঐ: 'OI', ও: 'O', ঔ: 'OU',
  ক: 'K', খ: 'KH', গ: 'G', ঘ: 'GH', ঙ: 'NG', চ: 'CH', ছ: 'CHH', জ: 'J', ঝ: 'JH', ঞ: 'N',
  ট: 'T', ঠ: 'TH', ড: 'D', ঢ: 'DH', ণ: 'N', ত: 'T', থ: 'TH', দ: 'D', ধ: 'DH', ন: 'N',
  প: 'P', ফ: 'PH', ব: 'B', ভ: 'BH', ম: 'M', য: 'J', র: 'R', ল: 'L', শ: 'SH', ষ: 'SH', স: 'S', হ: 'H',
  'া': 'A', 'ি': 'I', 'ী': 'I', 'ু': 'U', 'ূ': 'U', 'ে': 'E', 'ৈ': 'OI', 'ো': 'O', 'ৌ': 'OU', '্': '',
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9', '।': '.'
};

const DEVANAGARI_MAP: Record<string, string> = {
  अ: 'A', आ: 'A', इ: 'I', ई: 'I', उ: 'U', ऊ: 'U', ऋ: 'R', ए: 'E', ऐ: 'AI', ओ: 'O', औ: 'AU',
  क: 'K', খ: 'KH', ग: 'G', घ: 'GH', ङ: 'NG', च: 'CH', छ: 'CHH', ज: 'J', झ: 'JH', ञ: 'NY',
  ट: 'T', ठ: 'TH', ड: 'D', ढ: 'DH', ण: 'N', त: 'T', थ: 'TH', द: 'D', ध: 'DH', न: 'N',
  प: 'P', फ: 'PH', ब: 'B', भ: 'BH', म: 'M', य: 'Y', र: 'R', ल: 'L', व: 'V', श: 'SH', ष: 'SH', स: 'S', ह: 'H',
  'ा': 'A', 'ि': 'I', 'ी': 'I', 'ु': 'U', 'ू': 'U', 'े': 'E', 'ै': 'AI', 'ो': 'O', 'ौ': 'AU', '्': '',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9', '।': '.'
};

const ARABIC_MAP: Record<string, string> = {
  ا: 'A', أ: 'A', إ: 'I', آ: 'AA', ب: 'B', ت: 'T', ث: 'TH', ج: 'J', ح: 'H', خ: 'KH',
  د: 'D', ذ: 'DH', ر: 'R', ز: 'Z', س: 'S', ش: 'SH', ص: 'S', ض: 'D', ط: 'T', ظ: 'Z',
  ع: 'A', غ: 'GH', ف: 'F', ق: 'Q', ك: 'K', ل: 'L', م: 'M', ن: 'N', ه: 'H', و: 'W', ي: 'Y',
  '؟': '?', '،': ',', '؛': ';'
};

const CYRILLIC_MAP: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'YO', Ж: 'ZH', З: 'Z', И: 'I',
  Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T',
  У: 'U', Ф: 'F', Х: 'KH', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SHCH', Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'YU', Я: 'YA',
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'YO', ж: 'ZH', з: 'Z', и: 'I',
  й: 'Y', к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T',
  у: 'U', ф: 'F', х: 'KH', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SHCH', ъ: '', ы: 'Y', ь: '', э: 'E', ю: 'YU', я: 'YA'
};

export function transliterate(text: string, script: ScriptCode): string {
  let result = '';
  const map = script === 'bangla' ? BANGLA_MAP : script === 'devanagari' ? DEVANAGARI_MAP : script === 'arabic' ? ARABIC_MAP : script === 'cyrillic' ? CYRILLIC_MAP : null;
  if (map) {
    for (const char of text) { result += map[char] !== undefined ? map[char] : char; }
  } else {
    result = text;
  }
  return result.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
