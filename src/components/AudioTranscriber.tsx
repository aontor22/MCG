import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Square, Loader2, Upload, Sparkles, Check, AlertCircle } from 'lucide-react';
import { blobToBase64 } from '../audioUtils';

interface AudioTranscriberProps {
  onTranscribeComplete: (text: string, mode?: 'append' | 'replace') => void;
  showToast: (msg: string) => void;
}

export function AudioTranscriber({ onTranscribeComplete, showToast }: AudioTranscriberProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
    animFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [isRecording]);

  const cleanupAudio = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio level analyser
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const recordedBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanupAudio();
        await transcribeBlob(recordedBlob, recorder.mimeType || 'audio/webm');
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      animFrameRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setErrorMessage(err.message || 'Microphone access denied or unavailable.');
      showToast('Could not access microphone');
      cleanupAudio();
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const transcribeBlob = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMessage(null);
    try {
      const base64Data = await blobToBase64(blob);
      const response = await fetch('/api/gemini/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Data,
          mimeType: mimeType || 'audio/webm',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      const resultText = (data.transcription || '').trim();

      if (!resultText) {
        setErrorMessage('No speech or Morse audio was detected in the recording.');
        showToast('No recognizable audio detected');
      } else {
        setLastTranscription(resultText);
        onTranscribeComplete(resultText, 'replace');
        showToast('Transcribed audio successfully with Gemini 3.5 Flash');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setErrorMessage(err.message || 'Failed to transcribe audio.');
      showToast('Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    transcribeBlob(file, file.type || 'audio/webm');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="card"
      style={{
        border: isRecording ? '1px solid var(--accent-amber)' : '1px solid var(--card-border)',
        transition: 'border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-amber)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>AI Audio Transcription</span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '0.1rem 0.45rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--accent-amber)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontWeight: 500,
            }}
          >
            gemini-3.5-flash
          </span>
        </div>

        {isRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger-color)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--danger-color)',
                animation: 'pulse 1s infinite',
              }}
            />
            <span>REC {formatTime(recordingSeconds)}</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem', lineHeight: 1.4 }}>
        Speak into your microphone or provide Morse beeps. Gemini will transcribe spoken speech or Morse audio into text directly.
      </p>

      {/* Audio Visualizer Meter when recording */}
      {isRecording && (
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            <span>Input Volume Level</span>
            <span>{audioLevel}%</span>
          </div>
          <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${audioLevel}%`,
                backgroundColor: audioLevel > 70 ? 'var(--danger-color)' : 'var(--accent-amber)',
                transition: 'width 0.05s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {!isRecording ? (
          <button
            id="start-mic-transcription-btn"
            type="button"
            className="btn btn-primary"
            onClick={startRecording}
            disabled={isTranscribing}
            style={{
              padding: '0.4rem 0.9rem',
              minHeight: '36px',
              gap: '0.4rem',
              fontSize: '0.85rem',
            }}
          >
            {isTranscribing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Transcribing...</span>
              </>
            ) : (
              <>
                <Mic size={14} />
                <span>Record from Mic</span>
              </>
            )}
          </button>
        ) : (
          <button
            id="stop-mic-transcription-btn"
            type="button"
            className="btn btn-secondary"
            onClick={stopRecording}
            style={{
              padding: '0.4rem 0.9rem',
              minHeight: '36px',
              gap: '0.4rem',
              fontSize: '0.85rem',
              color: 'var(--danger-color)',
              borderColor: 'rgba(239, 68, 68, 0.4)',
            }}
          >
            <Square size={14} />
            <span>Stop Recording</span>
          </button>
        )}

        <button
          id="upload-audio-file-btn"
          type="button"
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || isTranscribing}
          style={{
            padding: '0.4rem 0.85rem',
            minHeight: '36px',
            gap: '0.4rem',
            fontSize: '0.85rem',
          }}
          title="Upload an audio file (WAV, MP3, WebM)"
        >
          <Upload size={14} />
          <span>Upload Audio File</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </div>

      {/* Error display */}
      {errorMessage && (
        <div
          style={{
            marginTop: '0.75rem',
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

      {/* Last Result Card */}
      {lastTranscription && !isTranscribing && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.75rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--card-border)',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--accent-amber)', fontSize: '0.78rem' }}>Latest Transcription:</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.15rem 0.45rem', minHeight: '24px', fontSize: '0.72rem' }}
                onClick={() => {
                  onTranscribeComplete(lastTranscription, 'replace');
                  showToast('Replaced input text');
                }}
              >
                Use
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.15rem 0.45rem', minHeight: '24px', fontSize: '0.72rem' }}
                onClick={() => {
                  onTranscribeComplete(lastTranscription, 'append');
                  showToast('Appended to input text');
                }}
              >
                Append
              </button>
            </div>
          </div>
          <div style={{ color: 'var(--text-main)', fontStyle: 'italic', wordBreak: 'break-word' }}>
            "{lastTranscription}"
          </div>
        </div>
      )}
    </div>
  );
}
