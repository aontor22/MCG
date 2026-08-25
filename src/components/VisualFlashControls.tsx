import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sun,
  Zap,
  Sliders,
  Radio,
  Eye,
  Sparkles,
  Maximize2,
  Minimize2,
  Lightbulb,
  ShieldAlert,
} from 'lucide-react';
import { VisualFlashConfig, FlashColor, FlashMode } from '../types';

interface VisualFlashControlsProps {
  config: VisualFlashConfig;
  onConfigChange: (config: VisualFlashConfig) => void;
  isPulseActive: boolean;
  activeSymbol?: string;
  onManualTriggerStart?: () => void;
  onManualTriggerEnd?: () => void;
}

const COLOR_MAP: Record<
  FlashColor,
  {
    name: string;
    label: string;
    hex: string;
    rgb: string;
    wavelength: string;
    glow: string;
  }
> = {
  amber: {
    name: 'Classic Amber',
    label: 'Amber',
    hex: '#f59e0b',
    rgb: '245, 158, 11',
    wavelength: '590nm',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
  white: {
    name: 'Xenon White',
    label: 'White',
    hex: '#ffffff',
    rgb: '255, 255, 255',
    wavelength: '6500K',
    glow: 'rgba(255, 255, 255, 0.5)',
  },
  green: {
    name: 'Tactical Phosphor',
    label: 'Green',
    hex: '#22c55e',
    rgb: '34, 197, 94',
    wavelength: '525nm',
    glow: 'rgba(34, 197, 94, 0.45)',
  },
  cyan: {
    name: 'Maritime Cyan',
    label: 'Cyan',
    hex: '#06b6d4',
    rgb: '6, 182, 212',
    wavelength: '470nm',
    glow: 'rgba(6, 182, 212, 0.45)',
  },
  red: {
    name: 'Distress / SOS Red',
    label: 'Red',
    hex: '#ef4444',
    rgb: '239, 68, 68',
    wavelength: '630nm',
    glow: 'rgba(239, 68, 68, 0.45)',
  },
};

const MODE_OPTIONS: { id: FlashMode; label: string; desc: string }[] = [
  {
    id: 'both',
    label: 'Lamp + Screen Glow',
    desc: 'Simultaneous optical beacon spotlight and full ambient screen glow.',
  },
  {
    id: 'beacon-lamp',
    label: 'Beacon Lamp Only',
    desc: 'High-intensity directional signal lamp fixture.',
  },
  {
    id: 'ambient-screen',
    label: 'Ambient Screen Glow',
    desc: 'Subtle peripheral vignette and backdrop pulse across the viewport.',
  },
  {
    id: 'minimal-pill',
    label: 'Compact LED',
    desc: 'Discreet, minimalist micro indicator without full lamp housing.',
  },
];

export function VisualFlashControls({
  config,
  onConfigChange,
  isPulseActive,
  activeSymbol,
  onManualTriggerStart,
  onManualTriggerEnd,
}: VisualFlashControlsProps) {
  const [isManualPressing, setIsManualPressing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTestingSOS, setIsTestingSOS] = useState(false);
  const testTimeoutsRef = useRef<number[]>([]);

  const activeColorInfo = COLOR_MAP[config.color] || COLOR_MAP.amber;
  const isGlowing = isPulseActive || isManualPressing;

  const handleManualDown = () => {
    setIsManualPressing(true);
    if (onManualTriggerStart) onManualTriggerStart();
  };

  const handleManualUp = () => {
    setIsManualPressing(false);
    if (onManualTriggerEnd) onManualTriggerEnd();
  };

  // Keyboard shortcut listener for space key when hovering over manual key
  useEffect(() => {
    return () => {
      testTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const triggerTestPulse = (pattern: string) => {
    testTimeoutsRef.current.forEach(clearTimeout);
    testTimeoutsRef.current = [];
    setIsTestingSOS(true);

    const dotMs = 80;
    const dashMs = 240;
    const intraGapMs = 80;
    const charGapMs = 240;

    let time = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (char === '.') {
        const tStart = window.setTimeout(() => setIsManualPressing(true), time);
        const tEnd = window.setTimeout(() => setIsManualPressing(false), time + dotMs);
        testTimeoutsRef.current.push(tStart, tEnd);
        time += dotMs + intraGapMs;
      } else if (char === '-') {
        const tStart = window.setTimeout(() => setIsManualPressing(true), time);
        const tEnd = window.setTimeout(() => setIsManualPressing(false), time + dashMs);
        testTimeoutsRef.current.push(tStart, tEnd);
        time += dashMs + intraGapMs;
      } else if (char === ' ') {
        time += charGapMs;
      }
    }

    const tFinish = window.setTimeout(() => setIsTestingSOS(false), time + 50);
    testTimeoutsRef.current.push(tFinish);
  };

  return (
    <div
      className={`card card-flash-pulse ${
        config.pulseCardBorders && isGlowing ? `pulsing-${config.color}` : ''
      }`}
      id="visual-flash-controls-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header & Master Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem',
          marginBottom: isExpanded ? '1rem' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: config.enabled ? activeColorInfo.glow : 'var(--card-border)',
              color: config.enabled ? activeColorInfo.hex : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            <Sun size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Visual Morse Flash & Optical Beacon</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: config.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                  color: config.enabled ? 'var(--success-color)' : 'var(--text-secondary)',
                }}
              >
                {config.enabled ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Synchronized optical flash & screen illumination with audio rhythm
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Master Enable/Disable Button */}
          <button
            id="toggle-visual-flash-btn"
            type="button"
            className="btn btn-secondary"
            onClick={() => onConfigChange({ ...config, enabled: !config.enabled })}
            style={{
              padding: '0.3rem 0.8rem',
              minHeight: '32px',
              fontSize: '0.8rem',
              gap: '0.4rem',
              borderColor: config.enabled ? activeColorInfo.hex : 'var(--card-border)',
              backgroundColor: config.enabled ? activeColorInfo.glow : undefined,
              color: config.enabled ? activeColorInfo.hex : 'var(--text-primary)',
            }}
          >
            <Zap size={14} fill={config.enabled ? 'currentColor' : 'none'} />
            <span>{config.enabled ? 'Flash Enabled' : 'Enable Flash'}</span>
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ padding: '0.3rem 0.5rem', minHeight: '32px', fontSize: '0.8rem' }}
            title={isExpanded ? 'Collapse Flash Controls' : 'Expand Flash Controls'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Main Visual Display & Beacon Lamp Stage */}
          {config.mode !== 'ambient-screen' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                borderRadius: '10px',
                padding: '1.2rem',
                border: '1px solid var(--card-border)',
                flexWrap: 'wrap',
                gap: '1rem',
                position: 'relative',
              }}
            >
              {/* Left Side: Optical Spotlight Lamp / Lens */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  className={`beacon-lens ${isGlowing ? `active-${config.color}` : ''}`}
                  style={{
                    transform: isGlowing ? 'scale(1.04)' : 'scale(1)',
                    transition: 'transform 0.05s ease-out, border-color 0.05s ease-out, box-shadow 0.05s ease-out',
                  }}
                >
                  {/* Outer Fresnel Rings */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '8px',
                      borderRadius: '50%',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                      opacity: isGlowing ? 0.8 : 0.3,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '16px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      opacity: isGlowing ? 0.9 : 0.2,
                    }}
                  />

                  {/* High Intensity Filament Bulb Core */}
                  <div
                    style={{
                      width: isGlowing ? '40px' : '22px',
                      height: isGlowing ? '40px' : '22px',
                      borderRadius: '50%',
                      backgroundColor: isGlowing ? activeColorInfo.hex : 'rgba(255, 255, 255, 0.1)',
                      boxShadow: isGlowing
                        ? `0 0 25px ${activeColorInfo.hex}, 0 0 50px ${activeColorInfo.hex}`
                        : 'none',
                      transition: 'all 0.04s ease-out',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isGlowing && (
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 0 10px #ffffff',
                        }}
                      />
                    )}
                  </div>

                  {/* Optical Flare Glare overlay */}
                  {isGlowing && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(circle, ${activeColorInfo.glow} 0%, rgba(${activeColorInfo.rgb}, 0.2) 60%, transparent 80%)`,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>

                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: isGlowing ? activeColorInfo.hex : 'var(--text-secondary)',
                    transition: 'color 0.05s ease',
                  }}
                >
                  {isGlowing ? (activeSymbol === '.' ? '● DIT (DOT)' : activeSymbol === '-' ? '▬ DAH (DASH)' : 'SIGNAL ON') : 'SHUTTER CLOSED'}
                </span>
              </div>

              {/* Center: Live Rhythm Telemetry & Symbol Indicator */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  minWidth: '170px',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Active Optical State</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: isGlowing ? activeColorInfo.hex : '#334155',
                      boxShadow: isGlowing ? `0 0 10px ${activeColorInfo.hex}` : 'none',
                      transition: 'all 0.04s ease',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: isGlowing ? activeColorInfo.hex : 'var(--text-secondary)',
                    }}
                  >
                    {isGlowing ? (activeSymbol || 'TRANSMITTING') : 'STANDBY'}
                  </span>
                </div>

                {/* Quick Test Patterns */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', minHeight: '26px', fontSize: '0.72rem' }}
                    onClick={() => triggerTestPulse('.')}
                    disabled={isTestingSOS}
                    title="Test Dot Flash"
                  >
                    Dot (.)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', minHeight: '26px', fontSize: '0.72rem' }}
                    onClick={() => triggerTestPulse('-')}
                    disabled={isTestingSOS}
                    title="Test Dash Flash"
                  >
                    Dash (-)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      minHeight: '26px',
                      fontSize: '0.72rem',
                      color: activeColorInfo.hex,
                    }}
                    onClick={() => triggerTestPulse('... --- ...')}
                    disabled={isTestingSOS}
                    title="Test SOS Rhythm Flash"
                  >
                    SOS (··· ——— ···)
                  </button>
                </div>
              </div>

              {/* Right Side: Manual Telegraph Lamp Shutter Key */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manual Shutter Key</span>
                <button
                  id="manual-flash-key-btn"
                  type="button"
                  onMouseDown={handleManualDown}
                  onMouseUp={handleManualUp}
                  onMouseLeave={handleManualUp}
                  onTouchStart={handleManualDown}
                  onTouchEnd={handleManualUp}
                  style={{
                    width: '90px',
                    height: '52px',
                    borderRadius: '8px',
                    border: `2px solid ${isManualPressing ? activeColorInfo.hex : 'var(--card-border)'}`,
                    backgroundColor: isManualPressing ? activeColorInfo.glow : 'rgba(0, 0, 0, 0.3)',
                    color: isManualPressing ? activeColorInfo.hex : 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    boxShadow: isManualPressing ? `0 0 15px ${activeColorInfo.glow}` : 'none',
                    transform: isManualPressing ? 'scale(0.96)' : 'scale(1)',
                    transition: 'all 0.04s ease',
                  }}
                  title="Click or Hold to manually flash the optical lamp"
                >
                  <Lightbulb size={16} />
                  <span>{isManualPressing ? 'FLASHING' : 'HOLD / TAP'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Flash Mode Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Flash Display Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {MODE_OPTIONS.map((opt) => {
                const isSelected = config.mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onConfigChange({ ...config, mode: opt.id })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? activeColorInfo.hex : 'var(--card-border)'}`,
                      backgroundColor: isSelected ? activeColorInfo.glow : 'rgba(0, 0, 0, 0.15)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? activeColorInfo.hex : 'var(--text-primary)' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flash Spectrum & Optical Colors */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Optical Light Color & Spectrum
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(Object.keys(COLOR_MAP) as FlashColor[]).map((colKey) => {
                const item = COLOR_MAP[colKey];
                const isSelected = config.color === colKey;
                return (
                  <button
                    key={colKey}
                    type="button"
                    onClick={() => onConfigChange({ ...config, color: colKey })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.35rem 0.7rem',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? item.hex : 'var(--card-border)'}`,
                      backgroundColor: isSelected ? item.glow : 'rgba(0, 0, 0, 0.15)',
                      color: isSelected ? item.hex : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: item.hex,
                        boxShadow: isSelected ? `0 0 8px ${item.hex}` : 'none',
                      }}
                    />
                    <span>{item.label}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.65 }}>({item.wavelength})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary Controls: Intensity & Border Glow Options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Flash Intensity */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Optical Intensity / Glow Opacity
                </label>
                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: activeColorInfo.hex }}>
                  {Math.round(config.intensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={config.intensity}
                onChange={(e) => onConfigChange({ ...config, intensity: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: activeColorInfo.hex }}
              />
            </div>

            {/* Pulse Card Borders Option */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.pulseCardBorders}
                  onChange={(e) => onConfigChange({ ...config, pulseCardBorders: e.target.checked })}
                  style={{ accentColor: activeColorInfo.hex }}
                />
                <span>Pulse converter card borders with Morse audio</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginTop: '0.4rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.highlightActiveChar}
                  onChange={(e) => onConfigChange({ ...config, highlightActiveChar: e.target.checked })}
                  style={{ accentColor: activeColorInfo.hex }}
                />
                <span>Highlight active Morse symbol in output viewer</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Fullscreen Ambient Screen Glow Overlay
 * Synchronizes with Morse pulse when ambient-screen or both modes are selected.
 */
export function VisualFlashOverlay({
  config,
  isPulseActive,
}: {
  config: VisualFlashConfig;
  isPulseActive: boolean;
}) {
  if (!config.enabled || (config.mode !== 'both' && config.mode !== 'ambient-screen')) {
    return null;
  }

  const activeColorInfo = COLOR_MAP[config.color] || COLOR_MAP.amber;
  const opacity = isPulseActive ? config.intensity * 0.45 : 0;

  return (
    <div
      className={`morse-ambient-flash ${isPulseActive ? 'active' : ''}`}
      style={{
        background: `radial-gradient(circle at center, rgba(${activeColorInfo.rgb}, ${opacity * 0.4}) 0%, rgba(${activeColorInfo.rgb}, ${opacity * 0.8}) 85%, rgba(${activeColorInfo.rgb}, ${opacity}) 100%)`,
        boxShadow: isPulseActive ? `inset 0 0 100px rgba(${activeColorInfo.rgb}, ${config.intensity * 0.7})` : 'none',
      }}
      aria-hidden="true"
    />
  );
}
