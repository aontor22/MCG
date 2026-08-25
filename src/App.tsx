/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trash2,
  Download,
  Radio,
  Mic,
  MessageSquare,
  Binary,
  Volume2,
  Sparkles,
  Star,
  GraduationCap,
  Undo2,
  Redo2,
} from 'lucide-react';
import { ConversionMode, DirectionMode, ScriptCode, HistoryItem, MorseTimingConfig, VisualFlashConfig } from './types';
import { encodeToMorse, decodeFromMorse, generateWavBlob, calculateTimingDurations } from './engine';
import { SAMPLE_TEXTS, SCRIPT_LIST } from './constants';
import { useLocalStorage } from './hooks';
import { AudioTranscriber } from './components/AudioTranscriber';
import { GeminiChatbot } from './components/GeminiChatbot';
import { LiveVoiceConversation } from './components/LiveVoiceConversation';
import { AudioTimingControls } from './components/AudioTimingControls';
import { HistoryAndFavorites } from './components/HistoryAndFavorites';
import { VisualFlashControls, VisualFlashOverlay } from './components/VisualFlashControls';
import { MorsePracticeMode } from './components/MorsePracticeMode';
import { CharacterReferenceDrawer } from './components/CharacterReferenceDrawer';

type ActiveTab = 'converter' | 'practice' | 'transcribe' | 'chat' | 'live';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState<ActiveTab>('converter');
  const [mode, setMode] = useState<ConversionMode>('readable');
  const [direction, setDirection] = useState<DirectionMode>('textToMorse');
  const [script, setScript] = useState<ScriptCode>('auto');
  const [inputText, setInputText] = useState('SOS. HELLO WORLD');
  const [wpm, setWpm] = useState(20);
  const [frequency, setFrequency] = useState(600);
  const [volume, setVolume] = useState(0.8);
  const [timingConfig, setTimingConfig] = useState<MorseTimingConfig>({
    mode: 'standard',
    protocolPreset: 'itu-standard',
    dotDurationMs: 60,
    dashRatio: 3.0,
    intraElementGapRatio: 1.0,
    charGapRatio: 3.0,
    wordGapRatio: 7.0,
    useFarnsworth: false,
    farnsworthCharWpm: 20,
    farnsworthOverallWpm: 10,
  });
  const [flashConfig, setFlashConfig] = useLocalStorage<VisualFlashConfig>('morse_visual_flash_config', {
    enabled: true,
    mode: 'both',
    color: 'amber',
    intensity: 0.75,
    pulseCardBorders: true,
    highlightActiveChar: true,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSymbolIndex, setActiveSymbolIndex] = useState(-1);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('morse_history', []);
  const [autoPlayOnChange, setAutoPlayOnChange] = useLocalStorage<boolean>('morse_auto_play_on_change', false);

  // Undo / Redo Stack State for Source Text Input
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const undoTimerRef = useRef<number | null>(null);
  const lastCommittedTextRef = useRef<string>(inputText);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const manualOscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const isFirstMount = useRef<boolean>(true);
  const previousInputRef = useRef<string>(inputText);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const pushUndoSnapshot = useCallback((snapshotText: string) => {
    setUndoStack((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === snapshotText) {
        return prev;
      }
      return [...prev.slice(-49), snapshotText];
    });
    setRedoStack([]);
  }, []);

  const handleSetInputTextImmediate = useCallback(
    (newText: string, toastMessage?: string) => {
      if (newText === inputText) return;
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      pushUndoSnapshot(inputText);
      lastCommittedTextRef.current = newText;
      setInputText(newText);
      if (toastMessage) {
        showToast(toastMessage);
      }
    },
    [inputText, pushUndoSnapshot]
  );

  const handleTextAreaChange = useCallback(
    (newVal: string) => {
      setInputText(newVal);

      if (!undoTimerRef.current) {
        pushUndoSnapshot(lastCommittedTextRef.current);
      } else {
        clearTimeout(undoTimerRef.current);
      }

      undoTimerRef.current = window.setTimeout(() => {
        lastCommittedTextRef.current = newVal;
        undoTimerRef.current = null;
      }, 550);
    },
    [pushUndoSnapshot]
  );

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (undoStack.length === 0) {
      showToast('Nothing to undo');
      return;
    }

    const prevText = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, inputText]);
    setInputText(prevText);
    lastCommittedTextRef.current = prevText;
    showToast('↩ Undone recent edit');
  }, [undoStack, inputText]);

  const handleRedo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (redoStack.length === 0) {
      showToast('Nothing to redo');
      return;
    }

    const nextText = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, inputText]);
    setInputText(nextText);
    lastCommittedTextRef.current = nextText;
    showToast('↪ Redone edit');
  }, [redoStack, inputText]);

  const activeDurations = useMemo(() => {
    return calculateTimingDurations(timingConfig, wpm);
  }, [timingConfig, wpm]);

  const handleTranscribeComplete = (text: string, insertMode: 'append' | 'replace' = 'replace') => {
    const nextVal = insertMode === 'append' ? (inputText ? `${inputText} ${text}` : text) : text;
    handleSetInputTextImmediate(nextVal, 'Transcribed audio into Source Text');
  };

  const handleInsertFromChat = (text: string) => {
    handleSetInputTextImmediate(text, 'Loaded text into Morse Converter');
    setActiveTab('converter');
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
        detectedScript: 'latin' as ScriptCode,
      };
    }
  }, [inputText, mode, direction, script]);

  const stopAudio = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsPlaying(false);
    setIsPulseActive(false);
    setActiveSymbolIndex(-1);

    if (manualOscRef.current) {
      try {
        manualOscRef.current.osc.stop();
        manualOscRef.current.osc.disconnect();
      } catch (_) {}
      manualOscRef.current = null;
    }
  }, []);

  const handleManualFlashStart = useCallback(() => {
    setIsPulseActive(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (!manualOscRef.current) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.005);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        manualOscRef.current = { osc, gain: gainNode };
      }
    } catch (e) {
      console.error(e);
    }
  }, [frequency, volume]);

  const handleManualFlashEnd = useCallback(() => {
    setIsPulseActive(false);
    if (manualOscRef.current && audioCtxRef.current) {
      try {
        const ctx = audioCtxRef.current;
        const { osc, gain } = manualOscRef.current;
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.005);
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch (_) {}
        }, 10);
      } catch (_) {}
      manualOscRef.current = null;
    }
  }, []);

  const playAudio = useCallback(() => {
    stopAudio();
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    const ctx = audioCtxRef.current;
    const morse = result.morseCode;
    setIsPlaying(true);

    const { dotDur, dashDur, gap, letterGap, wordGap } = activeDurations;

    let currentTime = ctx.currentTime + 0.05;

    for (let i = 0; i < morse.length; i++) {
      const char = morse[i];
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
        const prev = i > 0 ? morse[i - 1] : '';
        const next = i < morse.length - 1 ? morse[i + 1] : '';
        if (prev !== '/' && next !== '/') {
          dur = letterGap;
        }
      } else if (char === '/' || char === '\n') {
        dur = wordGap;
      }

      if (isTone) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, currentTime);

        const ramp = Math.min(0.005, dur / 2);
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, currentTime + ramp);
        gainNode.gain.setValueAtTime(volume, currentTime + dur - ramp);
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
        currentTime += dur + trailingGap;
      } else {
        currentTime += dur;
      }
    }

    const endMs = (currentTime - ctx.currentTime) * 1000;
    const endTid = window.setTimeout(stopAudio, Math.max(0, endMs));
    timeoutsRef.current.push(endTid);
  }, [result.morseCode, activeDurations, frequency, volume, stopAudio]);

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
    const blob = generateWavBlob(result.morseCode, activeDurations, frequency, volume);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'morse.wav';
    a.click();
    showToast('Downloaded .WAV audio file');
  };

  const isCurrentPinned = useMemo(() => {
    if (!inputText || !inputText.trim()) return false;
    return history.some((item) => item.originalText === inputText && item.mode === mode && item.isFavorite);
  }, [history, inputText, mode]);

  const handleTogglePinCurrent = () => {
    if (!inputText || !inputText.trim()) {
      showToast('Please enter text first');
      return;
    }

    const existingIndex = history.findIndex(
      (item) => item.originalText === inputText && item.mode === mode
    );

    if (existingIndex >= 0) {
      const willBePinned = !history[existingIndex].isFavorite;
      setHistory((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, isFavorite: willBePinned } : item
        )
      );
      showToast(willBePinned ? '★ Pinned to Favorites' : 'Unpinned from Favorites');
    } else {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        originalText: inputText,
        morseCode: result.morseCode,
        mode,
        script: result.detectedScript,
        isFavorite: true,
      };
      setHistory((prev) => [newItem, ...prev.slice(0, 29)]);
      showToast('★ Pinned to Favorites');
    }
  };

  const handlePlayMorseDirect = useCallback(
    (morse: string) => {
      stopAudio();
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      setIsPlaying(true);
      const { dotDur, dashDur, gap, letterGap, wordGap } = activeDurations;
      let currentTime = ctx.currentTime + 0.05;

      for (let i = 0; i < morse.length; i++) {
        const char = morse[i];
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
          const prev = i > 0 ? morse[i - 1] : '';
          const next = i < morse.length - 1 ? morse[i + 1] : '';
          if (prev !== '/' && next !== '/') {
            dur = letterGap;
          }
        } else if (char === '/' || char === '\n') {
          dur = wordGap;
        }

        if (isTone) {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(frequency, currentTime);

          const ramp = Math.min(0.005, dur / 2);
          gainNode.gain.setValueAtTime(0, currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, currentTime + ramp);
          gainNode.gain.setValueAtTime(volume, currentTime + dur - ramp);
          gainNode.gain.linearRampToValueAtTime(0, currentTime + dur);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(currentTime);
          osc.stop(currentTime + dur);

          const startMs = (currentTime - ctx.currentTime) * 1000;
          const stopMs = (currentTime + dur - ctx.currentTime) * 1000;

          const t1 = window.setTimeout(() => {
            setIsPulseActive(true);
          }, Math.max(0, startMs));

          const t2 = window.setTimeout(() => {
            setIsPulseActive(false);
          }, Math.max(0, stopMs));

          timeoutsRef.current.push(t1, t2);
          currentTime += dur + trailingGap;
        } else {
          currentTime += dur;
        }
      }

      const endMs = (currentTime - ctx.currentTime) * 1000;
      const endTid = window.setTimeout(stopAudio, Math.max(0, endMs));
      timeoutsRef.current.push(endTid);
    },
    [activeDurations, frequency, volume, stopAudio]
  );

  const handleLoadHistoryItem = (item: HistoryItem) => {
    handleSetInputTextImmediate(item.originalText);
    setMode(item.mode);
    if (item.script && item.script !== 'auto') {
      setScript(item.script);
    }
    showToast(item.isFavorite ? '★ Loaded pinned favorite sequence' : 'Loaded sequence from history');
  };

  const handleSaveToHistory = useCallback(() => {
    if (!inputText.trim()) return;
    setHistory((prev) => {
      const existing = prev.find(
        (item) => item.originalText === inputText && item.mode === mode
      );

      const newItem: HistoryItem = {
        id: existing ? existing.id : Date.now().toString(),
        timestamp: Date.now(),
        originalText: inputText,
        morseCode: result.morseCode,
        mode,
        script: result.detectedScript,
        isFavorite: existing ? existing.isFavorite : false,
      };

      if (prev.length > 0 && prev[0].originalText === inputText && prev[0].mode === mode) {
        return prev;
      }
      const filtered = prev.filter(
        (item) => !(item.originalText === inputText && item.mode === mode)
      );
      return [newItem, ...filtered.slice(0, 29)];
    });
  }, [inputText, result, mode, setHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSaveToHistory();
    }, 1500);
    return () => clearTimeout(timer);
  }, [inputText, handleSaveToHistory]);

  // Auto-play Morse audio whenever input text changes (debounced)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      previousInputRef.current = inputText;
      return;
    }

    if (previousInputRef.current === inputText) {
      return;
    }
    previousInputRef.current = inputText;

    if (!autoPlayOnChange || !result.morseCode.trim() || activeTab !== 'converter') {
      return;
    }

    const timer = setTimeout(() => {
      playAudio();
    }, 450);

    return () => clearTimeout(timer);
  }, [inputText, autoPlayOnChange, playAudio, result.morseCode, activeTab]);

  return (
    <>
      <VisualFlashOverlay config={flashConfig} isPulseActive={isPulseActive} />
      <div className="container">
        {/* Header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--accent-amber)', margin: 0 }}>Morse Universal</h1>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--accent-amber)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: 600,
              }}
            >
              AI + Multi-Turn + Live
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Universal Multilingual Morse Code & AI Intelligence Suite</p>
        </div>
        <button
          id="theme-toggle-btn"
          type="button"
          className="btn btn-secondary"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: '0.4rem',
          padding: '0.5rem',
          overflowX: 'auto',
          alignItems: 'center',
        }}
      >
        <button
          id="tab-converter-btn"
          type="button"
          className={`btn ${activeTab === 'converter' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('converter')}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.86rem', flexShrink: 0 }}
        >
          <Binary size={15} />
          <span>Morse Engine</span>
        </button>

        <button
          id="tab-practice-btn"
          type="button"
          className={`btn ${activeTab === 'practice' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('practice')}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.86rem', flexShrink: 0 }}
        >
          <GraduationCap size={15} />
          <span>Practice Academy</span>
        </button>

        <button
          id="tab-transcribe-btn"
          type="button"
          className={`btn ${activeTab === 'transcribe' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('transcribe')}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.86rem', flexShrink: 0 }}
        >
          <Mic size={15} />
          <span>Transcribe Audio</span>
        </button>

        <button
          id="tab-chat-btn"
          type="button"
          className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('chat')}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.86rem', flexShrink: 0 }}
        >
          <MessageSquare size={15} />
          <span>Gemini Chatbot</span>
        </button>

        <button
          id="tab-live-btn"
          type="button"
          className={`btn ${activeTab === 'live' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('live')}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.86rem', flexShrink: 0 }}
        >
          <Radio size={15} />
          <span>Live Voice</span>
        </button>
      </div>

      {/* TAB 1: MORSE ENGINE CONVERTER */}
      {activeTab === 'converter' && (
        <>
          {/* Mode Selector */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${direction === 'textToMorse' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDirection('textToMorse')}
              >
                Text → Morse
              </button>
              <button
                className={`btn ${direction === 'morseToText' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDirection('morseToText')}
              >
                Morse → Text
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${mode === 'readable' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('readable')}
              >
                Readable International
              </button>
              <button
                className={`btn ${mode === 'universal' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('universal')}
              >
                Universal Unicode
              </button>
            </div>
          </div>

          {/* Sample Presets */}
          <div className="card">
            <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
              Quick Multilingual Presets:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {SAMPLE_TEXTS.map((s) => (
                <button
                  key={s.label}
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => handleSetInputTextImmediate(s.text, `Loaded "${s.label}" preset`)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Input */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontWeight: 600, margin: 0 }}>
                  {direction === 'textToMorse' ? 'Source Text Input' : 'Morse Input (. / -)'}
                </label>
                {(undoStack.length > 0 || redoStack.length > 0) && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      color: 'var(--text-secondary)',
                    }}
                    title="Undo / Redo stack depth"
                  >
                    {undoStack.length} ↩ / {redoStack.length} ↪
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Undo Button */}
                <button
                  id="source-input-undo-btn"
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.78rem',
                    gap: '0.3rem',
                    opacity: undoStack.length === 0 ? 0.45 : 1,
                    cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={undoStack.length === 0}
                  onClick={handleUndo}
                  title={`Undo recent text edit (Ctrl+Z / Cmd+Z) — ${undoStack.length} state${undoStack.length === 1 ? '' : 's'} available`}
                >
                  <Undo2 size={13} />
                  <span>Undo</span>
                  {undoStack.length > 0 && (
                    <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>({undoStack.length})</span>
                  )}
                </button>

                {/* Redo Button */}
                <button
                  id="source-input-redo-btn"
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.78rem',
                    gap: '0.3rem',
                    opacity: redoStack.length === 0 ? 0.45 : 1,
                    cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={redoStack.length === 0}
                  onClick={handleRedo}
                  title={`Redo text edit (Ctrl+Y / Cmd+Shift+Z) — ${redoStack.length} state${redoStack.length === 1 ? '' : 's'} available`}
                >
                  <Redo2 size={13} />
                  <span>Redo</span>
                  {redoStack.length > 0 && (
                    <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>({redoStack.length})</span>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem', gap: '0.3rem' }}
                  onClick={() => setActiveTab('transcribe')}
                  title="Transcribe spoken audio or Morse beeps with microphone"
                >
                  <Mic size={13} style={{ color: 'var(--accent-amber)' }} />
                  <span>Mic Transcribe</span>
                </button>

                <button
                  id="source-input-clear-btn"
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                  onClick={() => handleSetInputTextImmediate('', 'Cleared text input (use Undo to restore)')}
                  title="Clear input text (recoverable with Undo)"
                >
                  Clear
                </button>
              </div>
            </div>

            <textarea
              id="source-text-input"
              className="textarea-input"
              value={inputText}
              onChange={(e) => handleTextAreaChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                  if (e.shiftKey) {
                    e.preventDefault();
                    handleRedo();
                  } else {
                    e.preventDefault();
                    handleUndo();
                  }
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                  e.preventDefault();
                  handleRedo();
                }
              }}
              placeholder="Type or paste input here... (Ctrl+Z to undo, Ctrl+Y to redo)"
            />
            <div className="counter-badge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span>Chars: {inputText.length}</span>
                <span>Words: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}</span>
              </div>
              <span>Detected Script: {result.detectedScript}</span>
            </div>
          </div>

          {/* Editable Romanized Preview */}
          {direction === 'textToMorse' && mode === 'readable' && (
            <div className="card" style={{ borderColor: 'var(--accent-blue)' }}>
              <label style={{ fontWeight: 600, color: 'var(--accent-blue)', display: 'block', marginBottom: '0.5rem' }}>
                Editable Romanized Preview
              </label>
              <textarea
                className="textarea-input"
                style={{ minHeight: '70px' }}
                value={result.romanizedText}
                onChange={(e) => handleTextAreaChange(e.target.value)}
              />
            </div>
          )}

          {/* Morse Output */}
          <div
            className={`card card-flash-pulse ${
              flashConfig.pulseCardBorders && isPulseActive ? `pulsing-${flashConfig.color}` : ''
            }`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>Morse Code Result</label>
                
                {/* Auto-Play on Text Change Toggle Switch */}
                <label
                  id="auto-play-toggle-label"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '20px',
                    backgroundColor: autoPlayOnChange ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${autoPlayOnChange ? 'var(--accent-amber)' : 'var(--card-border)'}`,
                    transition: 'all 0.2s ease',
                  }}
                  title="Automatically play Morse audio tone whenever input text changes"
                >
                  <input
                    id="auto-play-input-toggle"
                    type="checkbox"
                    checked={autoPlayOnChange}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setAutoPlayOnChange(enabled);
                      showToast(enabled ? '🔊 Auto-Play on text edit enabled' : '🔇 Auto-Play on text edit disabled');
                    }}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                  {/* Custom Toggle Track & Thumb */}
                  <div
                    style={{
                      width: '28px',
                      height: '16px',
                      borderRadius: '10px',
                      backgroundColor: autoPlayOnChange ? 'var(--accent-amber)' : '#475569',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '2px',
                        left: autoPlayOnChange ? '14px' : '2px',
                        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: autoPlayOnChange ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Volume2 size={12} />
                    Auto-Play
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  id="pin-morse-result-btn"
                  className="btn btn-secondary"
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.78rem',
                    gap: '0.35rem',
                    borderColor: isCurrentPinned ? 'var(--accent-amber)' : undefined,
                    color: isCurrentPinned ? 'var(--accent-amber)' : undefined,
                    backgroundColor: isCurrentPinned ? 'rgba(245, 158, 11, 0.15)' : undefined,
                  }}
                  onClick={handleTogglePinCurrent}
                  title={isCurrentPinned ? 'Unpin from Favorites' : 'Pin current Morse sequence to Favorites'}
                >
                  <Star
                    size={13}
                    fill={isCurrentPinned ? 'var(--accent-amber)' : 'none'}
                    color="var(--accent-amber)"
                  />
                  <span>{isCurrentPinned ? 'Pinned' : 'Pin Favorite'}</span>
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }} onClick={copyToClipboard}>
                  Copy
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }} onClick={downloadTxt}>
                  .TXT
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }} onClick={downloadWav}>
                  .WAV
                </button>
              </div>
            </div>
            <div className="textarea-input" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: '110px' }}>
              {result.morseCode.split('').map((char, i) => {
                const isActive = i === activeSymbolIndex;
                let charStyle: React.CSSProperties | undefined = undefined;
                if (isActive && flashConfig.highlightActiveChar) {
                  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
                    amber: { bg: '#f59e0b', text: '#000', glow: '#f59e0b' },
                    white: { bg: '#ffffff', text: '#000', glow: '#ffffff' },
                    green: { bg: '#22c55e', text: '#000', glow: '#22c55e' },
                    cyan: { bg: '#06b6d4', text: '#000', glow: '#06b6d4' },
                    red: { bg: '#ef4444', text: '#fff', glow: '#ef4444' },
                  };
                  const c = colorMap[flashConfig.color] || colorMap.amber;
                  charStyle = {
                    backgroundColor: c.bg,
                    color: c.text,
                    borderRadius: '2px',
                    boxShadow: `0 0 10px ${c.glow}`,
                    fontWeight: 'bold',
                  };
                }
                return (
                  <span key={i} style={charStyle}>
                    {char}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Expandable Character Reference & Output Dictionary Drawer */}
          <CharacterReferenceDrawer
            inputText={inputText}
            morseOutput={result.morseCode}
            romanizedText={result.romanizedText}
            mode={mode}
            direction={direction}
            wpm={wpm}
            frequency={frequency}
            volume={volume}
            showToast={showToast}
          />

          {/* Visual Flash & Optical Beacon Synchronizer */}
          <VisualFlashControls
            config={flashConfig}
            onConfigChange={setFlashConfig}
            isPulseActive={isPulseActive}
            activeSymbol={activeSymbolIndex >= 0 ? result.morseCode[activeSymbolIndex] : undefined}
            onManualTriggerStart={handleManualFlashStart}
            onManualTriggerEnd={handleManualFlashEnd}
          />

          {/* Audio Timing & Radio Protocol Controls */}
          <AudioTimingControls
            timingConfig={timingConfig}
            onTimingConfigChange={setTimingConfig}
            standardWpm={wpm}
            onStandardWpmChange={setWpm}
            frequency={frequency}
            onFrequencyChange={setFrequency}
            volume={volume}
            onVolumeChange={setVolume}
            isPlaying={isPlaying}
            isPulseActive={isPulseActive}
            onPlay={playAudio}
            onStop={stopAudio}
            activeDurations={activeDurations}
          />

          {/* History & Favorites Panel */}
          <HistoryAndFavorites
            history={history}
            onHistoryChange={setHistory}
            onLoadItem={handleLoadHistoryItem}
            onPlayMorse={handlePlayMorseDirect}
            showToast={showToast}
            currentInputText={inputText}
            currentMorseCode={result.morseCode}
            currentMode={mode}
          />
        </>
      )}

      {/* TAB: PRACTICE ACADEMY */}
      {activeTab === 'practice' && (
        <MorsePracticeMode
          wpm={wpm}
          frequency={frequency}
          volume={volume}
          timingConfig={timingConfig}
          flashConfig={flashConfig}
          showToast={showToast}
        />
      )}

      {/* TAB 2: AUDIO TRANSCRIPTION */}
      {activeTab === 'transcribe' && (
        <AudioTranscriber
          onTranscribeComplete={(text, insertMode) => {
            handleTranscribeComplete(text, insertMode);
            setActiveTab('converter');
          }}
          showToast={showToast}
        />
      )}

      {/* TAB 3: GEMINI CHATBOT */}
      {activeTab === 'chat' && (
        <GeminiChatbot
          onInsertToConverter={handleInsertFromChat}
          showToast={showToast}
        />
      )}

      {/* TAB 4: LIVE VOICE CONVERSATIONS */}
      {activeTab === 'live' && (
        <LiveVoiceConversation showToast={showToast} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  </>
  );
}

