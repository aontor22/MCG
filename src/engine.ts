import { LATIN_TO_MORSE, HEX_TO_MORSE, MORSE_TO_HEX, MORSE_TO_LATIN } from './constants';
import { ConversionMode, ScriptCode, ConversionResult, MorseTimingConfig, TimingDurations } from './types';
import { detectScript } from './utils';
import { transliterate } from './transliterators';

export function calculateTimingDurations(
  timingConfig: MorseTimingConfig,
  standardWpm = 20
): TimingDurations {
  if (timingConfig.mode === 'standard') {
    const dotDur = 1.2 / Math.max(1, standardWpm);
    return {
      dotDur,
      dashDur: dotDur * 3,
      gap: dotDur,
      letterGap: dotDur * 3,
      wordGap: dotDur * 7,
    };
  }

  if (timingConfig.useFarnsworth) {
    const charDotDur = 1.2 / Math.max(1, timingConfig.farnsworthCharWpm);
    const spaceDotDur = 1.2 / Math.max(1, timingConfig.farnsworthOverallWpm);
    return {
      dotDur: charDotDur,
      dashDur: charDotDur * timingConfig.dashRatio,
      gap: charDotDur * timingConfig.intraElementGapRatio,
      letterGap: spaceDotDur * timingConfig.charGapRatio,
      wordGap: spaceDotDur * timingConfig.wordGapRatio,
    };
  }

  const dotDur = Math.max(0.005, timingConfig.dotDurationMs / 1000);
  return {
    dotDur,
    dashDur: dotDur * timingConfig.dashRatio,
    gap: dotDur * timingConfig.intraElementGapRatio,
    letterGap: dotDur * timingConfig.charGapRatio,
    wordGap: dotDur * timingConfig.wordGapRatio,
  };
}

export function encodeToMorse(text: string, mode: ConversionMode, forcedScript: ScriptCode): ConversionResult {
  const script = forcedScript === 'auto' ? detectScript(text) : forcedScript;
  if (mode === 'universal') {
    const bytes = new TextEncoder().encode(text);
    const hexes: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const hex = bytes[i].toString(16).padStart(2, '0').toUpperCase();
      hexes.push(`${HEX_TO_MORSE[hex[0]]} ${HEX_TO_MORSE[hex[1]]}`);
    }
    return {
      originalText: text,
      romanizedText: `[UTF-8 Hex Representation of ${bytes.length} Bytes]`,
      morseCode: hexes.join(' / '),
      unsupportedChars: [],
      detectedScript: script,
      mode,
      direction: 'textToMorse'
    };
  } else {
    const romanizedText = transliterate(text, script);
    const unsupportedChars: string[] = [];
    const lines = romanizedText.split('\n');
    const encodedLines = lines.map(line => {
      return line.trim().split(/\s+/).map(word => {
        const chars: string[] = [];
        for (const char of word) {
          const upper = char.toUpperCase();
          if (LATIN_TO_MORSE[upper]) chars.push(LATIN_TO_MORSE[upper]);
          else {
            if (!unsupportedChars.includes(char) && char.trim() !== '') unsupportedChars.push(char);
            chars.push(`[${char}]`);
          }
        }
        return chars.join(' ');
      }).join(' / ');
    });
    return {
      originalText: text,
      romanizedText,
      morseCode: encodedLines.join('\n'),
      unsupportedChars,
      detectedScript: script,
      mode,
      direction: 'textToMorse'
    };
  }
}

export function decodeFromMorse(morseText: string, mode: ConversionMode) {
  if (!morseText.trim()) return { decodedText: '', error: null };
  if (mode === 'universal') {
    try {
      const byteTokens = morseText.trim().split(/\s*\/\s*/);
      const bytes: number[] = [];
      for (const token of byteTokens) {
        if (!token.trim()) continue;
        const hexes = token.trim().split(/\s+/);
        if (hexes.length !== 2) return { decodedText: '', error: 'Malformed Universal sequence.' };
        const high = MORSE_TO_HEX[hexes[0]];
        const low = MORSE_TO_HEX[hexes[1]];
        if (!high || !low) return { decodedText: '', error: 'Invalid Hex Morse symbol.' };
        bytes.push(parseInt(high + low, 16));
      }
      return { decodedText: new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)), error: null };
    } catch (e: any) {
      return { decodedText: '', error: `Decode Error: ${e.message}` };
    }
  } else {
    const lines = morseText.split('\n');
    const decodedLines = lines.map(line => {
      return line.split('/').map(word => {
        return word.trim().split(/\s+/).map(sym => MORSE_TO_LATIN[sym] || (sym.startsWith('[') ? sym.slice(1, -1) : '?')).join('');
      }).join(' ');
    });
    return { decodedText: decodedLines.join('\n'), error: null };
  }
}

export function generateWavBlob(
  morseText: string,
  wpmOrTiming: number | TimingDurations = 20,
  frequency = 600,
  volume = 0.8
) {
  const sampleRate = 44100;
  const { dotDur, dashDur, gap, letterGap, wordGap } =
    typeof wpmOrTiming === 'number'
      ? {
          dotDur: 1.2 / Math.max(1, wpmOrTiming),
          dashDur: (1.2 / Math.max(1, wpmOrTiming)) * 3,
          gap: 1.2 / Math.max(1, wpmOrTiming),
          letterGap: (1.2 / Math.max(1, wpmOrTiming)) * 3,
          wordGap: (1.2 / Math.max(1, wpmOrTiming)) * 7,
        }
      : wpmOrTiming;

  let totalDur = 0;
  for (let i = 0; i < morseText.length; i++) {
    const char = morseText[i];
    if (char === '.') totalDur += dotDur + gap;
    else if (char === '-') totalDur += dashDur + gap;
    else if (char === ' ') {
      // Check if surrounded by slash to prevent over-padding
      const prevChar = i > 0 ? morseText[i - 1] : '';
      const nextChar = i < morseText.length - 1 ? morseText[i + 1] : '';
      if (prevChar !== '/' && nextChar !== '/') {
        totalDur += letterGap;
      }
    } else if (char === '/' || char === '\n') {
      totalDur += wordGap;
    }
  }

  const numSamples = Math.max(1, Math.floor(totalDur * sampleRate));
  const buffer = new Float32Array(numSamples);
  let curr = 0;

  for (let i = 0; i < morseText.length; i++) {
    const char = morseText[i];
    let dur = 0;
    let isTone = false;
    let trailingGap = 0;

    if (char === '.') {
      dur = dotDur;
      isTone = true;
      trailingGap = gap;
    } else if (char === '-') {
      dur = dashDur;
      isTone = true;
      trailingGap = gap;
    } else if (char === ' ') {
      const prevChar = i > 0 ? morseText[i - 1] : '';
      const nextChar = i < morseText.length - 1 ? morseText[i + 1] : '';
      if (prevChar !== '/' && nextChar !== '/') {
        dur = letterGap;
      }
    } else if (char === '/' || char === '\n') {
      dur = wordGap;
    }

    const durSamples = Math.floor(dur * sampleRate);
    if (isTone) {
      const ramp = Math.min(Math.floor(0.005 * sampleRate), Math.floor(durSamples / 2));
      for (let j = 0; j < durSamples && curr < numSamples; j++) {
        let env = 1;
        if (ramp > 0) {
          if (j < ramp) env = j / ramp;
          else if (j > durSamples - ramp) env = (durSamples - j) / ramp;
        }
        buffer[curr++] = Math.sin(2 * Math.PI * frequency * (j / sampleRate)) * env * volume;
      }
      curr += Math.floor(trailingGap * sampleRate);
    } else {
      curr += durSamples;
    }
  }

  const wavBuffer = new ArrayBuffer(44 + buffer.length * 2);
  const view = new DataView(wavBuffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, buffer.length * 2, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([wavBuffer], { type: 'audio/wav' });
}
