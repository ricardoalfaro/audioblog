'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Article } from '@/types';
import { useAudioPlayer, EDGE_VOICES } from '@/contexts/AudioPlayerContext';
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

export default function ArticleReader() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const {
    playingArticle, activeParagraphIndex, currentCharIndex, audioEngine, selectedEdgeVoice, selectedVoiceName, voices, handleEngineChange, handleEdgeVoiceChange, handleVoiceChange, playArticle, handleParagraphClick,
    isPlaying, isPaused, handlePlayPause
  } = useAudioPlayer();

  // Tokens del párrafo activo — memoizado para no re-tokenizar en cada render
  const activeTokens = useMemo(() => {
    if (!article || activeParagraphIndex < 0) return [];
    const text = article.paragraphs[activeParagraphIndex];
    if (!text) return [];
    return parseTokens(text.replace(/^#+\s+/, ''));
  }, [article, activeParagraphIndex]);

  // Accordion state
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Reader accessibility state
  const [fontSize, setFontSize] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 768 ? 16 : 20));
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    if (!article || article.url === 'manual') return;
    const params = new URLSearchParams({ url: article.url, ogTitle: article.title });
    if (article.imageUrl) params.set('ogImage', article.imageUrl);
    const deepLink = `${window.location.origin}/app?${params.toString()}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url: deepLink });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(deepLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar el artículo.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

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

  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detectar scroll manual y pausar auto-scroll por 3 segundos
  useEffect(() => {
    const handleScroll = () => {
      userScrollingRef.current = true;
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
      userScrollTimerRef.current = setTimeout(() => {
        userScrollingRef.current = false;
      }, 3000);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    };
  }, []);

  // Auto-scroll al párrafo activo, salvo que el usuario esté scrolleando manualmente
  useEffect(() => {
    if (activeParagraphIndex >= 0 && !userScrollingRef.current) {
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
        <button className="btn btn-primary" onClick={() => router.push('/app')}>
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
    <>
      {/* Backdrop solo en mobile */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar fijo overlay, alineado a la izquierda del viewport */}
      <aside
        className={`reader-sidebar${isSidebarOpen ? ' is-open' : ''}`}
        style={{ top: headerHeight }}
      >
        <div className="sidebar-topbar">
          <span>Opciones</span>
        </div>
        <div className="sidebar-panel glass">

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
                      const index = articlesList.findIndex((a: { id: string }) => a.id === article.id);
                      if (index !== -1) { articlesList[index] = updated; localStorage.setItem('articles', JSON.stringify(articlesList)); }
                    } catch {}
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

      <main className="container" style={{ flex: 1 }}>
        {/* Fixed topbar — with toggle on the right */}
        <div className="reader-topbar" style={{ top: headerHeight }}>
          <div className="reader-topbar-inner">
            <Link href="/app" className="back-link">
              <i className="fa-solid fa-arrow-left"></i> Volver a la biblioteca
            </Link>
            <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(o => !o)} title="Opciones" aria-label="Opciones">
              <i className="fa-solid fa-sliders"></i><span className="cta-label"> Opciones</span>
            </button>
          </div>
        </div>

        <div className="reader-content">
          {/* Hero: imagen con overlay oscuro y título solapado abajo */}
          <div className="article-hero">
            {article.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.imageUrl} alt={article.title} className="article-hero-img" />
            ) : (
              <div className={`article-hero-img ${getGradientClass(article.id)}`} />
            )}
            <div className="article-hero-overlay" />
            <div className="article-hero-text">
              <h1 className="article-hero-title">{article.title}</h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                Por <strong style={{ color: '#fff' }}>{article.author}</strong>
                {' • '}
                {new Date(article.addedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Barra de controles de accesibilidad */}
          <div className="reader-controls-bar">
            <div className="reader-controls-left">
              <button className="reader-ctrl-btn" onClick={() => setFontSize(s => Math.max(14, s - 2))} title="Reducir texto">A−</button>
              <button className="reader-ctrl-btn" onClick={() => setFontSize(s => Math.min(28, s + 2))} title="Aumentar texto">A+</button>
              <div className="reader-font-toggle">
                <button
                  className={`reader-font-btn${fontFamily === 'sans' ? ' active' : ''}`}
                  onClick={() => setFontFamily('sans')}
                  style={{ fontFamily: 'var(--font-sans)' }}
                  title="Sin serifa"
                >Aa</button>
                <button
                  className={`reader-font-btn${fontFamily === 'serif' ? ' active' : ''}`}
                  onClick={() => setFontFamily('serif')}
                  style={{ fontFamily: 'var(--font-serif)' }}
                  title="Con serifa"
                >Aa</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {article.url !== 'manual' && (
                <button
                  onClick={handleShare}
                  title={shareCopied ? '¡Enlace copiado!' : 'Compartir artículo'}
                  aria-label={shareCopied ? '¡Enlace copiado!' : 'Compartir artículo'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: shareCopied ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: '15px', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                >
                  <i className={`fa-solid ${shareCopied ? 'fa-check' : 'fa-arrow-up-from-bracket'}`} /><span className="cta-label">{shareCopied ? ' Copiado' : ' Compartir'}</span>
                </button>
              )}
              <button
                className="btn btn-primary reader-play-cta"
                onClick={() => {
                  if (playingArticle?.id === article.id) {
                    handlePlayPause();
                  } else {
                    playArticle(article, 0);
                  }
                }}
              >
                {playingArticle?.id === article.id && isPlaying && !isPaused
                  ? <><i className="fa-solid fa-pause"></i><span className="cta-label"> Pausar</span></>
                  : <><i className="fa-solid fa-play"></i><span className="cta-label"> Escuchar</span></>
                }
              </button>
            </div>
          </div>

          {/* Texto del artículo */}
          <article
            className="article-text"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)',
            }}
          >
            {article.paragraphs.map((paragraph, pIdx) => {
              const isActive = activeParagraphIndex === pIdx;
              const isInactive = activeParagraphIndex >= 0 && !isActive;
              const isHeader = paragraph.length < 80 && (paragraph.startsWith('###') || paragraph.startsWith('##') || paragraph.toUpperCase() === paragraph);

              const cleanParagraph = paragraph.replace(/^#+\s+/, '');

              if (isActive) {
                return (
                  <p
                    key={pIdx}
                    id={`p-${pIdx}`}
                    className={`readable-paragraph is-active ${isHeader ? 'header-paragraph' : ''}`}
                    onClick={() => handleParagraphClick(pIdx)}
                    style={{ cursor: 'pointer' }}
                  >
                    {activeTokens.map((token, tIdx) => {
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
        </div>
      </main>
    </>
  );
}
