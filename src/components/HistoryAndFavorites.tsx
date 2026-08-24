import React, { useState, useMemo, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star,
  Trash2,
  Download,
  Copy,
  Play,
  Search,
  Bookmark,
  Sparkles,
  ArrowUpRight,
  Clock,
  Radio,
  Check,
  Filter,
} from 'lucide-react';
import { HistoryItem, ConversionMode } from '../types';

interface HistoryAndFavoritesProps {
  history: HistoryItem[];
  onHistoryChange: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  onLoadItem: (item: HistoryItem) => void;
  onPlayMorse?: (morse: string) => void;
  showToast: (msg: string) => void;
  currentInputText?: string;
  currentMorseCode?: string;
  currentMode?: ConversionMode;
}

export function HistoryAndFavorites({
  history,
  onHistoryChange,
  onLoadItem,
  onPlayMorse,
  showToast,
  currentInputText,
  currentMorseCode,
  currentMode = 'readable',
}: HistoryAndFavoritesProps) {
  const [activeView, setActiveView] = useState<'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const favoriteItems = useMemo(() => {
    return history.filter((item) => item.isFavorite);
  }, [history]);

  const filteredItems = useMemo(() => {
    const baseList = activeView === 'favorites' ? favoriteItems : history;
    if (!searchQuery.trim()) return baseList;

    const query = searchQuery.toLowerCase();
    return baseList.filter(
      (item) =>
        item.originalText.toLowerCase().includes(query) ||
        item.morseCode.toLowerCase().includes(query) ||
        item.mode.toLowerCase().includes(query) ||
        (item.script && item.script.toLowerCase().includes(query))
    );
  }, [history, favoriteItems, activeView, searchQuery]);

  const toggleFavorite = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    onHistoryChange((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.isFavorite;
          showToast(nextState ? '★ Pinned to Favorites' : 'Removed from Favorites');
          return { ...item, isFavorite: nextState };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    onHistoryChange((prev) => prev.filter((item) => item.id !== id));
    showToast('Item deleted');
  };

  const handleCopyMorse = (item: HistoryItem, e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.morseCode);
    setCopiedId(item.id);
    showToast('Morse code copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePinCurrent = () => {
    if (!currentInputText || !currentInputText.trim() || !currentMorseCode) {
      showToast('No active text to pin');
      return;
    }

    const existingIndex = history.findIndex(
      (item) => item.originalText === currentInputText && item.mode === currentMode
    );

    if (existingIndex >= 0) {
      onHistoryChange((prev) =>
        prev.map((item, idx) => (idx === existingIndex ? { ...item, isFavorite: true } : item))
      );
      showToast('★ Current sequence pinned to Favorites');
    } else {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        originalText: currentInputText,
        morseCode: currentMorseCode,
        mode: currentMode,
        script: 'auto',
        isFavorite: true,
      };
      onHistoryChange((prev) => [newItem, ...prev]);
      showToast('★ Pinned new sequence to Favorites');
    }
  };

  const handleDownloadCSV = () => {
    const listToExport = activeView === 'favorites' ? favoriteItems : history;
    if (listToExport.length === 0) {
      showToast('No records to export');
      return;
    }

    const escapeCSV = (field: string | number | boolean | undefined | null): string => {
      const str = String(field ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'ID',
      'Timestamp',
      'Date UTC',
      'Pinned Favorite',
      'Mode',
      'Detected Script',
      'Original Text',
      'Morse Code',
    ];
    const rows = listToExport.map((item) => [
      escapeCSV(item.id),
      escapeCSV(item.timestamp),
      escapeCSV(new Date(item.timestamp).toISOString()),
      escapeCSV(item.isFavorite ? 'Yes' : 'No'),
      escapeCSV(item.mode),
      escapeCSV(item.script || 'auto'),
      escapeCSV(item.originalText),
      escapeCSV(item.morseCode),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `morse_${activeView === 'favorites' ? 'favorites' : 'history'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${listToExport.length} ${activeView === 'favorites' ? 'favorites' : 'history items'} to CSV`);
  };

  const handleClear = () => {
    if (activeView === 'favorites') {
      onHistoryChange((prev) => prev.map((item) => ({ ...item, isFavorite: false })));
      showToast('Cleared all pinned favorites');
    } else {
      onHistoryChange([]);
      showToast('Cleared all conversion history');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isCurrentPinned = useMemo(() => {
    if (!currentInputText) return false;
    return history.some((item) => item.originalText === currentInputText && item.isFavorite);
  }, [history, currentInputText]);

  if (history.length === 0 && !currentInputText) {
    return null;
  }

  return (
    <div className="card" id="history-and-favorites-panel">
      {/* Top Header & Tab Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.6rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* View Filter Pill Switcher */}
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
              id="history-tab-all-btn"
              type="button"
              onClick={() => setActiveView('all')}
              style={{
                padding: '0.3rem 0.7rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: activeView === 'all' ? 'var(--card-border)' : 'transparent',
                color: activeView === 'all' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Clock size={13} />
              <span>History ({history.length})</span>
            </button>
            <button
              id="history-tab-favorites-btn"
              type="button"
              onClick={() => setActiveView('favorites')}
              style={{
                padding: '0.3rem 0.7rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: activeView === 'favorites' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                color: activeView === 'favorites' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Star
                size={13}
                fill={favoriteItems.length > 0 ? 'var(--accent-amber)' : 'none'}
                color="var(--accent-amber)"
              />
              <span>Favorites ({favoriteItems.length})</span>
            </button>
          </div>

          {/* Quick Pin Current Result button */}
          {currentInputText && currentInputText.trim() && (
            <button
              id="pin-current-sequence-btn"
              type="button"
              onClick={handlePinCurrent}
              className="btn btn-secondary"
              style={{
                padding: '0.3rem 0.6rem',
                minHeight: '32px',
                fontSize: '0.78rem',
                gap: '0.35rem',
                borderColor: isCurrentPinned ? 'var(--accent-amber)' : 'var(--card-border)',
                backgroundColor: isCurrentPinned ? 'rgba(245, 158, 11, 0.15)' : undefined,
                color: isCurrentPinned ? 'var(--accent-amber)' : 'var(--text-primary)',
              }}
              title={isCurrentPinned ? 'Currently Pinned to Favorites' : 'Pin current Morse sequence to Favorites'}
            >
              <Star
                size={13}
                fill={isCurrentPinned ? 'var(--accent-amber)' : 'none'}
                color="var(--accent-amber)"
              />
              <span>{isCurrentPinned ? 'Pinned' : 'Pin Current'}</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            id="download-history-csv-btn"
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.6rem', minHeight: '30px', fontSize: '0.78rem', gap: '0.35rem' }}
            onClick={handleDownloadCSV}
            title="Export to CSV file"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
          <button
            id="clear-all-history-btn"
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '0.2rem 0.6rem',
              minHeight: '30px',
              fontSize: '0.78rem',
              color: 'var(--danger-color)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}
            onClick={handleClear}
            title={activeView === 'favorites' ? 'Clear all favorites' : 'Clear all history'}
          >
            {activeView === 'favorites' ? 'Clear Favorites' : 'Clear All'}
          </button>
        </div>
      </div>

      {/* Search Input Filter */}
      {history.length > 3 && (
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            id="history-search-input"
            type="text"
            placeholder={`Search ${activeView === 'favorites' ? 'favorites' : 'history'} by text, Morse, or mode...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.75rem 0.4rem 2rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              border: '1px solid var(--card-border)',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      )}

      {/* List container */}
      <div
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          paddingRight: '0.15rem',
        }}
      >
        <AnimatePresence initial={false}>
          {filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                padding: '1.5rem 1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                borderRadius: '8px',
                border: '1px dashed var(--card-border)',
              }}
            >
              {activeView === 'favorites' ? (
                <div>
                  <Star size={24} style={{ color: 'var(--accent-amber)', margin: '0 auto 0.5rem', opacity: 0.8 }} />
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    No Pinned Favorites Yet
                  </div>
                  <div>Click the star icon on any sequence in the list to pin it for quick recall.</div>
                </div>
              ) : (
                <div>No matching history items found for "{searchQuery}".</div>
              )}
            </motion.div>
          ) : (
            filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x: -25,
                  scale: 0.92,
                  transition: { duration: 0.2, ease: 'easeInOut' },
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={() => onLoadItem(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: item.isFavorite ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 0, 0, 0.12)',
                  border: `1px solid ${item.isFavorite ? 'rgba(245, 158, 11, 0.35)' : 'var(--card-border)'}`,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {/* Pin / Favorite Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(item.id, e)}
                  title={item.isFavorite ? 'Unpin from favorites' : 'Pin to favorites'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.isFavorite ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  <Star
                    size={16}
                    fill={item.isFavorite ? 'var(--accent-amber)' : 'none'}
                    color={item.isFavorite ? 'var(--accent-amber)' : 'currentColor'}
                  />
                </button>

                {/* Content info */}
                <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginBottom: '0.15rem',
                      flexWrap: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '3px',
                        backgroundColor: 'var(--card-border)',
                        color: 'var(--accent-amber)',
                        flexShrink: 0,
                      }}
                    >
                      {item.mode.toUpperCase()}
                    </span>

                    <span
                      style={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {item.originalText}
                    </span>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                    >
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>

                  {/* Morse snippet */}
                  <div
                    style={{
                      fontSize: '0.76rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-blue)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      opacity: 0.9,
                    }}
                  >
                    {item.morseCode}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  {/* Play Audio */}
                  {onPlayMorse && (
                    <button
                      type="button"
                      aria-label="Play Morse sound"
                      title="Play Morse Audio"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayMorse(item.morseCode);
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.2rem 0.45rem',
                        minHeight: '26px',
                        fontSize: '0.74rem',
                      }}
                    >
                      <Play size={12} fill="currentColor" />
                    </button>
                  )}

                  {/* Copy Morse */}
                  <button
                    type="button"
                    aria-label="Copy Morse code"
                    title="Copy Morse Code"
                    onClick={(e) => handleCopyMorse(item, e)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.2rem 0.45rem',
                      minHeight: '26px',
                      fontSize: '0.74rem',
                      color: copiedId === item.id ? 'var(--accent-amber)' : undefined,
                    }}
                  >
                    {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>

                  {/* Delete Item */}
                  <button
                    type="button"
                    aria-label="Delete item"
                    title="Delete item"
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.2rem 0.45rem',
                      minHeight: '26px',
                      fontSize: '0.74rem',
                      color: 'var(--danger-color)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
