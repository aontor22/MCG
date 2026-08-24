import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Square,
  Sliders,
  SlidersHorizontal,
  RotateCcw,
  Radio,
  Clock,
  Gauge,
  Sparkles,
  Info,
} from 'lucide-react';
import { MorseTimingConfig, TimingProtocolPreset, TimingDurations } from '../types';

interface AudioTimingControlsProps {
  timingConfig: MorseTimingConfig;
  onTimingConfigChange: (config: MorseTimingConfig) => void;
  standardWpm: number;
  onStandardWpmChange: (wpm: number) => void;
  frequency: number;
  onFrequencyChange: (frequency: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isPlaying: boolean;
  isPulseActive: boolean;
  onPlay: () => void;
  onStop: () => void;
  activeDurations: TimingDurations;
}

const PRESETS: {
  id: TimingProtocolPreset;
  name: string;
  badge: string;
  description: string;
  config: Partial<MorseTimingConfig>;
}[] = [
  {
    id: 'itu-standard',
    name: 'ITU-R Standard (PARIS)',
    badge: '1 : 3 : 1 : 3 : 7',
    description: 'International Telecommunication Union standard (1 unit dot, 3 units dash, standard gaps).',
    config: {
      protocolPreset: 'itu-standard',
      dashRatio: 3.0,
      intraElementGapRatio: 1.0,
      charGapRatio: 3.0,
      wordGapRatio: 7.0,
      useFarnsworth: false,
    },
  },
  {
    id: 'farnsworth',
    name: 'Farnsworth Training',
    badge: 'Dual Speed',
    description: 'Fast symbol tones (20 WPM) with stretched inter-character pauses (10 WPM) for auditory training.',
    config: {
      protocolPreset: 'farnsworth',
      dashRatio: 3.0,
      intraElementGapRatio: 1.0,
      charGapRatio: 3.0,
      wordGapRatio: 7.0,
      useFarnsworth: true,
      farnsworthCharWpm: 20,
      farnsworthOverallWpm: 10,
    },
  },
  {
    id: 'qrq-high-speed',
    name: 'HST / QRQ Heavy Weighting',
    badge: '3.5 : 1 Ratio',
    description: 'High-speed telegraphy with prominent dashes and compressed inter-element spacing (0.8x) for rapid decoding.',
    config: {
      protocolPreset: 'qrq-high-speed',
      dashRatio: 3.5,
      intraElementGapRatio: 0.8,
      charGapRatio: 2.5,
      wordGapRatio: 6.0,
      useFarnsworth: false,
    },
  },
  {
    id: 'light-weighting',
    name: 'QRP Light Weighting',
    badge: '2.5 : 1 Ratio',
    description: 'Crisp, lightweight dashes (2.5x) and wider gaps (1.2x) to prevent distortion over noisy HF channels.',
    config: {
      protocolPreset: 'light-weighting',
      dashRatio: 2.5,
      intraElementGapRatio: 1.2,
      charGapRatio: 3.2,
      wordGapRatio: 7.5,
      useFarnsworth: false,
    },
  },
  {
    id: 'american-railroad',
    name: 'American / Railroad Morse',
    badge: '2.0 : 1 Ratio',
    description: 'Historic American railroad telegraph timing with shorter dashes and extended word breaks.',
    config: {
      protocolPreset: 'american-railroad',
      dashRatio: 2.0,
      intraElementGapRatio: 1.0,
      charGapRatio: 4.0,
      wordGapRatio: 8.5,
      useFarnsworth: false,
    },
  },
  {
    id: 'qrss-beacon',
    name: 'QRSS Slow Beacon',
    badge: '1000ms Dot',
    description: 'Ultra-slow CW (1-second dot) used for extreme weak-signal propagation and VLF/LF beacon reception.',
    config: {
      protocolPreset: 'qrss-beacon',
      dotDurationMs: 1000,
      dashRatio: 3.0,
      intraElementGapRatio: 1.0,
      charGapRatio: 3.0,
      wordGapRatio: 7.0,
      useFarnsworth: false,
    },
  },
  {
    id: 'custom',
    name: 'Custom Protocol',
    badge: 'User Defined',
    description: 'Full custom control over dot length, dash multiplier, and all inter-symbol/word pauses.',
    config: {
      protocolPreset: 'custom',
    },
  },
];

export function AudioTimingControls({
  timingConfig,
  onTimingConfigChange,
  standardWpm,
  onStandardWpmChange,
  frequency,
  onFrequencyChange,
  volume,
  onVolumeChange,
  isPlaying,
  isPulseActive,
  onPlay,
  onStop,
  activeDurations,
}: AudioTimingControlsProps) {
  const isAdvanced = timingConfig.mode === 'advanced';

  // Derived telemetry metrics
  const telemetry = useMemo(() => {
    const dotMs = Math.round(activeDurations.dotDur * 1000);
    const dashMs = Math.round(activeDurations.dashDur * 1000);
    const gapMs = Math.round(activeDurations.gap * 1000);
    const letterGapMs = Math.round(activeDurations.letterGap * 1000);
    const wordGapMs = Math.round(activeDurations.wordGap * 1000);

    const effectiveCharWpm = Math.max(1, Math.round(1200 / Math.max(1, dotMs)));

    // PARIS standard word calculation: 50 basic units
    // Standard word has 19 dots/dashes and 31 gaps
    // T_word (approx) = (dotDur + gap)*8.4 + (dashDur + gap)*3.6 + letterGap*4 + wordGap
    const wordDurationSec =
      (activeDurations.dotDur + activeDurations.gap) * 8.4 +
      (activeDurations.dashDur + activeDurations.gap) * 3.6 +
      activeDurations.letterGap * 4 +
      activeDurations.wordGap;
    const effectiveOverallWpm = Math.max(1, Math.round(60 / Math.max(0.01, wordDurationSec)));

    return {
      dotMs,
      dashMs,
      gapMs,
      letterGapMs,
      wordGapMs,
      effectiveCharWpm,
      effectiveOverallWpm,
    };
  }, [activeDurations]);

  const handleSelectPreset = (preset: typeof PRESETS[number]) => {
    let newConfig: MorseTimingConfig = {
      ...timingConfig,
      ...preset.config,
      protocolPreset: preset.id,
    };

    if (preset.id === 'itu-standard') {
      newConfig.dotDurationMs = Math.round(1200 / standardWpm);
    } else if (preset.id === 'qrss-beacon') {
      newConfig.dotDurationMs = 1000;
    }

    onTimingConfigChange(newConfig);
  };

  const handleResetToStandard = () => {
    onStandardWpmChange(20);
    onTimingConfigChange({
      mode: 'standard',
      protocolPreset: 'itu-standard',
      dotDurationMs: 60,
      dashRatio: 3.0,
      intraElementGapRatio: 1.0,
      charGapRatio: 3.0,
      wordGapRatio: 7.0,
      useFarnsworth: false,
      farnsworthCharWpm: 20,
      farnsworthOverallWpm: 12,
    });
  };

  return (
    <div className="card" id="audio-timing-controls-card">
      {/* Top Header & Main Playback Control */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {!isPlaying ? (
            <button
              id="play-morse-audio-btn"
              type="button"
              className="btn btn-primary"
              onClick={onPlay}
              style={{ gap: '0.5rem' }}
            >
              <Play size={16} fill="currentColor" />
              <span>Play Audio</span>
            </button>
          ) : (
            <button
              id="stop-morse-audio-btn"
              type="button"
              className="btn btn-primary"
              onClick={onStop}
              style={{ gap: '0.5rem', backgroundColor: 'var(--danger-color)', color: '#fff' }}
            >
              <Square size={16} fill="currentColor" />
              <span>Stop Audio</span>
            </button>
          )}

          <div
            className={`signal-pulse ${isPulseActive ? 'active' : ''}`}
            title="Signal Pulse Indicator"
          />

          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isPlaying ? 'Transmitting Morse Signal...' : 'Audio Generator Ready'}
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--card-border)',
            gap: '3px',
          }}
        >
          <button
            id="timing-mode-standard-btn"
            type="button"
            onClick={() => onTimingConfigChange({ ...timingConfig, mode: 'standard' })}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: !isAdvanced ? 'var(--accent-amber)' : 'transparent',
              color: !isAdvanced ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Gauge size={14} />
            <span>Standard WPM</span>
          </button>
          <button
            id="timing-mode-advanced-btn"
            type="button"
            onClick={() => onTimingConfigChange({ ...timingConfig, mode: 'advanced' })}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: isAdvanced ? 'var(--accent-amber)' : 'transparent',
              color: isAdvanced ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Custom Timing & Protocols</span>
          </button>
        </div>
      </div>

      {/* Standard Mode Simple Controls */}
      {!isAdvanced && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Speed</label>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-amber)' }}>
                {standardWpm} WPM
              </span>
            </div>
            <input
              id="standard-wpm-slider"
              type="range"
              min="5"
              max="50"
              value={standardWpm}
              onChange={(e) => {
                const val = Number(e.target.value);
                onStandardWpmChange(val);
                onTimingConfigChange({
                  ...timingConfig,
                  dotDurationMs: Math.round(1200 / val),
                });
              }}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
              {[10, 15, 20, 25, 30].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    onStandardWpmChange(w);
                    onTimingConfigChange({
                      ...timingConfig,
                      dotDurationMs: Math.round(1200 / w),
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: '0.15rem 0.2rem',
                    fontSize: '0.72rem',
                    backgroundColor: standardWpm === w ? 'var(--card-border)' : 'rgba(0,0,0,0.1)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '4px',
                    color: standardWpm === w ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tone Pitch</label>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                {frequency} Hz
              </span>
            </div>
            <input
              id="frequency-slider"
              type="range"
              min="300"
              max="1200"
              step="10"
              value={frequency}
              onChange={(e) => onFrequencyChange(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
              {[440, 600, 700, 800].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFrequencyChange(f)}
                  style={{
                    flex: 1,
                    padding: '0.15rem 0.2rem',
                    fontSize: '0.72rem',
                    backgroundColor: frequency === f ? 'var(--card-border)' : 'rgba(0,0,0,0.1)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '4px',
                    color: frequency === f ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {f}Hz
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume</label>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{Math.round(volume * 100)}%</span>
            </div>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Advanced Timing & Radio Protocols Panel */}
      <AnimatePresence>
        {isAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              {/* Radio Protocol Presets */}
              <div style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Radio size={14} style={{ color: 'var(--accent-amber)' }} />
                    Radio Protocol & Timing Presets
                  </label>
                  <button
                    type="button"
                    onClick={handleResetToStandard}
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', minHeight: '26px', fontSize: '0.75rem', gap: '0.3rem' }}
                    title="Reset to ITU-R PARIS default"
                  >
                    <RotateCcw size={12} />
                    <span>Reset ITU Defaults</span>
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {PRESETS.map((preset) => {
                    const isSelected = timingConfig.protocolPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        style={{
                          textAlign: 'left',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          border: `1px solid ${isSelected ? 'var(--accent-amber)' : 'var(--card-border)'}`,
                          backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 0, 0, 0.15)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                            {preset.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'var(--accent-amber)' : 'var(--card-border)',
                              color: isSelected ? '#000' : 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            {preset.badge}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Farnsworth Spacing Toggle and Inputs */}
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '8px',
                  backgroundColor: timingConfig.useFarnsworth ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0, 0, 0, 0.12)',
                  border: `1px solid ${timingConfig.useFarnsworth ? 'rgba(56, 189, 248, 0.3)' : 'var(--card-border)'}`,
                  marginBottom: '1.2rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: timingConfig.useFarnsworth ? '0.8rem' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      id="farnsworth-toggle-checkbox"
                      type="checkbox"
                      checked={timingConfig.useFarnsworth}
                      onChange={(e) =>
                        onTimingConfigChange({
                          ...timingConfig,
                          useFarnsworth: e.target.checked,
                          protocolPreset: e.target.checked ? 'farnsworth' : 'custom',
                        })
                      }
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-blue)' }}
                    />
                    <label htmlFor="farnsworth-toggle-checkbox" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                      Enable Farnsworth Dual-Speed Spacing
                    </label>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    High character speed + relaxed gap intervals for auditory recognition
                  </span>
                </div>

                {timingConfig.useFarnsworth && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Character Element Speed</label>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                          {timingConfig.farnsworthCharWpm} WPM ({Math.round(1200 / timingConfig.farnsworthCharWpm)}ms Dot)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="50"
                        value={timingConfig.farnsworthCharWpm}
                        onChange={(e) =>
                          onTimingConfigChange({
                            ...timingConfig,
                            farnsworthCharWpm: Number(e.target.value),
                            protocolPreset: 'custom',
                          })
                        }
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Pause Spacing Speed</label>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-amber)' }}>
                          {timingConfig.farnsworthOverallWpm} WPM ({Math.round((1200 / timingConfig.farnsworthOverallWpm) * timingConfig.charGapRatio)}ms Letter Gap)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max={timingConfig.farnsworthCharWpm}
                        value={timingConfig.farnsworthOverallWpm}
                        onChange={(e) =>
                          onTimingConfigChange({
                            ...timingConfig,
                            farnsworthOverallWpm: Number(e.target.value),
                            protocolPreset: 'custom',
                          })
                        }
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Granular Dot/Dash/Gap Pattern Adjustments */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.2rem',
                }}
              >
                {/* Dot Base Duration */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={13} style={{ color: 'var(--accent-amber)' }} />
                      Base Dot Duration (T<sub>dot</sub>)
                    </label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                      {timingConfig.dotDurationMs} ms
                    </span>
                  </div>
                  <input
                    id="dot-duration-slider"
                    type="range"
                    min="15"
                    max="1200"
                    step="5"
                    value={timingConfig.dotDurationMs}
                    disabled={timingConfig.useFarnsworth}
                    onChange={(e) =>
                      onTimingConfigChange({
                        ...timingConfig,
                        dotDurationMs: Number(e.target.value),
                        protocolPreset: 'custom',
                      })
                    }
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span>15ms (80 WPM)</span>
                    <span>60ms (20 WPM)</span>
                    <span>1200ms (QRSS)</span>
                  </div>
                </div>

                {/* Dash Ratio */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Dash Ratio (T<sub>dash</sub> / T<sub>dot</sub>)
                    </label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {timingConfig.dashRatio.toFixed(1)}x ({telemetry.dashMs}ms)
                    </span>
                  </div>
                  <input
                    id="dash-ratio-slider"
                    type="range"
                    min="1.5"
                    max="5.0"
                    step="0.1"
                    value={timingConfig.dashRatio}
                    onChange={(e) =>
                      onTimingConfigChange({
                        ...timingConfig,
                        dashRatio: Number(e.target.value),
                        protocolPreset: 'custom',
                      })
                    }
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span>1.5x (Ultra Fast)</span>
                    <span>3.0x (Standard)</span>
                    <span>5.0x (Heavy)</span>
                  </div>
                </div>

                {/* Intra-Element Gap */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Dit-Dah Gap (Intra-element)
                    </label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      {timingConfig.intraElementGapRatio.toFixed(1)}x ({telemetry.gapMs}ms)
                    </span>
                  </div>
                  <input
                    id="intra-element-gap-slider"
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={timingConfig.intraElementGapRatio}
                    onChange={(e) =>
                      onTimingConfigChange({
                        ...timingConfig,
                        intraElementGapRatio: Number(e.target.value),
                        protocolPreset: 'custom',
                      })
                    }
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span>0.5x (Tight)</span>
                    <span>1.0x (Std)</span>
                    <span>3.0x (Spaced)</span>
                  </div>
                </div>

                {/* Inter-Character Gap */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Letter Gap (Inter-character)
                    </label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                      {timingConfig.charGapRatio.toFixed(1)}x ({telemetry.letterGapMs}ms)
                    </span>
                  </div>
                  <input
                    id="char-gap-slider"
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.2"
                    value={timingConfig.charGapRatio}
                    onChange={(e) =>
                      onTimingConfigChange({
                        ...timingConfig,
                        charGapRatio: Number(e.target.value),
                        protocolPreset: 'custom',
                      })
                    }
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span>1.0x (Dense)</span>
                    <span>3.0x (Std)</span>
                    <span>10.0x (Training)</span>
                  </div>
                </div>

                {/* Inter-Word Gap */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Word Gap (Inter-word)
                    </label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {timingConfig.wordGapRatio.toFixed(1)}x ({telemetry.wordGapMs}ms)
                    </span>
                  </div>
                  <input
                    id="word-gap-slider"
                    type="range"
                    min="3.0"
                    max="20.0"
                    step="0.5"
                    value={timingConfig.wordGapRatio}
                    onChange={(e) =>
                      onTimingConfigChange({
                        ...timingConfig,
                        wordGapRatio: Number(e.target.value),
                        protocolPreset: 'custom',
                      })
                    }
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span>3.0x (Fast)</span>
                    <span>7.0x (Std)</span>
                    <span>20.0x (Extended)</span>
                  </div>
                </div>

                {/* Tone Frequency & Audio Volume in Advanced Mode */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Sidetone Pitch & Level
                    </label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      {frequency}Hz • {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="range"
                      min="300"
                      max="1200"
                      step="10"
                      value={frequency}
                      onChange={(e) => onFrequencyChange(Number(e.target.value))}
                      style={{ flex: 1 }}
                      title="Pitch Frequency"
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => onVolumeChange(Number(e.target.value))}
                      style={{ flex: 1 }}
                      title="Volume"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <span>Pitch: {frequency}Hz</span>
                    <span>Vol: {Math.round(volume * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Timing Pattern Waveform Visualization (Sample Letter 'R' / . - .) */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--card-border)',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Acoustic Timing Waveform Preview (Letter "R": <code>• — •</code> followed by word break)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    1 : {timingConfig.dashRatio.toFixed(1)} : {timingConfig.intraElementGapRatio.toFixed(1)} : {timingConfig.charGapRatio.toFixed(1)} : {timingConfig.wordGapRatio.toFixed(1)}
                  </span>
                </div>

                {/* Graphical Pulse Timeline */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '24px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '4px',
                    padding: '2px',
                    gap: '2px',
                    overflowX: 'auto',
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      flex: `${timingConfig.useFarnsworth ? 1 : 1}`,
                      minWidth: '12px',
                      height: '100%',
                      backgroundColor: 'var(--accent-amber)',
                      borderRadius: '2px',
                    }}
                    title={`Dot: ${telemetry.dotMs}ms`}
                  />
                  {/* Intra Gap */}
                  <div
                    style={{
                      flex: `${timingConfig.intraElementGapRatio}`,
                      minWidth: '6px',
                      height: '100%',
                      backgroundColor: 'transparent',
                    }}
                    title={`Element Gap: ${telemetry.gapMs}ms`}
                  />
                  {/* Dash */}
                  <div
                    style={{
                      flex: `${timingConfig.dashRatio}`,
                      minWidth: '24px',
                      height: '100%',
                      backgroundColor: 'var(--accent-blue)',
                      borderRadius: '2px',
                    }}
                    title={`Dash: ${telemetry.dashMs}ms`}
                  />
                  {/* Intra Gap */}
                  <div
                    style={{
                      flex: `${timingConfig.intraElementGapRatio}`,
                      minWidth: '6px',
                      height: '100%',
                      backgroundColor: 'transparent',
                    }}
                    title={`Element Gap: ${telemetry.gapMs}ms`}
                  />
                  {/* Dot */}
                  <div
                    style={{
                      flex: '1',
                      minWidth: '12px',
                      height: '100%',
                      backgroundColor: 'var(--accent-amber)',
                      borderRadius: '2px',
                    }}
                    title={`Dot: ${telemetry.dotMs}ms`}
                  />
                  {/* Letter Gap */}
                  <div
                    style={{
                      flex: `${timingConfig.charGapRatio}`,
                      minWidth: '16px',
                      height: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '2px',
                      border: '1px dashed rgba(255, 255, 255, 0.2)',
                    }}
                    title={`Letter Gap: ${telemetry.letterGapMs}ms`}
                  />
                  {/* Word Gap */}
                  <div
                    style={{
                      flex: `${timingConfig.wordGapRatio}`,
                      minWidth: '32px',
                      height: '100%',
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      borderRadius: '2px',
                      border: '1px dashed rgba(245, 158, 11, 0.3)',
                    }}
                    title={`Word Gap: ${telemetry.wordGapMs}ms`}
                  />
                </div>
              </div>

              {/* Live Computed Telemetry Bento */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.5rem',
                }}
              >
                <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Dot Duration</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    {telemetry.dotMs} ms
                  </div>
                </div>

                <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Dash Duration</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                    {telemetry.dashMs} ms
                  </div>
                </div>

                <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Letter Pause</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {telemetry.letterGapMs} ms
                  </div>
                </div>

                <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Word Pause</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {telemetry.wordGapMs} ms
                  </div>
                </div>

                <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Effective Char Speed</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    ~{telemetry.effectiveCharWpm} WPM
                  </div>
                </div>

                <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Effective Overall Rate</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                    ~{telemetry.effectiveOverallWpm} WPM
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
