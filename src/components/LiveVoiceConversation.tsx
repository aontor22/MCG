import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  PhoneOff,
  Sparkles,
  AlertCircle,
  Activity,
  Headphones,
} from 'lucide-react';
import { pcmFloat32ToBase64, base64ToPcmFloat32 } from '../audioUtils';

interface LiveVoiceConversationProps {
  showToast: (msg: string) => void;
}

export function LiveVoiceConversation({ showToast }: LiveVoiceConversationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Press "Start Voice Session" to speak in real-time.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const disconnectSession = useCallback(() => {
    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    // Stop playback sources
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    nextStartTimeRef.current = 0;
    setIsConnected(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    setMicLevel(0);
    setStatusMessage('Voice session ended.');
  }, []);

  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, [disconnectSession]);

  const playAudioChunk = (base64Audio: string) => {
    try {
      if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }

      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const float32Data = base64ToPcmFloat32(base64Audio);
      if (float32Data.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.copyToChannel(float32Data, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setIsModelSpeaking(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsModelSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  const startVoiceSession = async () => {
    disconnectSession();
    setIsConnecting(true);
    setErrorMessage(null);
    setStatusMessage('Requesting microphone & establishing Live connection...');

    try {
      // 1. Get user mic media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // 2. Output audio context (24kHz for Live API)
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      // 3. Input audio context (16kHz for mic capture)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputCtx;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatusMessage('Connecting to Gemini Live API...');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ready') {
            setIsConnected(true);
            setIsConnecting(false);
            setStatusMessage('Connected! Start speaking to the Live API.');
            showToast('Connected to Gemini Live Voice');
          } else if (msg.type === 'audio' && msg.audio) {
            playAudioChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            // Stop current playback
            activeSourcesRef.current.forEach((src) => {
              try {
                src.stop();
              } catch (_) {}
            });
            activeSourcesRef.current = [];
            nextStartTimeRef.current = 0;
            setIsModelSpeaking(false);
          } else if (msg.type === 'error') {
            setErrorMessage(msg.message || 'Live session error');
            showToast('Live API error occurred');
          }
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setErrorMessage('WebSocket connection failed. Ensure server is running.');
        setIsConnecting(false);
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusMessage('Voice session closed.');
      };

      // 4. Set up ScriptProcessor for mic capture (buffer size 4096)
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || isMutedRef.current) {
          setMicLevel(0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate visual level
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setMicLevel(Math.min(100, Math.round(rms * 250)));

        const base64Audio = pcmFloat32ToBase64(inputData);
        ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
      };
    } catch (err: any) {
      console.error('Failed to start Live Voice:', err);
      setErrorMessage(err.message || 'Could not start voice session.');
      setIsConnecting(false);
      disconnectSession();
    }
  };

  const SUGGESTED_TOPICS = [
    'How do I practice sending dits and dahs cleanly?',
    'Explain why Morse code was essential for maritime radio.',
    'Test my Morse ear by saying letters for me to identify.',
    'What are telegraph repeaters and how did they boost signals across continents?',
  ];

  return (
    <div className="card" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={18} style={{ color: 'var(--accent-amber)' }} />
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Real-Time Voice Conversations</span>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Model: <strong style={{ color: 'var(--accent-amber)' }}>gemini-3.1-flash-live-preview</strong> (Live API)
            </div>
          </div>
        </div>

        {isConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4ade80' }}>LIVE VOICE</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
        Have real-time two-way voice conversations with low latency. Talk into your microphone to discuss Morse code, practice rhythm, or learn telegraphy techniques naturally.
      </p>

      {/* Visualizer & Status Box */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          border: isConnected
            ? isModelSpeaking
              ? '1px solid #38bdf8'
              : '1px solid var(--accent-amber)'
            : '1px solid var(--card-border)',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '130px',
          textAlign: 'center',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Status Indicator Icon */}
        <div style={{ marginBottom: '0.75rem' }}>
          {isConnecting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-amber)' }}>
              <Activity size={24} className="animate-spin" />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Connecting to Live API...</span>
            </div>
          ) : isConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isModelSpeaking ? (
                  <>
                    <Volume2 size={24} style={{ color: '#38bdf8' }} />
                    <span style={{ fontWeight: 600, color: '#38bdf8' }}>Gemini is speaking...</span>
                  </>
                ) : (
                  <>
                    <Mic size={24} style={{ color: isMuted ? 'var(--text-muted)' : 'var(--accent-amber)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>
                      {isMuted ? 'Microphone Muted' : 'Listening to you...'}
                    </span>
                  </>
                )}
              </div>

              {/* Animated Equalizer Wave Bars */}
              <div style={{ display: 'flex', gap: '4px', height: '24px', alignItems: 'center', marginTop: '0.25rem' }}>
                {[...Array(9)].map((_, i) => {
                  const activeHeight = isModelSpeaking
                    ? 10 + Math.sin(Date.now() / 150 + i) * 12 + 6
                    : isMuted
                    ? 4
                    : Math.max(4, (micLevel / 100) * 22 * ((i % 3) + 0.5));
                  return (
                    <div
                      key={i}
                      style={{
                        width: '4px',
                        height: `${Math.max(4, activeHeight)}px`,
                        backgroundColor: isModelSpeaking ? '#38bdf8' : isMuted ? '#6b7280' : 'var(--accent-amber)',
                        borderRadius: '2px',
                        transition: 'height 0.08s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Headphones size={28} />
              <span style={{ fontSize: '0.85rem' }}>Live Session Offline</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {statusMessage}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--danger-color)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Voice Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        {!isConnected ? (
          <button
            id="start-live-voice-btn"
            type="button"
            className="btn btn-primary"
            onClick={startVoiceSession}
            disabled={isConnecting}
            style={{
              padding: '0.5rem 1.25rem',
              minHeight: '40px',
              fontSize: '0.88rem',
              gap: '0.5rem',
            }}
          >
            <Radio size={16} />
            <span>{isConnecting ? 'Connecting...' : 'Start Voice Session'}</span>
          </button>
        ) : (
          <>
            <button
              id="mute-live-mic-btn"
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsMuted(!isMuted)}
              style={{
                padding: '0.5rem 1rem',
                minHeight: '40px',
                fontSize: '0.85rem',
                gap: '0.4rem',
                backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.15)' : undefined,
                color: isMuted ? 'var(--danger-color)' : undefined,
              }}
            >
              {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            <button
              id="end-live-voice-btn"
              type="button"
              className="btn btn-secondary"
              onClick={disconnectSession}
              style={{
                padding: '0.5rem 1rem',
                minHeight: '40px',
                fontSize: '0.85rem',
                gap: '0.4rem',
                color: 'var(--danger-color)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}
            >
              <PhoneOff size={15} />
              <span>End Voice Session</span>
            </button>
          </>
        )}
      </div>

      {/* Suggested Conversation Starters */}
      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Suggested Voice Conversation Starters:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {SUGGESTED_TOPICS.map((topic, i) => (
            <div
              key={i}
              style={{
                padding: '0.35rem 0.65rem',
                backgroundColor: 'rgba(0, 0, 0, 0.12)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)',
              }}
            >
              • {topic}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
