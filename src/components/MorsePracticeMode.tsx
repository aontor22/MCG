import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  Award,
  Sparkles,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  Radio,
  Eye,
  EyeOff,
  Sliders,
  BarChart3,
  Layers,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import {
  PracticeCategory,
  PracticeStats,
  VisualFlashConfig,
  MorseTimingConfig,
} from '../types';
import { LATIN_TO_MORSE, MORSE_TO_LATIN } from '../constants';
import { calculateTimingDurations } from '../engine';

interface MorsePracticeModeProps {
  wpm: number;
  frequency: number;
  volume: number;
  timingConfig: MorseTimingConfig;
  flashConfig: VisualFlashConfig;
  onFlashConfigChange?: (config: VisualFlashConfig) => void;
  showToast: (msg: string) => void;
}

const COMMON_WORDS_2 = ['HI', 'IT', 'IS', 'AT', 'TO', 'NO', 'SO', 'GO', 'WE', 'MY', 'HE', 'ME', 'IN', 'ON', 'UP', 'AM', 'DO', 'IF', 'BY'];
const COMMON_WORDS_3 = ['SOS', 'CAT', 'DOG', 'SUN', 'SKY', 'SEA', 'FOX', 'CAR', 'BAT', 'MAP', 'RUN', 'AIR', 'KEY', 'LOG', 'RED', 'DAY', 'OUT', 'NEW', 'ONE', 'TWO', 'SIX', 'TEN', 'BOX', 'FLY', 'ICE', 'JOY', 'MAN', 'OLD', 'TOP'];
const COMMON_WORDS_4 = ['CODE', 'TONE', 'WAVE', 'RADIO', 'STAR', 'BLUE', 'MOON', 'FAST', 'SLOW', 'TEST', 'WORD', 'PLAY', 'TIME', 'FIRE', 'WIND', 'SHIP', 'ECHO', 'GRID', 'HERO', 'JUMP', 'LAKE', 'NOTE', 'PARK', 'QUIZ', 'REAL', 'SAFE', 'TRUE', 'VIEW', 'ZERO'];
const COMMON_WORDS_5 = ['RADIO', 'SIGNAL', 'MORSE', 'WORLD', 'SOUND', 'VOICE', 'LIGHT', 'RADAR', 'TRAIN', 'ALPHA', 'BRAVO', 'DELTA', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'OSCAR', 'PAPA', 'ROMEO', 'SIERRA', 'TANGO', 'VICTOR', 'YANKEE', 'ZEBRA'];

const Q_CODES = [
  { code: 'CQ', meaning: 'Calling any station (General call)' },
  { code: '73', meaning: 'Best regards' },
  { code: '88', meaning: 'Love and kisses' },
  { code: 'SOS', meaning: 'Distress emergency call' },
  { code: 'QTH', meaning: 'What is your location?' },
  { code: 'QSL', meaning: 'I acknowledge receipt / Confirm' },
  { code: 'QSO', meaning: 'Radio contact / Conversation' },
  { code: 'QRZ', meaning: 'Who is calling me?' },
  { code: 'QRM', meaning: 'Man-made interference' },
  { code: 'QRN', meaning: 'Atmospheric / static noise' },
  { code: 'QRP', meaning: 'Low power transmission' },
  { code: 'QSY', meaning: 'Change frequency' },
  { code: 'RST', meaning: 'Readability, Strength, Tone report' },
  { code: 'WX', meaning: 'Weather conditions' },
  { code: 'RIG', meaning: 'Transmitter / Receiver equipment' },
  { code: 'ANT', meaning: 'Antenna' },
  { code: 'SK', meaning: 'End of contact / Silent Key' },
  { code: 'AR', meaning: 'End of transmission' },
  { code: 'DE', meaning: 'From / This is' },
];

const KOCH_ORDER = ['K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O', 'W', 'I', '. ', 'N', 'J', 'E', 'F', '0', 'Y', 'V', ',', 'G', '5', '/', 'Q', '9', 'Z', 'H', '3', '8', 'B', '?', '4', '2', '7', 'C', '1', 'D', '6', 'X'];

export function MorsePracticeMode({
  wpm,
  frequency,
  volume,
  timingConfig,
  flashConfig,
  showToast,
}: MorsePracticeModeProps) {
  // Practice Configuration State
  const [category, setCategory] = useState<PracticeCategory>('letters');
  const [sequenceLength, setSequenceLength] = useState<number>(1);
  const [practiceSpeedWpm, setPracticeSpeedWpm] = useState<number>(wpm || 18);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true);
  const [blindMode, setBlindMode] = useState<boolean>(true); // Hide Morse dots/dashes until answered
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [autoPlayOnStart, setAutoPlayOnStart] = useState<boolean>(true);
  const [customChars, setCustomChars] = useState<string>('E T A O I N S H R D L C U M W F G Y P B V K J X Q Z');

  // Current Question State
  const [currentTarget, setCurrentTarget] = useState<string>('');
  const [targetMorse, setTargetMorse] = useState<string>('');
  const [userGuess, setUserGuess] = useState<string>('');
  const [status, setStatus] = useState<'waiting' | 'correct' | 'incorrect' | 'revealed'>('waiting');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [activePlaybackIndex, setActivePlaybackIndex] = useState<number>(-1);
  const [isToneActive, setIsToneActive] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);

  // Statistics State
  const [stats, setStats] = useState<PracticeStats>(() => {
    try {
      const saved = localStorage.getItem('morse_practice_stats_v1');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      totalAttempts: 0,
      correctAttempts: 0,
      currentStreak: 0,
      bestStreak: 0,
      characterMistakes: {},
      characterSuccesses: {},
    };
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  // Save stats on change
  useEffect(() => {
    try {
      localStorage.setItem('morse_practice_stats_v1', JSON.stringify(stats));
    } catch (_) {}
  }, [stats]);

  // Audio Context Initialization
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

  // Play Sound Effects (Chime for correct, buzz for wrong)
  const playSfx = useCallback((type: 'correct' | 'wrong' | 'levelup') => {
    if (!sfxEnabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.setValueAtTime(164.81, now + 0.08); // E3
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.35, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'levelup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        osc.frequency.setValueAtTime(1046.5, now + 0.18); // C6
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.48);
      }
    } catch (_) {}
  }, [getAudioContext, sfxEnabled, volume]);

  // Stop active Morse playback
  const stopAudio = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsPlayingAudio(false);
    setIsToneActive(false);
    setActivePlaybackIndex(-1);
  }, []);

  // Play Morse Code Audio
  const playMorseAudio = useCallback((textToPlay: string, playbackWpm: number = practiceSpeedWpm) => {
    if (!soundEnabled) return;
    stopAudio();

    try {
      const ctx = getAudioContext();
      const effectiveTiming: MorseTimingConfig = {
        ...timingConfig,
        mode: 'standard',
      };
      const durations = calculateTimingDurations(effectiveTiming, playbackWpm);
      const dotDur = durations.dotDur;
      const dashDur = durations.dashDur;
      const intraGap = durations.gap;
      const letterGap = durations.letterGap;
      const wordGap = durations.wordGap;

      // Encode letters to Morse
      const words = textToPlay.toUpperCase().trim().split(/\s+/);
      const sequence: { isSound: boolean; duration: number; symbol: string; charIdx: number }[] = [];

      let globalCharIndex = 0;
      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        for (let l = 0; l < word.length; l++) {
          const letter = word[l];
          const morse = LATIN_TO_MORSE[letter];
          if (morse) {
            for (let s = 0; s < morse.length; s++) {
              const sym = morse[s];
              const dur = sym === '.' ? dotDur : dashDur;
              sequence.push({ isSound: true, duration: dur, symbol: sym, charIdx: globalCharIndex });
              // intra element gap
              if (s < morse.length - 1) {
                sequence.push({ isSound: false, duration: intraGap, symbol: ' ', charIdx: globalCharIndex });
              }
            }
          }
          if (l < word.length - 1) {
            sequence.push({ isSound: false, duration: letterGap, symbol: ' ', charIdx: globalCharIndex });
          }
          globalCharIndex++;
        }
        if (w < words.length - 1) {
          sequence.push({ isSound: false, duration: wordGap, symbol: '/', charIdx: globalCharIndex });
        }
      }

      setIsPlayingAudio(true);
      let scheduleTime = ctx.currentTime + 0.05;

      sequence.forEach((item) => {
        const startDelayMs = (scheduleTime - ctx.currentTime) * 1000;
        const durMs = item.duration * 1000;

        if (item.isSound) {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(frequency, scheduleTime);

          // Attack and Decay Envelope to avoid audio clicks
          const attack = Math.min(0.005, item.duration * 0.1);
          gainNode.gain.setValueAtTime(0, scheduleTime);
          gainNode.gain.linearRampToValueAtTime(volume, scheduleTime + attack);
          gainNode.gain.setValueAtTime(volume, scheduleTime + item.duration - attack);
          gainNode.gain.linearRampToValueAtTime(0, scheduleTime + item.duration);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(scheduleTime);
          osc.stop(scheduleTime + item.duration);

          const tStart = window.setTimeout(() => {
            setIsToneActive(true);
            setActivePlaybackIndex(item.charIdx);
          }, Math.max(0, startDelayMs));

          const tEnd = window.setTimeout(() => {
            setIsToneActive(false);
          }, Math.max(0, startDelayMs + durMs));

          timeoutsRef.current.push(tStart, tEnd);
        }

        scheduleTime += item.duration;
      });

      const totalDurationMs = (scheduleTime - ctx.currentTime) * 1000;
      const tFinished = window.setTimeout(() => {
        setIsPlayingAudio(false);
        setIsToneActive(false);
        setActivePlaybackIndex(-1);
      }, Math.max(0, totalDurationMs + 20));

      timeoutsRef.current.push(tFinished);
    } catch (e) {
      console.error('Audio playback error:', e);
      setIsPlayingAudio(false);
    }
  }, [getAudioContext, soundEnabled, stopAudio, practiceSpeedWpm, timingConfig, frequency, volume]);

  // Generate a new random practice target
  const generateNewTarget = useCallback((cat: PracticeCategory = category, len: number = sequenceLength) => {
    stopAudio();
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    let target = '';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const alphanum = letters + numbers;

    if (cat === 'letters') {
      for (let i = 0; i < len; i++) {
        target += letters[Math.floor(Math.random() * letters.length)];
      }
    } else if (cat === 'numbers') {
      for (let i = 0; i < len; i++) {
        target += numbers[Math.floor(Math.random() * numbers.length)];
      }
    } else if (cat === 'mixed') {
      for (let i = 0; i < len; i++) {
        target += alphanum[Math.floor(Math.random() * alphanum.length)];
      }
    } else if (cat === 'words') {
      let pool = COMMON_WORDS_3;
      if (len === 2) pool = COMMON_WORDS_2;
      else if (len === 3) pool = COMMON_WORDS_3;
      else if (len === 4) pool = COMMON_WORDS_4;
      else if (len >= 5) pool = COMMON_WORDS_5;
      else pool = [...COMMON_WORDS_2, ...COMMON_WORDS_3, ...COMMON_WORDS_4];

      target = pool[Math.floor(Math.random() * pool.length)];
    } else if (cat === 'qcodes') {
      const item = Q_CODES[Math.floor(Math.random() * Q_CODES.length)];
      target = item.code;
    } else if (cat === 'custom') {
      const cleanChars = customChars.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const validPool = cleanChars.length > 0 ? cleanChars : 'ETANOISHR';
      for (let i = 0; i < len; i++) {
        target += validPool[Math.floor(Math.random() * validPool.length)];
      }
    }

    // Convert target to Morse representation for display
    const morseParts = target.split('').map((c) => LATIN_TO_MORSE[c] || '?');
    const morseStr = morseParts.join(' ');

    setCurrentTarget(target);
    setTargetMorse(morseStr);
    setUserGuess('');
    setStatus('waiting');

    // Auto-focus input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);

    // Auto-play audio
    if (autoPlayOnStart && soundEnabled) {
      setTimeout(() => {
        playMorseAudio(target);
      }, 150);
    }
  }, [category, sequenceLength, customChars, stopAudio, autoPlayOnStart, soundEnabled, playMorseAudio]);

  // Initial target on mount or category change
  useEffect(() => {
    generateNewTarget(category, sequenceLength);
    return () => {
      stopAudio();
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [category, sequenceLength]);

  // Handle User Guess Submission
  const handleSubmitGuess = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userGuess.trim() || status === 'correct') return;

    const sanitizedGuess = userGuess.trim().toUpperCase();
    const isCorrect = sanitizedGuess === currentTarget.toUpperCase();

    if (isCorrect) {
      setStatus('correct');
      playSfx('correct');

      setStats((prev) => {
        const newStreak = prev.currentStreak + 1;
        const newBestStreak = Math.max(prev.bestStreak, newStreak);
        const successes = { ...prev.characterSuccesses };
        currentTarget.split('').forEach((char) => {
          successes[char] = (successes[char] || 0) + 1;
        });

        // Trigger levelup chime on milestones (every 5 streak)
        if (newStreak % 5 === 0 && newStreak > 0) {
          setTimeout(() => playSfx('levelup'), 300);
          showToast(`🔥 Amazing! ${newStreak} in a row!`);
        }

        return {
          ...prev,
          totalAttempts: prev.totalAttempts + 1,
          correctAttempts: prev.correctAttempts + 1,
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          characterSuccesses: successes,
        };
      });

      if (autoAdvance) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          generateNewTarget();
        }, 1100);
      }
    } else {
      setStatus('incorrect');
      playSfx('wrong');

      setStats((prev) => {
        const mistakes = { ...prev.characterMistakes };
        currentTarget.split('').forEach((char) => {
          mistakes[char] = (mistakes[char] || 0) + 1;
        });
        return {
          ...prev,
          totalAttempts: prev.totalAttempts + 1,
          currentStreak: 0,
          characterMistakes: mistakes,
        };
      });
    }
  };

  // Auto-submit on typing exact length (optional feature for rapid-fire drills)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setUserGuess(val);

    // If typing matches target, trigger immediate success
    if (val === currentTarget.toUpperCase()) {
      setStatus('correct');
      playSfx('correct');

      setStats((prev) => {
        const newStreak = prev.currentStreak + 1;
        const newBestStreak = Math.max(prev.bestStreak, newStreak);
        const successes = { ...prev.characterSuccesses };
        currentTarget.split('').forEach((char) => {
          successes[char] = (successes[char] || 0) + 1;
        });

        if (newStreak % 5 === 0 && newStreak > 0) {
          setTimeout(() => playSfx('levelup'), 300);
          showToast(`🔥 Streak: ${newStreak}!`);
        }

        return {
          ...prev,
          totalAttempts: prev.totalAttempts + 1,
          correctAttempts: prev.correctAttempts + 1,
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          characterSuccesses: successes,
        };
      });

      if (autoAdvance) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          generateNewTarget();
        }, 1100);
      }
    } else if (status === 'incorrect') {
      setStatus('waiting');
    }
  };

  const handleRevealAnswer = () => {
    setStatus('revealed');
    setStats((prev) => ({
      ...prev,
      totalAttempts: prev.totalAttempts + 1,
      currentStreak: 0,
    }));
  };

  const accuracyPercent =
    stats.totalAttempts > 0 ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100) : 0;

  // Active optical beacon / flash color
  const flashColorHex =
    flashConfig.color === 'amber'
      ? '#f59e0b'
      : flashConfig.color === 'white'
      ? '#ffffff'
      : flashConfig.color === 'green'
      ? '#22c55e'
      : flashConfig.color === 'cyan'
      ? '#06b6d4'
      : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* Top Banner & Stats Overview */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.8rem',
          borderLeft: '4px solid var(--accent-amber)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--accent-amber)',
            }}
          >
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Morse Audio Practice Academy</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Build instinctive auditory and visual reflexes with instant feedback drills
            </p>
          </div>
        </div>

        {/* Live Scoreboard */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--card-border)',
            }}
          >
            <Flame size={16} color="#f97316" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>STREAK</span>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#f97316' }}>
                {stats.currentStreak}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--card-border)',
            }}
          >
            <Trophy size={16} color="#eab308" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>BEST</span>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#eab308' }}>
                {stats.bestStreak}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--card-border)',
            }}
          >
            <Award size={16} color="var(--success-color)" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>ACCURACY</span>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--success-color)' }}>
                {accuracyPercent}% ({stats.correctAttempts}/{stats.totalAttempts})
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowStatsModal(!showStatsModal)}
            style={{ padding: '0.4rem 0.7rem', minHeight: '34px', fontSize: '0.8rem', gap: '0.35rem' }}
            title="View Alphabet Mastery Matrix & Stats"
          >
            <BarChart3 size={15} />
            <span>Mastery Matrix</span>
          </button>
        </div>
      </div>

      {/* Main Training Interactive Arena */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          position: 'relative',
          backgroundColor: 'var(--card-bg)',
          border:
            status === 'correct'
              ? '2px solid var(--success-color)'
              : status === 'incorrect'
              ? '2px solid var(--error-color)'
              : '1px solid var(--card-border)',
          boxShadow:
            status === 'correct'
              ? '0 0 25px rgba(34, 197, 94, 0.2)'
              : status === 'incorrect'
              ? '0 0 25px rgba(239, 68, 68, 0.2)'
              : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Optical Lamp Mini Beacon in Practice Mode */}
        {flashConfig.enabled && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: `1px solid ${isToneActive ? flashColorHex : 'var(--card-border)'}`,
              transition: 'all 0.05s ease',
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: isToneActive ? flashColorHex : '#334155',
                boxShadow: isToneActive ? `0 0 14px ${flashColorHex}` : 'none',
                transition: 'all 0.04s ease',
              }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {isToneActive ? 'OPTICAL SIGNAL ACTIVE' : 'OPTICAL RECEIVER READY'}
            </span>
          </div>
        )}

        {/* Audio Visualizer / Morse Pattern Indicator */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', minHeight: '68px' }}>
          {blindMode && status === 'waiting' ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px dashed var(--card-border)',
                color: 'var(--text-secondary)',
                fontSize: '0.88rem',
              }}
            >
              <EyeOff size={16} />
              <span>[ Blind Ear Training — Morse Pattern Hidden ]</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.6rem',
                  letterSpacing: '0.3em',
                  fontWeight: 700,
                  color: isToneActive ? 'var(--accent-amber)' : 'var(--text-primary)',
                  transition: 'color 0.05s ease',
                }}
              >
                {targetMorse}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Target Morse Code ({currentTarget.length} {currentTarget.length === 1 ? 'Character' : 'Characters'})
              </div>
            </div>
          )}
        </div>

        {/* Audio Action Trigger Controls */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            id="practice-play-audio-btn"
            type="button"
            className="btn btn-primary"
            onClick={() => playMorseAudio(currentTarget, practiceSpeedWpm)}
            disabled={isPlayingAudio}
            style={{
              padding: '0.6rem 1.4rem',
              fontSize: '0.95rem',
              gap: '0.5rem',
              boxShadow: isPlayingAudio ? '0 0 15px rgba(245, 158, 11, 0.4)' : undefined,
            }}
          >
            <Play size={18} fill={isPlayingAudio ? 'currentColor' : 'none'} />
            <span>{isPlayingAudio ? 'Transmitting Sound...' : 'Play Audio (Space)'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => playMorseAudio(currentTarget, Math.max(8, Math.round(practiceSpeedWpm * 0.6)))}
            disabled={isPlayingAudio}
            style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', gap: '0.4rem' }}
            title="Play at 60% speed for easier listening"
          >
            <RotateCcw size={15} />
            <span>Play Slower (60%)</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRevealAnswer}
            disabled={status === 'correct' || status === 'revealed'}
            style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', gap: '0.4rem' }}
            title="Reveal Answer & Morse sequence"
          >
            <HelpCircle size={15} />
            <span>Reveal Answer</span>
          </button>
        </div>

        {/* User Input Form */}
        <form
          onSubmit={handleSubmitGuess}
          style={{
            width: '100%',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            alignItems: 'center',
          }}
        >
          <div style={{ width: '100%', position: 'relative' }}>
            <input
              ref={inputRef}
              id="practice-guess-input"
              type="text"
              className="text-input"
              placeholder="Type your guess here (e.g. SOS)..."
              value={userGuess}
              onChange={handleInputChange}
              disabled={status === 'correct'}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              style={{
                textAlign: 'center',
                fontSize: '1.4rem',
                fontWeight: 800,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                height: '54px',
                borderColor:
                  status === 'correct'
                    ? 'var(--success-color)'
                    : status === 'incorrect'
                    ? 'var(--error-color)'
                    : 'var(--card-border)',
                backgroundColor:
                  status === 'correct'
                    ? 'rgba(34, 197, 94, 0.1)'
                    : status === 'incorrect'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : undefined,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              id="practice-submit-guess-btn"
              type="submit"
              className="btn btn-primary"
              disabled={!userGuess.trim() || status === 'correct'}
              style={{ flex: 1, minHeight: '44px', fontSize: '0.9rem', gap: '0.4rem' }}
            >
              <CheckCircle2 size={16} />
              <span>Submit Guess (Enter)</span>
            </button>

            <button
              id="practice-next-sequence-btn"
              type="button"
              className="btn btn-secondary"
              onClick={() => generateNewTarget()}
              style={{ minHeight: '44px', padding: '0 1rem', fontSize: '0.85rem', gap: '0.4rem' }}
              title="Skip to next random sequence"
            >
              <span>Next</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </form>

        {/* Immediate Feedback Feedback Status Message */}
        <div style={{ marginTop: '1.2rem', minHeight: '40px', textAlign: 'center' }}>
          <AnimatePresence mode="wait">
            {status === 'correct' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--success-color)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  padding: '0.4rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                }}
              >
                <CheckCircle2 size={18} />
                <span>Correct! "{currentTarget}" — {targetMorse}</span>
                {autoAdvance && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Auto-advancing...)</span>}
              </motion.div>
            )}

            {status === 'incorrect' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--error-color)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '0.4rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                }}
              >
                <XCircle size={18} />
                <span>Not quite! Try listening again or click "Play Slower".</span>
              </motion.div>
            )}

            {status === 'revealed' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: 'var(--accent-amber)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '0.4rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                }}
              >
                <div>Answer: <span style={{ fontSize: '1.2rem' }}>{currentTarget}</span> ({targetMorse})</div>
                {category === 'qcodes' && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {Q_CODES.find((q) => q.code === currentTarget)?.meaning}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Practice Mode Drills & Customization Settings */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={18} color="var(--accent-amber)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Drill Settings & Character Sets</h3>
        </div>

        {/* Training Category Selection */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
            Training Category
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn ${category === 'letters' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setCategory('letters');
                generateNewTarget('letters', sequenceLength);
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              Letters (A-Z)
            </button>
            <button
              type="button"
              className={`btn ${category === 'numbers' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setCategory('numbers');
                generateNewTarget('numbers', sequenceLength);
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              Numbers (0-9)
            </button>
            <button
              type="button"
              className={`btn ${category === 'mixed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setCategory('mixed');
                generateNewTarget('mixed', sequenceLength);
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              Alphanumeric
            </button>
            <button
              type="button"
              className={`btn ${category === 'words' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setCategory('words');
                generateNewTarget('words', sequenceLength);
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              Common Words
            </button>
            <button
              type="button"
              className={`btn ${category === 'qcodes' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setCategory('qcodes');
                generateNewTarget('qcodes', sequenceLength);
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              Q-Codes & Prosigns
            </button>
            <button
              type="button"
              className={`btn ${category === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setCategory('custom');
                generateNewTarget('custom', sequenceLength);
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              Custom Subset
            </button>
          </div>
        </div>

        {/* Custom Character Subset Input */}
        {category === 'custom' && (
          <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Target Custom Character Pool (Space or comma separated)
              </label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem' }}
                  onClick={() => setCustomChars('E T A O I N')}
                >
                  Top 6 Easy
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem' }}
                  onClick={() => setCustomChars('K M R S U A P T L O')}
                >
                  Koch Lesson 1-10
                </button>
              </div>
            </div>
            <input
              type="text"
              className="text-input"
              value={customChars}
              onChange={(e) => setCustomChars(e.target.value)}
              placeholder="e.g. K M R S U A"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}
            />
          </div>
        )}

        {/* Sequence Length & Speed Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Sequence Length */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sequence Length</label>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {category === 'qcodes' ? 'Auto (Q-Code length)' : `${sequenceLength} Character${sequenceLength > 1 ? 's' : ''}`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[1, 2, 3, 4, 5].map((len) => (
                <button
                  key={len}
                  type="button"
                  disabled={category === 'qcodes'}
                  className={`btn ${sequenceLength === len ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setSequenceLength(len);
                    generateNewTarget(category, len);
                  }}
                  style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.8rem' }}
                >
                  {len}
                </button>
              ))}
            </div>
          </div>

          {/* Drill Speed WPM Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Practice Speed</label>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {practiceSpeedWpm} WPM
              </span>
            </div>
            <input
              type="range"
              min="8"
              max="35"
              step="1"
              value={practiceSpeedWpm}
              onChange={(e) => setPracticeSpeedWpm(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
            />
          </div>
        </div>

        {/* Toggle Options: Blind Mode, Sound, Auto-Advance */}
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', borderTop: '1px solid var(--card-border)', paddingTop: '0.8rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={blindMode}
              onChange={(e) => setBlindMode(e.target.checked)}
              style={{ accentColor: 'var(--accent-amber)' }}
            />
            <span>Blind Ear Training (Hide Morse symbols)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoPlayOnStart}
              onChange={(e) => setAutoPlayOnStart(e.target.checked)}
              style={{ accentColor: 'var(--accent-amber)' }}
            />
            <span>Auto-play sound on new sequence</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              style={{ accentColor: 'var(--accent-amber)' }}
            />
            <span>Auto-advance upon correct guess</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sfxEnabled}
              onChange={(e) => setSfxEnabled(e.target.checked)}
              style={{ accentColor: 'var(--accent-amber)' }}
            />
            <span>Game Sound Effects (Chimes)</span>
          </label>
        </div>
      </div>

      {/* Alphabet Mastery Matrix Modal / Expandable View */}
      {showStatsModal && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart3 size={17} color="var(--accent-amber)" />
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Character Mastery Matrix (A-Z, 0-9)</h3>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              onClick={() => {
                if (confirm('Reset practice stats history?')) {
                  setStats({
                    totalAttempts: 0,
                    correctAttempts: 0,
                    currentStreak: 0,
                    bestStreak: 0,
                    characterMistakes: {},
                    characterSuccesses: {},
                  });
                }
              }}
            >
              Reset Stats
            </button>
          </div>

          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
            Track your individual character recognition accuracy. Click any character to launch a targeted 1-letter practice round!
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(62px, 1fr))',
              gap: '0.4rem',
            }}
          >
            {Object.keys(LATIN_TO_MORSE).filter((k) => /^[A-Z0-9]$/.test(k)).map((char) => {
              const success = stats.characterSuccesses[char] || 0;
              const mistakes = stats.characterMistakes[char] || 0;
              const total = success + mistakes;
              const rate = total > 0 ? Math.round((success / total) * 100) : null;

              let badgeColor = 'var(--text-secondary)';
              let bg = 'rgba(0, 0, 0, 0.2)';
              if (rate !== null) {
                if (rate >= 80) {
                  badgeColor = 'var(--success-color)';
                  bg = 'rgba(34, 197, 94, 0.12)';
                } else if (rate >= 50) {
                  badgeColor = '#f59e0b';
                  bg = 'rgba(245, 158, 11, 0.12)';
                } else {
                  badgeColor = 'var(--error-color)';
                  bg = 'rgba(239, 68, 68, 0.12)';
                }
              }

              return (
                <button
                  key={char}
                  type="button"
                  onClick={() => {
                    setCategory('custom');
                    setCustomChars(char);
                    setSequenceLength(1);
                    generateNewTarget('custom', 1);
                    showToast(`Targeting character: ${char}`);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.4rem 0.2rem',
                    borderRadius: '6px',
                    border: '1px solid var(--card-border)',
                    backgroundColor: bg,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`${char}: ${LATIN_TO_MORSE[char]} (${success} correct, ${mistakes} mistakes)`}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{char}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.75 }}>
                    {LATIN_TO_MORSE[char]}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: badgeColor, marginTop: '2px' }}>
                    {rate !== null ? `${rate}%` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
