/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ConversionMode, DirectionMode, ScriptCode, HistoryItem } from './types';
import { encodeToMorse, decodeFromMorse, generateWavBlob } from './engine';
import { SAMPLE_TEXTS, SCRIPT_LIST } from './constants';
import { useLocalStorage } from './hooks';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [mode, setMode] = useState<ConversionMode>('readable');
  const [direction, setDirection] = useState<DirectionMode>('textToMorse');
  const [script, setScript] = useState<ScriptCode>('auto');
  const [inputText, setInputText] = useState('SOS. HELLO WORLD');
  const [wpm, setWpm] = useState(20);
  const [frequency, setFrequency] = useState(600);
  const [volume, setVolume] = useState(0.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSymbolIndex, setActiveSymbolIndex] = useState(-1);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('morse_history', []);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const result = useMemo(() => {
    if (direction === 'textToMorse') {
      return encodeToMorse(inputText, mode, script);
    } else {
      const dec = decodeFromMorse(inputText, mode);
      return {
        romanizedText: dec.decodedText,
        morseCode: inputText,
        unsupportedChars: dec.error ? [dec.error] : [],
        detectedScript: 'latin' as ScriptCode
      };
    }
  }, [inputText, mode, direction, script]);

  const stopAudio = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsPlaying(false);
    setIsPulseActive(false);
    setActiveSymbolIndex(-1);
  }, []);

  const playAudio = useCallback(() => {
    stopAudio();
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    const ctx = audioCtxRef.current;
    const morse = result.morseCode;
    setIsPlaying(true);

    const dotDur = 1.2 / wpm;
    const dashDur = dotDur * 3;
    const gap = dotDur;
    const wordGap = dotDur * 7;

    let currentTime = ctx.currentTime + 0.05;

    for (let i = 0; i < morse.length; i++) {
      const char = morse[i];
      let dur = 0, isTone = false;
      if (char === '.') { dur = dotDur; isTone = true; }
      else if (char === '-') { dur = dashDur; isTone = true; }
      else if (char === ' ') { dur = dotDur * 3; }
      else if (char === '/' || char === '\n') { dur = wordGap; }

      if (isTone) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, currentTime);

        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.005);
        gainNode.gain.setValueAtTime(volume, currentTime + dur - 0.005);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + dur);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(currentTime);
        osc.stop(currentTime + dur);

        const startMs = (currentTime - ctx.currentTime) * 1000;
        const stopMs = (currentTime + dur - ctx.currentTime) * 1000;

        const t1 = window.setTimeout(() => {
          setIsPulseActive(true);
          setActiveSymbolIndex(i);
        }, Math.max(0, startMs));

        const t2 = window.setTimeout(() => {
          setIsPulseActive(false);
        }, Math.max(0, stopMs));

        timeoutsRef.current.push(t1, t2);
        currentTime += dur + gap;
      } else {
        currentTime += dur;
      }
    }

    const endMs = (currentTime - ctx.currentTime) * 1000;
    const endTid = window.setTimeout(stopAudio, Math.max(0, endMs));
    timeoutsRef.current.push(endTid);
  }, [result.morseCode, wpm, frequency, volume, stopAudio]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(direction === 'textToMorse' ? result.morseCode : result.romanizedText);
    showToast('Copied to clipboard!');
  };

  const downloadTxt = () => {
    const blob = new Blob([result.morseCode], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'morse.txt';
    a.click();
    showToast('Downloaded .TXT file');
  };

  const downloadWav = () => {
    const blob = generateWavBlob(result.morseCode, wpm, frequency, volume);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'morse.wav';
    a.click();
    showToast('Downloaded .WAV audio file');
  };

  const handleSaveToHistory = useCallback(() => {
    if (!inputText.trim()) return;
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      originalText: inputText,
      morseCode: result.morseCode,
      mode,
      script: result.detectedScript,
    };
    setHistory((prev) => {
      // Avoid duplicate consecutive saves
      if (prev.length > 0 && prev[0].originalText === inputText && prev[0].mode === mode) {
        return prev;
      }
      return [newItem, ...prev.slice(0, 19)];
    });
  }, [inputText, result, mode, setHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSaveToHistory();
    }, 1500);
    return () => clearTimeout(timer);
  }, [inputText, handleSaveToHistory]);

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: 'var(--accent-amber)' }}>Morse Universal</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Multilingual Morse Code Web Application</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${direction === 'textToMorse' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDirection('textToMorse')}>Text → Morse</button>
          <button className={`btn ${direction === 'morseToText' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDirection('morseToText')}>Morse → Text</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${mode === 'readable' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('readable')}>Readable International</button>
          <button className={`btn ${mode === 'universal' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('universal')}>Universal Unicode</button>
        </div>
      </div>

      {/* Sample Presets */}
      <div className="card">
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Quick Multilingual Presets:</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {SAMPLE_TEXTS.map(s => (
            <button key={s.label} className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setInputText(s.text)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source Input */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <label style={{ fontWeight: 600 }}>{direction === 'textToMorse' ? 'Source Text Input' : 'Morse Input (. / -)'}</label>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={() => setInputText('')}>Clear</button>
        </div>
        <textarea className="textarea-input" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Type or paste input here..." />
        <div className="counter-badge">
          <span>Chars: {inputText.length}</span>
          <span>Detected Script: {result.detectedScript}</span>
        </div>
      </div>

      {/* Editable Romanized Preview */}
      {direction === 'textToMorse' && mode === 'readable' && (
        <div className="card" style={{ borderColor: 'var(--accent-blue)' }}>
          <label style={{ fontWeight: 600, color: 'var(--accent-blue)', display: 'block', marginBottom: '0.5rem' }}>Editable Romanized Preview</label>
          <textarea className="textarea-input" style={{ minHeight: '70px' }} value={result.romanizedText} onChange={e => setInputText(e.target.value)} />
        </div>
      )}

      {/* Morse Output */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
          <label style={{ fontWeight: 600 }}>Morse Code Result</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={copyToClipboard}>Copy</button>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={downloadTxt}>.TXT</button>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={downloadWav}>.WAV</button>
          </div>
        </div>
        <div className="textarea-input" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: '110px' }}>
          {result.morseCode.split('').map((char, i) => (
            <span key={i} style={i === activeSymbolIndex ? { backgroundColor: 'var(--accent-amber)', color: '#000', borderRadius: '2px' } : {}}>
              {char}
            </span>
          ))}
        </div>
      </div>

      {/* Web Audio Controls */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {!isPlaying ? (
              <button className="btn btn-primary" onClick={playAudio}>▶ Play Audio</button>
            ) : (
              <button className="btn btn-primary" onClick={stopAudio}>⏹ Stop Audio</button>
            )}
            <div className={`signal-pulse ${isPulseActive ? 'active' : ''}`} title="Signal Pulse Indicator" />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isPlaying ? 'Playing Morse Tone...' : 'Audio Ready'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Speed (WPM): {wpm}</label>
            <input type="range" min="5" max="40" value={wpm} onChange={e => setWpm(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tone Pitch: {frequency}Hz</label>
            <input type="range" min="300" max="1000" step="10" value={frequency} onChange={e => setFrequency(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume: {Math.round(volume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* History Panel */}
      {history.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ fontWeight: 600 }}>Local Conversion History</label>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', minHeight: '32px' }} onClick={() => setHistory([])}>
              Clear History
            </button>
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setInputText(item.originalText);
                  setMode(item.mode);
                }}
                style={{
                  padding: '0.4rem',
                  borderBottom: '1px solid var(--card-border)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <strong>[{item.mode.toUpperCase()}]</strong> {item.originalText.slice(0, 40)}{item.originalText.length > 40 ? '...' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
