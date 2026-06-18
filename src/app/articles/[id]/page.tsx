'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Article } from '@/types';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import Footer from '@/components/Footer';
import { STATIC_CATEGORIES } from '@/lib/categories';

interface Token {
  text: string;
  isWord: boolean;
  startIndex: number;
  endIndex: number;
}

// Regex to capture words and whitespaces separately
function parseTokens(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\s+)|(\S+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const isWord = match[2] !== undefined;
    tokens.push({
      text: match[0],
      isWord,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return tokens;
}

const EDGE_VOICES = [
  { name: 'Alvaro (España, Neural)', value: 'es-ES-AlvaroNeural', lang: 'es-ES' },
  { name: 'Elvira (España, Neural)', value: 'es-ES-ElviraNeural', lang: 'es-ES' },
  { name: 'Dalia (México, Neural)', value: 'es-MX-DaliaNeural', lang: 'es-MX' },
  { name: 'Jorge (México, Neural)', value: 'es-MX-JorgeNeural', lang: 'es-MX' },
  { name: 'Aria (EE.UU., Neural)', value: 'en-US-AriaNeural', lang: 'en-US' },
  { name: 'Guy (EE.UU., Neural)', value: 'en-US-GuyNeural', lang: 'en-US' },
  { name: 'Francisca (Brasil, Neural)', value: 'pt-BR-FranciscaNeural', lang: 'pt-BR' },
  { name: 'Antonio (Brasil, Neural)', value: 'pt-BR-AntonioNeural', lang: 'pt-BR' },
  { name: 'Denise (Francia, Neural)', value: 'fr-FR-DeniseNeural', lang: 'fr-FR' },
  { name: 'Henri (Francia, Neural)', value: 'fr-FR-HenriNeural', lang: 'fr-FR' },
];

export default function ArticleReader() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Accordion state
  const {
    playingArticle, activeParagraphIndex, currentCharIndex, audioEngine, selectedEdgeVoice, selectedVoiceName, voices, handleEngineChange, handleEdgeVoiceChange, handleVoiceChange, playArticle, handleParagraphClick,
    isPlaying, isPaused, handlePlayPause
  } = useAudioPlayer();
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  // Load article
  useEffect(() => {
    if (!id) return;
    const fetchArticle = () => {
      try {
        setIsLoading(true);
        const localData = localStorage.getItem('articles');
        if (!localData) {
          throw new Error('No se encontró el historial de artículos.');
        }
        const articlesList: Article[] = JSON.parse(localData);
        const data = articlesList.find((a) => a.id === id);
        if (!data) {
          throw new Error('No se pudo encontrar el artículo.');
        }
        setArticle(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el artículo.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  // Collapse sidebar on mobile by default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 900;
      setIsSidebarOpen(!isMobile);
    }
  }, []);

  // Track header height so the fixed topbar always sits right below it
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    const header = document.querySelector('.main-header') as HTMLElement | null;
    if (!header) return;
    const update = () => setHeaderHeight(header.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);



  // Sync scroll on active paragraph change
  useEffect(() => {
    if (activeParagraphIndex >= 0) {
      const activeEl = document.getElementById(`p-${activeParagraphIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeParagraphIndex]);

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

  const sortedVoices = [...voices].sort((a, b) => {
    const aEs = a.lang.startsWith('es');
    const bEs = b.lang.startsWith('es');
    const aEn = a.lang.startsWith('en');
    const bEn = b.lang.startsWith('en');

    if (aEs && !bEs) return -1;
    if (!aEs && bEs) return 1;
    if (aEn && !bEn) return -1;
    if (!aEn && bEn) return 1;
    return a.name.localeCompare(b.name);
  });

  
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };


  const getGradientClass = (idStr: string) => {
    const sum = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `card-gradient-${(sum % 5) + 1}`;
  };

  return (
    <main className="container" style={{ paddingTop: 45 }}>
      {/* Fixed back-link bar — sits right below the sticky header at measured height */}
      <div className="reader-topbar" style={{ top: headerHeight }}>
        <div className="reader-topbar-inner">
          <Link href="/" className="back-link">
            <i className="fa-solid fa-arrow-left"></i> Volver a la biblioteca
          </Link>
        </div>
      </div>

      <div className="reader-layout">
        {/* Sidebar Controls */}
        <aside className="reader-sidebar">
          {/* Mobile toggle */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarOpen(o => !o)}
            aria-expanded={isSidebarOpen}
          >
            <i className={`fa-solid fa-sliders`}></i>
            <span>Opciones</span>
            <i className={`fa-solid fa-chevron-${isSidebarOpen ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: '11px' }}></i>
          </button>

          {/* Unified sidebar card */}
          <div className={`sidebar-panel glass${isSidebarOpen ? ' is-open' : ''}`}>

            {/* Section: Detalles */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" onClick={() => setIsMetaExpanded(v => !v)}>
                <span><i className="fa-solid fa-circle-info"></i> Detalles del Artículo</span>
                <i className={`fa-solid fa-chevron-${isMetaExpanded ? 'up' : 'down'}`}></i>
              </div>
              {isMetaExpanded && (
                <div className="sidebar-section-body">
                  {article.url && article.url !== 'manual' && (
                    <div className="meta-item">
                      <span className="meta-label">Fuente:</span>
                      <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>~ {formatTime(article.duration)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="sidebar-divider" />

            {/* Section: Ajustes */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" onClick={() => setIsSettingsExpanded(v => !v)}>
                <span><i className="fa-solid fa-sliders"></i> Ajustes de Reproducción</span>
                <i className={`fa-solid fa-chevron-${isSettingsExpanded ? 'up' : 'down'}`}></i>
              </div>
              {isSettingsExpanded && (
                <div className="sidebar-section-body">
                  <div className="audio-switch-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {audioEngine === 'device' ? 'Voz Browser' : 'Voz Natural'}
                    </span>
                    <label className="switch" title="Cambiar motor de voz">
                      <input type="checkbox" checked={audioEngine === 'edge'} onChange={(e) => handleEngineChange(e.target.checked ? 'edge' : 'device')} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Voz de Lectura</label>
                    {audioEngine === 'device' ? (
                      <select className="player-select" value={selectedVoiceName} onChange={handleVoiceChange} style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {sortedVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang.split('-')[0].toUpperCase()})</option>
                        ))}
                      </select>
                    ) : (
                      <select className="player-select" value={selectedEdgeVoice} onChange={handleEdgeVoiceChange} style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {EDGE_VOICES.map((voice) => (
                          <option key={voice.value} value={voice.value}>{voice.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {audioEngine === 'device' ? (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)', padding: '6px 8px', borderRadius: '4px', lineHeight: '1.3' }}>
                      ⚠️ El motor local se pausa al bloquear la pantalla. Usa <strong>Voz Natural</strong> para reproducción continua y CarPlay.
                    </div>
                  ) : (
                    <div style={{ fontSize: '10px', color: '#137333', background: 'rgba(52, 168, 83, 0.05)', padding: '6px 8px', borderRadius: '4px', lineHeight: '1.3', borderLeft: '2px solid #34a853' }}>
                      ✅ Reproducción de fondo activa. Compatible con CarPlay / Bluetooth.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sidebar-divider" />

            {/* Section: Categoría */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" style={{ cursor: 'default' }}>
                <span><i className="fa-solid fa-tag"></i> Categoría</span>
              </div>
              <div className="sidebar-section-body">
                <select
                  className="form-control"
                  value={article.category || ''}
                  onChange={(e) => {
                    const updated = { ...article, category: e.target.value };
                    setArticle(updated);
                    const localData = localStorage.getItem('articles');
                    if (localData) {
                      try {
                        const articlesList = JSON.parse(localData);
                        const index = articlesList.findIndex((a: any) => a.id === article.id);
                        if (index !== -1) { articlesList[index] = updated; localStorage.setItem('articles', JSON.stringify(articlesList)); }
                      } catch (e) {}
                    }
                  }}
                >
                  <option value="" disabled>Seleccione categoría...</option>
                  {STATIC_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

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
        </header>

        <div style={{ margin: '32px 0 40px 0', display: 'flex', justifyContent: 'flex-start' }}>
          <button 
            className="btn btn-primary" 
            style={{ borderRadius: '32px', padding: '12px 32px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 24px rgba(230, 57, 70, 0.3)' }}
            onClick={() => {
              if (playingArticle?.id === article.id && isPlaying && !isPaused) {
                handlePlayPause();
              } else if (playingArticle?.id === article.id && isPaused) {
                handlePlayPause();
              } else {
                playArticle(article, 0);
              }
            }}
          >
            {playingArticle?.id === article.id && isPlaying && !isPaused ? (
              <><i className="fa-solid fa-pause"></i> Pausar</>
            ) : (
              <><i className="fa-solid fa-play"></i> Reproducir</>
            )}
          </button>
        </div>

        <article className="article-text">
          {article.paragraphs.map((paragraph, pIdx) => {
            const isActive = activeParagraphIndex === pIdx;
            const isInactive = activeParagraphIndex >= 0 && !isActive;
            const isHeader = paragraph.length < 80 && (paragraph.startsWith('###') || paragraph.startsWith('##') || paragraph.toUpperCase() === paragraph);
            
            const cleanParagraph = paragraph.replace(/^#+\s+/, '');

            if (isActive) {
              const tokens = parseTokens(cleanParagraph);
              
              return (
                <p
                  key={pIdx}
                  id={`p-${pIdx}`}
                  className={`readable-paragraph is-active ${isHeader ? 'header-paragraph' : ''}`}
                  onClick={() => handleParagraphClick(pIdx)}
                  style={{ cursor: 'pointer' }}
                >
                  {tokens.map((token, tIdx) => {
                    const isWordActive =
                      token.isWord &&
                      currentCharIndex >= token.startIndex &&
                      currentCharIndex < token.endIndex;

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
                onClick={() => handleParagraphClick(pIdx)}
                style={{ cursor: 'pointer' }}
              >
                {cleanParagraph}
              </p>
            );
          })}
        </article>
      </section>
      </div>
      <Footer />
    </main>
  );
}
