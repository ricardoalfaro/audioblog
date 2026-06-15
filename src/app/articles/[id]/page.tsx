'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Article } from '@/types';
import { useAudioPlayer, EDGE_VOICES } from '@/contexts/AudioPlayerContext';

interface Token {
  text: string;
  isWord: boolean;
  startIndex: number;
  endIndex: number;
}

function parseTokens(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\s+)|(\S+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      isWord: match[2] !== undefined,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return tokens;
}

export default function ArticleReader() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

  const {
    playingArticle, isPlaying, isPaused,
    activeParagraphIndex, currentCharIndex,
    speechRate, audioEngine, sortedVoices, selectedVoiceName, selectedEdgeVoice,
    playArticle, handlePlayPause, handleParagraphClick,
    toggleSpeed, handleEngineChange, handleVoiceChange, handleEdgeVoiceChange,
    getRemainingTime, formatTime,
  } = useAudioPlayer();

  // Is this article the one currently loaded in the player?
  const isThisArticlePlaying = playingArticle?.id === id;

  useEffect(() => {
    if (!id) return;
    try {
      setIsLoading(true);
      const localData = localStorage.getItem('articles');
      if (!localData) throw new Error('No se encontró el historial de artículos.');
      const articlesList: Article[] = JSON.parse(localData);
      const data = articlesList.find(a => a.id === id);
      if (!data) throw new Error('No se pudo encontrar el artículo.');
      setArticle(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el artículo.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Collapse sidebar on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 900;
      setIsMetaExpanded(!isMobile);
      setIsSettingsExpanded(!isMobile);
    }
  }, []);

  // Scroll to active paragraph
  useEffect(() => {
    if (isThisArticlePlaying && activeParagraphIndex >= 0) {
      const el = document.getElementById(`p-${activeParagraphIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeParagraphIndex, isThisArticlePlaying]);

  const handleLocalPlayPause = () => {
    if (!article) return;
    if (isThisArticlePlaying) {
      handlePlayPause();
    } else {
      playArticle(article, 0);
    }
  };

  const handleLocalParagraphClick = (index: number) => {
    if (!article) return;
    if (isThisArticlePlaying) {
      handleParagraphClick(index);
    } else {
      // Start playing this article from this paragraph
      playArticle(article, index);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <main className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ marginBottom: '16px' }}>Error al cargar el artículo</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>{error || 'El artículo no existe.'}</p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>
          Volver al Inicio
        </button>
      </main>
    );
  }

  const remainingTime = isThisArticlePlaying ? getRemainingTime() : article.duration;
  const activeIdx = isThisArticlePlaying ? activeParagraphIndex : -1;
  const charIdx = isThisArticlePlaying ? currentCharIndex : -1;

  return (
    <main className="container reader-layout">
      {/* Sidebar Controls */}
      <aside className="reader-sidebar">
        <a href="/" className="back-link">
          <i className="fa-solid fa-arrow-left"></i> Volver a la biblioteca
        </a>

        <div className="sidebar-card glass">
          <div
            onClick={() => setIsMetaExpanded(!isMetaExpanded)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-circle-info" style={{ color: 'var(--color-primary)' }}></i> Detalles del Artículo
            </h3>
            <i className={`fa-solid fa-chevron-${isMetaExpanded ? 'up' : 'down'}`} style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
          </div>

          {isMetaExpanded && (
            <div style={{ marginTop: '16px', animation: 'fadeIn 0.2s ease-out' }}>
              <span className="sidebar-category">{article.category}</span>
              <h2 className="sidebar-title" style={{ marginTop: '4px', marginBottom: '12px' }}>{article.title}</h2>

              <div className="sidebar-meta" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div className="meta-item">
                  <span className="meta-label">Autor:</span>
                  <span style={{ fontWeight: 500 }}>{article.author}</span>
                </div>
                {article.url && article.url !== 'manual' && (
                  <div className="meta-item">
                    <span className="meta-label">Fuente:</span>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      Ver original <i className="fa-solid fa-up-right-from-square" style={{ fontSize: '10px' }}></i>
                    </a>
                  </div>
                )}
                <div className="meta-item">
                  <span className="meta-label">Párrafos:</span>
                  <span>{article.paragraphs.length}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Restante:</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>~ {formatTime(remainingTime)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-card glass" style={{ marginTop: '12px' }}>
          <div
            onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-sliders" style={{ color: 'var(--color-primary)' }}></i> Ajustes de Reproducción
            </h3>
            <i className={`fa-solid fa-chevron-${isSettingsExpanded ? 'up' : 'down'}`} style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
          </div>

          {isSettingsExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', animation: 'fadeIn 0.2s ease-out' }}>
              <div className="audio-switch-container">
                <div className="audio-switch-label">
                  <span>{audioEngine === 'device' ? '🌐 Voz Local' : '✨ Voz Neuronal (CarPlay)'}</span>
                </div>
                <label className="switch" title={audioEngine === 'device' ? 'Cambiar a Voz Neuronal' : 'Cambiar a Voz Local'}>
                  <input
                    type="checkbox"
                    checked={audioEngine === 'edge'}
                    onChange={e => handleEngineChange(e.target.checked ? 'edge' : 'device')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Voz de Lectura</label>
                {audioEngine === 'device' ? (
                  <select
                    className="player-select"
                    value={selectedVoiceName}
                    onChange={handleVoiceChange}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    {sortedVoices.map(voice => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang.split('-')[0].toUpperCase()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="player-select"
                    value={selectedEdgeVoice}
                    onChange={handleEdgeVoiceChange}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    {EDGE_VOICES.map(voice => (
                      <option key={voice.value} value={voice.value}>{voice.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {audioEngine === 'device' ? (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)', padding: '6px 8px', borderRadius: '4px', lineHeight: '1.3' }}>
                  ⚠️ El motor local se pausa al bloquear la pantalla. Usa el motor <strong>Neuronal</strong> para reproducción continua y CarPlay.
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: '#137333', background: 'rgba(52, 168, 83, 0.05)', padding: '6px 8px', borderRadius: '4px', lineHeight: '1.3', borderLeft: '2px solid #34a853' }}>
                  ✅ Reproducción de fondo activa. Compatible con CarPlay / Bluetooth.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Velocidad:</span>
                <div className="player-speed" onClick={toggleSpeed} style={{ cursor: 'pointer' }}>
                  {speechRate}x
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Reading Canvas */}
      <section className="reader-content">
        <header className="reader-header">
          <h1>{article.title}</h1>
          <div className="reader-author">
            Por <strong>{article.author}</strong>
            <span>•</span>
            <span>{new Date(article.addedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          {/* Quick play button in header for convenience */}
          <button
            className="btn btn-primary"
            onClick={handleLocalPlayPause}
            style={{ marginTop: '12px', fontSize: '13px', padding: '8px 16px' }}
          >
            {isThisArticlePlaying && isPlaying && !isPaused
              ? <><i className="fa-solid fa-pause" style={{ marginRight: '6px' }}></i>Pausar</>
              : <><i className="fa-solid fa-play" style={{ marginRight: '6px', marginLeft: '2px' }}></i>Reproducir</>}
          </button>
        </header>

        <article className="article-text">
          {article.paragraphs.map((paragraph, pIdx) => {
            const isActive = isThisArticlePlaying && activeIdx === pIdx;
            const isInactive = isThisArticlePlaying && activeIdx >= 0 && !isActive;
            const isHeader = paragraph.length < 80 && (paragraph.startsWith('###') || paragraph.startsWith('##') || paragraph.toUpperCase() === paragraph);
            const cleanParagraph = paragraph.replace(/^#+\s+/, '');

            if (isActive) {
              const tokens = parseTokens(cleanParagraph);
              return (
                <p
                  key={pIdx}
                  id={`p-${pIdx}`}
                  className={`readable-paragraph is-active ${isHeader ? 'header-paragraph' : ''}`}
                  onClick={() => handleLocalParagraphClick(pIdx)}
                  style={{ cursor: 'pointer' }}
                >
                  {tokens.map((token, tIdx) => {
                    const isWordActive =
                      token.isWord &&
                      charIdx >= token.startIndex &&
                      charIdx < token.endIndex;
                    return (
                      <span key={tIdx} className={isWordActive ? 'word-highlight' : ''}>
                        {token.text}
                      </span>
                    );
                  })}
                </p>
              );
            }

            return (
              <p
                key={pIdx}
                id={`p-${pIdx}`}
                className={`readable-paragraph ${isInactive ? 'is-inactive' : ''} ${isHeader ? 'header-paragraph' : ''}`}
                onClick={() => handleLocalParagraphClick(pIdx)}
                style={{ cursor: 'pointer' }}
              >
                {cleanParagraph}
              </p>
            );
          })}
        </article>
      </section>
    </main>
  );
}
