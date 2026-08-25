import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Volume2,
  Copy,
  Check,
  Search,
  Sparkles,
  Layers,
  Hash,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { ConversionMode, DirectionMode, ScriptCode } from '../types';
import { LATIN_TO_MORSE, MORSE_TO_LATIN, HEX_TO_MORSE, MORSE_TO_HEX } from '../constants';

interface CharacterReferenceDrawerProps {
  inputText: string;
  morseOutput: string;
  romanizedText?: string;
  mode: ConversionMode;
  direction: DirectionMode;
  wpm: number;
  frequency: number;
  volume: number;
  showToast: (msg: string) => void;
}

// NATO Phonetic Alphabet & Mnemonics
const NATO_PHONETICS: Record<string, { nato: string; mnemonic?: string; category: 'letter' | 'number' | 'punct' }> = {
  A: { nato: 'Alpha', mnemonic: 'di-DAH', category: 'letter' },
  B: { nato: 'Bravo', mnemonic: 'DAH-di-di-dit', category: 'letter' },
  C: { nato: 'Charlie', mnemonic: 'DAH-di-DAH-dit', category: 'letter' },
  D: { nato: 'Delta', mnemonic: 'DAH-di-dit', category: 'letter' },
  E: { nato: 'Echo', mnemonic: 'dit', category: 'letter' },
  F: { nato: 'Foxtrot', mnemonic: 'di-di-DAH-dit', category: 'letter' },
  G: { nato: 'Golf', mnemonic: 'DAH-DAH-dit', category: 'letter' },
  H: { nato: 'Hotel', mnemonic: 'di-di-di-dit', category: 'letter' },
  I: { nato: 'India', mnemonic: 'di-dit', category: 'letter' },
  J: { nato: 'Juliett', mnemonic: 'di-DAH-DAH-DAH', category: 'letter' },
  K: { nato: 'Kilo', mnemonic: 'DAH-di-DAH', category: 'letter' },
  L: { nato: 'Lima', mnemonic: 'di-DAH-di-dit', category: 'letter' },
  M: { nato: 'Mike', mnemonic: 'DAH-DAH', category: 'letter' },
  N: { nato: 'November', mnemonic: 'DAH-dit', category: 'letter' },
  O: { nato: 'Oscar', mnemonic: 'DAH-DAH-DAH', category: 'letter' },
  P: { nato: 'Papa', mnemonic: 'di-DAH-DAH-dit', category: 'letter' },
  Q: { nato: 'Quebec', mnemonic: 'DAH-DAH-di-DAH', category: 'letter' },
  R: { nato: 'Romeo', mnemonic: 'di-DAH-dit', category: 'letter' },
  S: { nato: 'Sierra', mnemonic: 'di-di-dit', category: 'letter' },
  T: { nato: 'Tango', mnemonic: 'DAH', category: 'letter' },
  U: { nato: 'Uniform', mnemonic: 'di-di-DAH', category: 'letter' },
  V: { nato: 'Victor', mnemonic: 'di-di-di-DAH', category: 'letter' },
  W: { nato: 'Whiskey', mnemonic: 'di-DAH-DAH', category: 'letter' },
  X: { nato: 'X-ray', mnemonic: 'DAH-di-di-DAH', category: 'letter' },
  Y: { nato: 'Yankee', mnemonic: 'DAH-di-DAH-DAH', category: 'letter' },
  Z: { nato: 'Zulu', mnemonic: 'DAH-DAH-di-dit', category: 'letter' },
  '0': { nato: 'Zero', mnemonic: 'DAH-DAH-DAH-DAH-DAH', category: 'number' },
  '1': { nato: 'One (Unaone)', mnemonic: 'di-DAH-DAH-DAH-DAH', category: 'number' },
  '2': { nato: 'Two (Bissotwo)', mnemonic: 'di-di-DAH-DAH-DAH', category: 'number' },
  '3': { nato: 'Three (Terrathree)', mnemonic: 'di-di-di-DAH-DAH', category: 'number' },
  '4': { nato: 'Four (Kartefour)', mnemonic: 'di-di-di-di-DAH', category: 'number' },
  '5': { nato: 'Five (Pantafive)', mnemonic: 'di-di-di-di-dit', category: 'number' },
  '6': { nato: 'Six (Soxisix)', mnemonic: 'DAH-di-di-di-dit', category: 'number' },
  '7': { nato: 'Seven (Setteseven)', mnemonic: 'DAH-DAH-di-di-dit', category: 'number' },
  '8': { nato: 'Eight (Oktoeight)', mnemonic: 'DAH-DAH-DAH-di-dit', category: 'number' },
  '9': { nato: 'Nine (Novonine)', mnemonic: 'DAH-DAH-DAH-DAH-dit', category: 'number' },
  '.': { nato: 'Period / Full Stop', mnemonic: 'di-DAH-di-DAH-di-DAH', category: 'punct' },
  ',': { nato: 'Comma', mnemonic: 'DAH-DAH-di-di-DAH-DAH', category: 'punct' },
  '?': { nato: 'Question Mark', mnemonic: 'di-di-DAH-DAH-di-dit', category: 'punct' },
  "'": { nato: 'Apostrophe', mnemonic: 'di-DAH-DAH-DAH-DAH-dit', category: 'punct' },
  '!': { nato: 'Exclamation Mark', mnemonic: 'DAH-di-DAH-di-DAH-DAH', category: 'punct' },
  '/': { nato: 'Slash / Fraction Bar', mnemonic: 'DAH-di-di-DAH-dit', category: 'punct' },
  '(': { nato: 'Left Parenthesis', mnemonic: 'DAH-di-DAH-DAH-dit', category: 'punct' },
  ')': { nato: 'Right Parenthesis', mnemonic: 'DAH-di-DAH-DAH-di-DAH', category: 'punct' },
  '&': { nato: 'Ampersand (Wait/AS)', mnemonic: 'di-DAH-di-di-dit', category: 'punct' },
  ':': { nato: 'Colon', mnemonic: 'DAH-DAH-DAH-di-di-dit', category: 'punct' },
  ';': { nato: 'Semicolon', mnemonic: 'DAH-di-DAH-di-DAH-dit', category: 'punct' },
  '=': { nato: 'Equals (Break/BT)', mnemonic: 'DAH-di-di-di-DAH', category: 'punct' },
  '+': { nato: 'Plus (End of Work/AR)', mnemonic: 'di-DAH-di-DAH-dit', category: 'punct' },
  '-': { nato: 'Hyphen / Dash', mnemonic: 'DAH-di-di-di-di-DAH', category: 'punct' },
  '_': { nato: 'Underscore', mnemonic: 'di-di-DAH-DAH-di-DAH', category: 'punct' },
  '"': { nato: 'Quotation Mark', mnemonic: 'di-DAH-di-di-DAH-dit', category: 'punct' },
  $: { nato: 'Dollar Sign', mnemonic: 'di-di-di-DAH-di-di-DAH', category: 'punct' },
  '@': { nato: 'At Sign (AC Commat)', mnemonic: 'di-DAH-DAH-di-DAH-dit', category: 'punct' },
};

export interface MappedOutputSymbol {
  character: string;
  morse: string;
  count: number;
  nato?: string;
  mnemonic?: string;
  category: 'letter' | 'number' | 'punct' | 'hex' | 'special';
}

export function CharacterReferenceDrawer({
  inputText,
  morseOutput,
  romanizedText,
  mode,
  direction,
  wpm,
  frequency,
  volume,
  showToast,
}: CharacterReferenceDrawerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'output' | 'library'>('output');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'letter' | 'number' | 'punct' | 'hex'>('all');
  const [copiedChar, setCopiedChar] = useState<string | null>(null);
  const [playingChar, setPlayingChar] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const toneTimeoutRef = useRef<number | null>(null);

  // Audio Context
  const getAudioContext = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Play Morse tone for a single character
  const playCharacterTone = useCallback((char: string, morseCode: string) => {
    if (toneTimeoutRef.current) {
      clearTimeout(toneTimeoutRef.current);
    }
    try {
      const ctx = getAudioContext();
      setPlayingChar(char);

      const dotDur = 1.2 / Math.max(1, wpm);
      const dashDur = dotDur * 3;
      const gap = dotDur;

      let currentTime = ctx.currentTime + 0.03;

      for (let i = 0; i < morseCode.length; i++) {
        const symbol = morseCode[i];
        if (symbol === '.' || symbol === '-') {
          const dur = symbol === '.' ? dotDur : dashDur;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(frequency, currentTime);

          const attack = Math.min(0.005, dur * 0.1);
          gain.gain.setValueAtTime(0, currentTime);
          gain.gain.linearRampToValueAtTime(volume, currentTime + attack);
          gain.gain.setValueAtTime(volume, currentTime + dur - attack);
          gain.gain.linearRampToValueAtTime(0, currentTime + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(currentTime);
          osc.stop(currentTime + dur);

          currentTime += dur + gap;
        }
      }

      const totalMs = (currentTime - ctx.currentTime) * 1000;
      toneTimeoutRef.current = window.setTimeout(() => {
        setPlayingChar(null);
      }, Math.max(0, totalMs + 50));
    } catch (e) {
      console.error(e);
      setPlayingChar(null);
    }
  }, [getAudioContext, wpm, frequency, volume]);

  const handleCopySymbol = (char: string, morse: string) => {
    navigator.clipboard.writeText(`${char}: ${morse}`);
    setCopiedChar(char);
    showToast(`Copied ${char} (${morse}) to clipboard`);
    setTimeout(() => setCopiedChar(null), 1800);
  };

  // Extract unique characters and their counts from current output
  const outputSymbols = useMemo<MappedOutputSymbol[]>(() => {
    if (mode === 'universal') {
      // Universal hex mode output format: [HEX1 HEX2] / [HEX3 HEX4]
      // or morse tokens
      const hexMap: Record<string, number> = {};
      const tokens = morseOutput.trim().split(/\s+/);
      tokens.forEach((tok) => {
        if (tok === '/' || !tok) return;
        const hexChar = MORSE_TO_HEX[tok];
        if (hexChar) {
          hexMap[hexChar] = (hexMap[hexChar] || 0) + 1;
        }
      });

      return Object.entries(hexMap).map(([hex, count]) => ({
        character: `0x${hex}`,
        morse: HEX_TO_MORSE[hex] || '',
        count,
        nato: `Hex Nibble ${hex}`,
        mnemonic: `Byte Value ${(parseInt(hex, 16) || 0).toString(2).padStart(4, '0')}`,
        category: 'hex',
      }));
    }

    // Readable Latin mode
    const charCountMap: Record<string, { count: number; morse: string }> = {};

    if (direction === 'textToMorse') {
      // Extract from romanized text or source text
      const targetText = (romanizedText || inputText).toUpperCase();
      for (const char of targetText) {
        if (LATIN_TO_MORSE[char]) {
          if (!charCountMap[char]) {
            charCountMap[char] = { count: 0, morse: LATIN_TO_MORSE[char] };
          }
          charCountMap[char].count += 1;
        }
      }
    } else {
      // Morse to Text: Extract tokens from Morse input
      const words = morseOutput.split('/');
      for (const word of words) {
        const tokens = word.trim().split(/\s+/);
        for (const tok of tokens) {
          if (!tok) continue;
          const char = MORSE_TO_LATIN[tok];
          if (char) {
            if (!charCountMap[char]) {
              charCountMap[char] = { count: 0, morse: tok };
            }
            charCountMap[char].count += 1;
          }
        }
      }
    }

    const list: MappedOutputSymbol[] = Object.entries(charCountMap).map(([char, data]) => {
      const info = NATO_PHONETICS[char];
      return {
        character: char,
        morse: data.morse,
        count: data.count,
        nato: info?.nato || (char >= '0' && char <= '9' ? `Digit ${char}` : 'Special'),
        mnemonic: info?.mnemonic,
        category: info?.category || (/^[A-Z]$/.test(char) ? 'letter' : /^[0-9]$/.test(char) ? 'number' : 'punct'),
      };
    });

    // Sort by frequency (highest count first) then alphabetically
    return list.sort((a, b) => b.count - a.count || a.character.localeCompare(b.character));
  }, [morseOutput, inputText, romanizedText, mode, direction]);

  // Full International Morse Dictionary
  const fullLibrary = useMemo<MappedOutputSymbol[]>(() => {
    if (mode === 'universal') {
      return Object.entries(HEX_TO_MORSE).map(([hex, morse]) => ({
        character: `0x${hex}`,
        morse,
        count: 0,
        nato: `Hex Nibble ${hex}`,
        mnemonic: `Nibble: ${(parseInt(hex, 16) || 0).toString(2).padStart(4, '0')} (${parseInt(hex, 16)})`,
        category: 'hex',
      }));
    }

    return Object.entries(LATIN_TO_MORSE).map(([char, morse]) => {
      const info = NATO_PHONETICS[char];
      return {
        character: char,
        morse,
        count: 0,
        nato: info?.nato || (char >= '0' && char <= '9' ? `Digit ${char}` : 'Special Symbol'),
        mnemonic: info?.mnemonic,
        category: info?.category || (/^[A-Z]$/.test(char) ? 'letter' : /^[0-9]$/.test(char) ? 'number' : 'punct'),
      };
    });
  }, [mode]);

  // Filtered Library according to search and category
  const filteredLibrary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fullLibrary.filter((item) => {
      const matchesCat = filterCategory === 'all' || item.category === filterCategory;
      if (!matchesCat) return false;
      if (!q) return true;

      return (
        item.character.toLowerCase().includes(q) ||
        item.morse.toLowerCase().includes(q) ||
        (item.nato && item.nato.toLowerCase().includes(q)) ||
        (item.mnemonic && item.mnemonic.toLowerCase().includes(q))
      );
    });
  }, [fullLibrary, searchQuery, filterCategory]);

  const activeOutputCharsSet = useMemo(() => {
    return new Set(outputSymbols.map((s) => s.character));
  }, [outputSymbols]);

  return (
    <div
      className="card"
      style={{
        padding: '0',
        overflow: 'hidden',
        border: '1px solid var(--card-border)',
        backgroundColor: 'var(--card-bg)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Drawer Header Toggle Bar */}
      <div
        id="character-reference-drawer-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.2rem',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isOpen ? 'rgba(245, 158, 11, 0.06)' : 'rgba(0, 0, 0, 0.15)',
          borderBottom: isOpen ? '1px solid var(--card-border)' : 'none',
          transition: 'background-color 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--accent-amber)',
            }}
          >
            <BookOpen size={16} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Expandable Character Reference & Output Dictionary
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  backgroundColor: outputSymbols.length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                  color: outputSymbols.length > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  border: `1px solid ${outputSymbols.length > 0 ? 'rgba(245, 158, 11, 0.4)' : 'transparent'}`,
                }}
              >
                {outputSymbols.length} Symbol{outputSymbols.length === 1 ? '' : 's'} in Output
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Visual mapping of Morse symbols (. / -), phonetic cues, sound preview, and full reference dictionary
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {isOpen ? 'Collapse' : 'Expand'}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)',
            }}
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Drawer Collapsible Body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Internal Tab Navigation & View Selector */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  borderBottom: '1px solid var(--card-border)',
                  paddingBottom: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    id="drawer-tab-output-symbols"
                    className={`btn ${activeTab === 'output' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('output')}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem', gap: '0.4rem' }}
                  >
                    <Layers size={14} />
                    <span>Current Output Symbols ({outputSymbols.length})</span>
                  </button>

                  <button
                    type="button"
                    id="drawer-tab-full-library"
                    className={`btn ${activeTab === 'library' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('library')}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem', gap: '0.4rem' }}
                  >
                    <Hash size={14} />
                    <span>Full Reference Library ({fullLibrary.length})</span>
                  </button>
                </div>

                {/* Library Filter Pills or Quick Stats */}
                {activeTab === 'library' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', minWidth: '160px' }}>
                      <Search
                        size={13}
                        style={{
                          position: 'absolute',
                          left: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-secondary)',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search char or Morse..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.3rem 0.5rem 0.3rem 1.7rem',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: '1px solid var(--card-border)',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {(['all', 'letter', 'number', 'punct'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`btn ${filterCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setFilterCategory(cat)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.72rem',
                            textTransform: 'capitalize',
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TAB 1: CURRENT OUTPUT SYMBOLS */}
              {activeTab === 'output' && (
                <div>
                  {outputSymbols.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                        borderRadius: '8px',
                        border: '1px dashed var(--card-border)',
                      }}
                    >
                      <Sparkles size={24} color="var(--accent-amber)" style={{ marginBottom: '0.5rem', opacity: 0.7 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                        No Morse Output Generated Yet
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '380px' }}>
                        Enter source text in the input box above or choose a preset to see its instant character-to-Morse dictionary breakdown.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                        gap: '0.65rem',
                      }}
                    >
                      {outputSymbols.map((item) => {
                        const isPlaying = playingChar === item.character;
                        const isCopied = copiedChar === item.character;

                        return (
                          <div
                            key={item.character}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '0.75rem',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(0, 0, 0, 0.25)',
                              border: isPlaying ? '1px solid var(--accent-amber)' : '1px solid var(--card-border)',
                              boxShadow: isPlaying ? '0 0 12px rgba(245, 158, 11, 0.3)' : 'none',
                              position: 'relative',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {/* Card Top: Char & Count */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span
                                  style={{
                                    fontSize: '1.25rem',
                                    fontWeight: 800,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1,
                                  }}
                                >
                                  {item.character}
                                </span>
                                {item.nato && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {item.nato}
                                  </span>
                                )}
                              </div>

                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  color: 'var(--accent-amber)',
                                }}
                                title={`${item.count} occurrences in active output`}
                              >
                                ×{item.count}
                              </span>
                            </div>

                            {/* Morse Sequence with graphical Dit / Dah waveform */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                marginBottom: '0.5rem',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '5px',
                                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '1.05rem',
                                  letterSpacing: '0.15em',
                                  fontWeight: 700,
                                  color: isPlaying ? 'var(--accent-amber)' : 'var(--accent-blue)',
                                }}
                              >
                                {item.morse}
                              </span>

                              {/* Visual Dit/Dah graphic pulses */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
                                {item.morse.split('').map((sym, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      height: '6px',
                                      width: sym === '.' ? '6px' : '14px',
                                      borderRadius: sym === '.' ? '50%' : '3px',
                                      backgroundColor: isPlaying ? 'var(--accent-amber)' : '#64748b',
                                      transition: 'background-color 0.1s ease',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Mnemonic Rhythmic Guide */}
                            {item.mnemonic && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontStyle: 'italic' }}>
                                {item.mnemonic}
                              </div>
                            )}

                            {/* Action Buttons: Play Tone & Copy */}
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: 'auto' }}>
                              <button
                                type="button"
                                className={`btn ${isPlaying ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => playCharacterTone(item.character, item.morse)}
                                disabled={isPlaying}
                                style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.72rem', gap: '0.3rem' }}
                                title={`Listen to Morse audio for "${item.character}"`}
                              >
                                <Volume2 size={12} />
                                <span>{isPlaying ? 'Playing...' : 'Play Tone'}</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleCopySymbol(item.character, item.morse)}
                                style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
                                title="Copy character and Morse code"
                              >
                                {isCopied ? <Check size={12} color="var(--success-color)" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FULL INTERNATIONAL REFERENCE LIBRARY */}
              {activeTab === 'library' && (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '0.5rem',
                    }}
                  >
                    {filteredLibrary.map((item) => {
                      const isPresentInOutput = activeOutputCharsSet.has(item.character);
                      const isPlaying = playingChar === item.character;

                      return (
                        <div
                          key={item.character}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '0.55rem',
                            borderRadius: '6px',
                            backgroundColor: isPresentInOutput ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                            border: isPlaying
                              ? '1px solid var(--accent-amber)'
                              : isPresentInOutput
                              ? '1px solid rgba(245, 158, 11, 0.35)'
                              : '1px solid var(--card-border)',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {item.character}
                            </span>
                            {isPresentInOutput && (
                              <span
                                style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  color: 'var(--accent-amber)',
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  padding: '0.08rem 0.3rem',
                                  borderRadius: '4px',
                                }}
                              >
                                In Message
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.9rem',
                              letterSpacing: '0.12em',
                              fontWeight: 700,
                              color: isPlaying ? 'var(--accent-amber)' : 'var(--accent-blue)',
                              margin: '0.2rem 0',
                            }}
                          >
                            {item.morse}
                          </div>

                          {item.nato && (
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.nato}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: 'auto' }}>
                            <button
                              type="button"
                              className={`btn ${isPlaying ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => playCharacterTone(item.character, item.morse)}
                              style={{ flex: 1, padding: '0.18rem 0.3rem', fontSize: '0.68rem', gap: '0.2rem' }}
                              title={`Play tone for ${item.character}`}
                            >
                              <Volume2 size={11} />
                              <span>Play</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleCopySymbol(item.character, item.morse)}
                              style={{ padding: '0.18rem 0.35rem', fontSize: '0.68rem' }}
                              title="Copy"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredLibrary.length === 0 && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      No characters matched "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
