import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Globe,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Zap,
  BrainCircuit,
  Settings2,
  ExternalLink,
  ArrowDownToLine,
  Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ChatModel, ChatRolePreset } from '../types';

interface GeminiChatbotProps {
  onInsertToConverter: (text: string) => void;
  showToast: (msg: string) => void;
}

const ROLE_PRESETS: ChatRolePreset[] = [
  {
    id: 'historian',
    name: 'Telegraph Historian',
    description: 'Specialist in Morse history, international code evolutions, cables & Titanic SOS.',
    systemInstruction:
      'You are an expert Morse code and telecommunications historian. ' +
      'You explain the invention of the electric telegraph by Samuel Morse and Alfred Vail, ' +
      'the evolution of Continental and International Morse Code, submarine telegraph cables, ' +
      'military communications, maritime distress protocols, and historical significance with vivid, accurate details.',
  },
  {
    id: 'tutor',
    name: 'Morse Operator Tutor',
    description: 'Step-by-step teacher for rhythm, Farnsworth timing, memory mnemonics, and quizzes.',
    systemInstruction:
      'You are an enthusiastic Morse code tutor. ' +
      'You help students learn and master Morse code through step-by-step mnemonics, ' +
      'rhythm advice (dits and dahs), Farnsworth method tips, Q-codes, procedural signals (prosigns), ' +
      'and interactive practice exercises or quizzes.',
  },
  {
    id: 'signals',
    name: 'Radio & Cipher Specialist',
    description: 'Expert in CW radio operating, emergency frequencies, amateur radio, and signal encoding.',
    systemInstruction:
      'You are a radio communications and signal cipher specialist. ' +
      'You provide deep technical insights on Continuous Wave (CW) radio, amateur radio bands, ' +
      'emergency survival signaling, optical/flashlight Morse, audio modulation, and historical cryptanalysis.',
  },
  {
    id: 'general',
    name: 'Universal Assistant',
    description: 'Helpful general assistant with broad knowledge across all topics.',
    systemInstruction:
      'You are a versatile, intelligent AI assistant. ' +
      'Answer questions clearly, thoughtfully, and accurately on any topic.',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'model',
    text: 'Hello! I am your AI Telegraph & Morse Code assistant powered by Gemini. Ask me about telegraph history, request interactive Morse code practice, or search for up-to-date telecommunications information.',
    timestamp: Date.now(),
    modelUsed: 'gemini-3.5-flash',
  },
];

export function GeminiChatbot({ onInsertToConverter, showToast }: GeminiChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_chat_history');
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ChatModel>('gemini-3.5-flash');
  const [enableSearch, setEnableSearch] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('historian');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Save chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gemini_chat_history', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeRole = ROLE_PRESETS.find((r) => r.id === selectedRoleId) || ROLE_PRESETS[0];
  const effectiveSystemInstruction = customSystemPrompt.trim() || activeRole.systemInstruction;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessageId = Date.now().toString();
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history payload (excluding initial greeting if needed, or sending all)
      const apiMessages = updatedMessages
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      // Note: If Search Grounding is enabled, use gemini-3.5-flash per requirements
      const modelToUse = enableSearch ? 'gemini-3.5-flash' : selectedModel;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemInstruction: effectiveSystemInstruction,
          model: modelToUse,
          enableSearch,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned error ${response.status}`);
      }

      const data = await response.json();
      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.text || 'No response generated.',
        timestamp: Date.now(),
        groundingSources: data.groundingSources,
        searchQueries: data.searchQueries,
        modelUsed: modelToUse,
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `Error: ${err.message || 'Unable to connect to Gemini'}. Please check your connection or API key in Settings > Secrets.`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      showToast('Chat request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied message to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    showToast('Cleared chat history');
  };

  const QUICK_PROMPTS = [
    { label: 'Titanic SOS Story', text: 'Explain the history and transmission details of the Titanic SOS distress call in Morse code.' },
    { label: 'Q-Codes Guide', text: 'What are the top 10 most useful Q-codes (e.g. QTH, QSL, QRZ) used in Morse telegraphy?' },
    { label: 'Quick Morse Quiz', text: 'Give me a 3-question interactive quiz to test my knowledge of Morse code letters!' },
    { label: 'Search CW News', text: 'Search and tell me recent news and global events in the amateur radio and CW community.', search: true },
  ];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: '1rem' }}>
      {/* Chat Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--card-border)',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={18} style={{ color: 'var(--accent-amber)' }} />
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Gemini AI Assistant</span>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Role: <strong style={{ color: 'var(--text-main)' }}>{activeRole.name}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '0.25rem 0.6rem',
              minHeight: '30px',
              fontSize: '0.78rem',
              backgroundColor: showConfig ? 'rgba(245, 158, 11, 0.2)' : undefined,
              borderColor: showConfig ? 'var(--accent-amber)' : undefined,
            }}
            onClick={() => setShowConfig(!showConfig)}
            title="Configure model, role and search tools"
          >
            <Settings2 size={13} />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', minHeight: '30px', fontSize: '0.78rem' }}
            onClick={handleClearChat}
            title="Clear chat thread"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Configuration Tray */}
      {showConfig && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            border: '1px solid var(--card-border)',
            marginBottom: '0.75rem',
            fontSize: '0.82rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          {/* Model Selection */}
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Gemini Model:</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: 'gemini-3.5-flash' as ChatModel, label: 'gemini-3.5-flash (General)', icon: Zap },
                { id: 'gemini-3.1-flash-lite' as ChatModel, label: 'gemini-3.1-flash-lite (Fast)', icon: Sparkles },
                { id: 'gemini-3.1-pro-preview' as ChatModel, label: 'gemini-3.1-pro-preview (Complex Tasks)', icon: BrainCircuit },
              ].map((m) => {
                const isSelected = selectedModel === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.25rem 0.55rem',
                      minHeight: '28px',
                      fontSize: '0.75rem',
                      borderColor: isSelected ? 'var(--accent-amber)' : undefined,
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : undefined,
                      color: isSelected ? 'var(--accent-amber)' : undefined,
                    }}
                  >
                    <Icon size={12} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Grounding Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Globe size={14} style={{ color: enableSearch ? 'var(--accent-amber)' : 'var(--text-muted)' }} />
              <div>
                <span style={{ fontWeight: 600 }}>Google Search Grounding</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Fetches verified real-time web information with citations (uses gemini-3.5-flash).
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '0.2rem 0.6rem',
                minHeight: '26px',
                fontSize: '0.75rem',
                backgroundColor: enableSearch ? 'rgba(34, 197, 94, 0.2)' : undefined,
                color: enableSearch ? '#4ade80' : undefined,
                borderColor: enableSearch ? 'rgba(34, 197, 94, 0.4)' : undefined,
              }}
              onClick={() => setEnableSearch(!enableSearch)}
            >
              {enableSearch ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Role Preset Selector */}
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Assistant Persona Role:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.35rem' }}>
              {ROLE_PRESETS.map((preset) => {
                const isSelected = selectedRoleId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoleId(preset.id);
                      setCustomSystemPrompt('');
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.3rem 0.5rem',
                      minHeight: '30px',
                      fontSize: '0.75rem',
                      textAlign: 'left',
                      borderColor: isSelected ? 'var(--accent-amber)' : undefined,
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : undefined,
                      color: isSelected ? 'var(--accent-amber)' : undefined,
                    }}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              {activeRole.description}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Message Thread */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          paddingRight: '0.3rem',
          marginBottom: '0.75rem',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.2rem',
                }}
              >
                {isUser ? <User size={12} /> : <Bot size={12} style={{ color: 'var(--accent-amber)' }} />}
                <span>{isUser ? 'You' : 'Gemini'}</span>
                {msg.modelUsed && (
                  <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>({msg.modelUsed})</span>
                )}
              </div>

              <div
                style={{
                  maxWidth: '88%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  backgroundColor: isUser
                    ? 'var(--accent-amber)'
                    : msg.isError
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(0, 0, 0, 0.25)',
                  color: isUser ? '#1a1300' : 'var(--text-main)',
                  border: isUser
                    ? 'none'
                    : msg.isError
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid var(--card-border)',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}
              >
                {isUser ? (
                  <div>{msg.text}</div>
                ) : (
                  <div className="chat-markdown-body">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}

                {/* Grounding Sources (Search Citations) */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-amber)', marginBottom: '0.3rem' }}>
                      <Globe size={12} />
                      <span style={{ fontWeight: 600 }}>Web Search Sources:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {msg.groundingSources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            color: 'var(--text-main)',
                            textDecoration: 'none',
                            fontSize: '0.72rem',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {source.title || source.uri}
                          </span>
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions footer on model messages */}
                {!isUser && !msg.isError && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.4rem',
                      marginTop: '0.4rem',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.text, msg.id)}
                      title="Copy response"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.1rem 0.3rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.7rem',
                      }}
                    >
                      {copiedId === msg.id ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onInsertToConverter(msg.text);
                        showToast('Inserted into main Morse converter');
                      }}
                      title="Load into main converter"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.1rem 0.3rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.7rem',
                      }}
                    >
                      <ArrowDownToLine size={11} />
                      <span>Convert</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 0' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-amber)' }} />
            <span>Gemini is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (qp.search) setEnableSearch(true);
              handleSendMessage(qp.text);
            }}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{
              padding: '0.2rem 0.55rem',
              minHeight: '26px',
              fontSize: '0.73rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {qp.search && <Globe size={10} style={{ color: 'var(--accent-amber)' }} />}
            <span>{qp.label}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Gemini about Morse code, telegraph history, or request a quiz... (Enter to send)"
          rows={2}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-main)',
            fontSize: '0.86rem',
            resize: 'none',
            outline: 'none',
          }}
        />
        <button
          id="send-gemini-chat-btn"
          type="button"
          className="btn btn-primary"
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isLoading}
          style={{
            padding: '0.55rem 0.85rem',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
