import { ScriptCode } from './types';

export function detectScript(text: string): ScriptCode {
  if (!text.trim()) return 'latin';
  let bangla = 0, devanagari = 0, arabic = 0, hebrew = 0, cyrillic = 0, greek = 0, cjk = 0, thai = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x0980 && code <= 0x09ff) bangla++;
    else if (code >= 0x0900 && code <= 0x097f) devanagari++;
    else if ((code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f)) arabic++;
    else if (code >= 0x0590 && code <= 0x05ff) hebrew++;
    else if (code >= 0x0400 && code <= 0x04ff) cyrillic++;
    else if (code >= 0x0370 && code <= 0x03ff) greek++;
    else if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3040 && code <= 0x30ff)) cjk++;
    else if (code >= 0x0e00 && code <= 0x0e7f) thai++;
  }
  const counts = [
    { script: 'bangla', count: bangla }, { script: 'devanagari', count: devanagari },
    { script: 'arabic', count: arabic }, { script: 'hebrew', count: hebrew },
    { script: 'cyrillic', count: cyrillic }, { script: 'greek', count: greek },
    { script: 'chinese', count: cjk }, { script: 'thai', count: thai }
  ].sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? (counts[0].script as ScriptCode) : 'latin';
}
