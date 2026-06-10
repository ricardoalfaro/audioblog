'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Article } from '@/types';

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

  // Audio / Speech State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [speechRate, setSpeechRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  
  // Autoplay flow control
  const [pendingAutoplay, setPendingAutoplay] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

        // Check for autoplay query parameter
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get('autoplay') === 'true') {
            setPendingAutoplay(true);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar el artículo.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  // Load browser voices
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);

      // Select default voice (prioritize Spanish or English, or browser default)
      if (allVoices.length > 0) {
        const defaultVoice =
          allVoices.find((v) => v.default) ||
          allVoices.find((v) => v.lang.startsWith('es')) ||
          allVoices.find((v) => v.lang.startsWith('en')) ||
          allVoices[0];
        
        setSelectedVoiceName(defaultVoice.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
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

  const speakParagraph = (index: number) => {
    if (!article || typeof window === 'undefined') return;

    window.speechSynthesis.cancel();

    if (index < 0 || index >= article.paragraphs.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveParagraphIndex(-1);
      setCurrentCharIndex(-1);
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(0);

    const text = article.paragraphs[index];
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Config voice
    const voice = voices.find((v) => v.name === selectedVoiceName);
    if (voice) utterance.voice = voice;
    utterance.rate = speechRate;

    // Track word boundary
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentCharIndex(event.charIndex);
      }
    };

    // Track end of paragraph
    utterance.onend = () => {
      if (index + 1 < article.paragraphs.length) {
        speakParagraph(index + 1);
      } else {
        // Finished article
        setIsPlaying(false);
        setIsPaused(false);
        setActiveParagraphIndex(-1);
        setCurrentCharIndex(-1);
      }
    };

    utterance.onerror = (e) => {
      console.error('SpeechSynthesis error:', e);
      if (isPlaying) {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Autoplay Trigger: Runs when both article and voices are loaded and autoplay is requested
  useEffect(() => {
    if (pendingAutoplay && article && voices.length > 0) {
      setPendingAutoplay(false);
      setIsPlaying(true);
      setIsPaused(false);
      
      // Delay slightly for engine initialization
      const timer = setTimeout(() => {
        speakParagraph(0);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [pendingAutoplay, article, voices]);

  const handlePlayPause = () => {
    if (typeof window === 'undefined') return;

    if (isPlaying) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      setIsPlaying(true);
      setIsPaused(false);
      const startIndex = activeParagraphIndex >= 0 ? activeParagraphIndex : 0;
      speakParagraph(startIndex);
    }
  };

  const handleStop = () => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveParagraphIndex(-1);
    setCurrentCharIndex(-1);
  };

  const handleSkipForward = () => {
    if (!article) return;
    const nextIndex = activeParagraphIndex + 1;
    if (nextIndex < article.paragraphs.length) {
      if (isPlaying) {
        speakParagraph(nextIndex);
      } else {
        setActiveParagraphIndex(nextIndex);
        setCurrentCharIndex(0);
      }
    }
  };

  const handleSkipBackward = () => {
    const prevIndex = activeParagraphIndex - 1;
    if (prevIndex >= 0) {
      if (isPlaying) {
        speakParagraph(prevIndex);
      } else {
        setActiveParagraphIndex(prevIndex);
        setCurrentCharIndex(0);
      }
    } else if (activeParagraphIndex === 0) {
      if (isPlaying) {
        speakParagraph(0);
      } else {
        setCurrentCharIndex(0);
      }
    }
  };

  const handleParagraphClick = (index: number) => {
    if (isPlaying) {
      speakParagraph(index);
    } else {
      setActiveParagraphIndex(index);
      setCurrentCharIndex(0);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceName = e.target.value;
    setSelectedVoiceName(voiceName);
    if (isPlaying && !isPaused) {
      speakParagraph(activeParagraphIndex);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const currentIndex = speeds.indexOf(speechRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeechRate(nextSpeed);
    
    if (isPlaying && !isPaused) {
      speakParagraph(activeParagraphIndex);
    }
  };

  const getRemainingTime = () => {
    if (!article) return 0;
    
    let remainingWordCount = 0;
    for (let i = activeParagraphIndex + 1; i < article.paragraphs.length; i++) {
      remainingWordCount += article.paragraphs[i].split(/\s+/).filter(Boolean).length;
    }
    
    if (activeParagraphIndex >= 0 && activeParagraphIndex < article.paragraphs.length) {
      const activeText = article.paragraphs[activeParagraphIndex];
      const remainingText = activeText.slice(currentCharIndex);
      remainingWordCount += remainingText.split(/\s+/).filter(Boolean).length;
    } else {
      remainingWordCount = article.paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    }
    
    const wpm = 160 * speechRate;
    const minutes = remainingWordCount / wpm;
    return Math.round(minutes * 60);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getProgressPercentage = () => {
    if (!article || activeParagraphIndex < 0) return 0;
    
    const totalLength = article.paragraphs.join('').length;
    let readLength = 0;
    
    for (let i = 0; i < activeParagraphIndex; i++) {
      readLength += article.paragraphs[i].length;
    }
    
    readLength += Math.max(0, currentCharIndex);
    return Math.min(100, (readLength / totalLength) * 100);
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

  const remainingTime = getRemainingTime();

  return (
    <main className="container reader-layout">
      {/* Sidebar Controls */}
      <aside className="reader-sidebar">
        <a href="/" className="back-link">
          <i className="fa-solid fa-arrow-left"></i> Volver a la biblioteca
        </a>

        <div className="sidebar-card glass">
          <span className="sidebar-category">{article.category}</span>
          <h2 className="sidebar-title">{article.title}</h2>
          
          <div className="sidebar-meta">
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

      {/* Floating Bottom Audio Player */}
      <div className="bottom-player-container">
        <div className="bottom-player glass">
          {/* Progress bar */}
          <div className="player-progress-container">
            <span className="player-time">
              {activeParagraphIndex >= 0 ? formatTime(Math.round(((article.duration - remainingTime) / article.duration) * article.duration)) : '0:00'}
            </span>
            
            <div 
              className="player-slider-wrapper"
              onClick={(e) => {
                if (!article) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = clickX / rect.width;
                const targetIdx = Math.min(
                  article.paragraphs.length - 1,
                  Math.floor(pct * article.paragraphs.length)
                );
                handleParagraphClick(targetIdx);
              }}
            >
              <div 
                className="player-slider-fill" 
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
              <div 
                className="player-slider-thumb"
                style={{ left: `${getProgressPercentage()}%` }}
              ></div>
            </div>

            <span className="player-time">
              {formatTime(article.duration)}
            </span>
          </div>

          {/* Main Controls row */}
          <div className="player-main-controls">
            {/* Title / Author info */}
            <div className="player-info">
              <div className="player-info-text">
                <div className="player-info-title">{article.title}</div>
                <div className="player-info-author">{article.author}</div>
              </div>
            </div>

            {/* Play/Pause/Skip */}
            <div className="player-core">
              <button className="player-btn" onClick={handleSkipBackward} title="Párrafo anterior">
                <i className="fa-solid fa-backward-step" style={{ fontSize: '18px' }}></i>
              </button>
              
              <button 
                className="player-btn player-btn-play" 
                onClick={handlePlayPause}
                title={isPlaying && !isPaused ? 'Pausar' : 'Escuchar'}
              >
                {isPlaying && !isPaused ? (
                  <i className="fa-solid fa-pause" style={{ fontSize: '18px' }}></i>
                ) : (
                  <i className="fa-solid fa-play" style={{ fontSize: '18px', marginLeft: '2px' }}></i>
                )}
              </button>
              
              <button className="player-btn" onClick={handleSkipForward} title="Siguiente párrafo">
                <i className="fa-solid fa-forward-step" style={{ fontSize: '18px' }}></i>
              </button>

              <button className="player-btn" onClick={handleStop} title="Detener" style={{ marginLeft: '8px', opacity: activeParagraphIndex >= 0 ? 0.7 : 0.2 }}>
                <i className="fa-solid fa-square" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            {/* Visualizer & Speed & Voice Settings */}
            <div className="player-settings">
              {/* Animated visualizer */}
              <div className="player-visualizer">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`visualizer-bar ${isPlaying && !isPaused ? 'playing' : ''}`}
                  />
                ))}
              </div>

              {/* Voice select */}
              <select
                className="player-select"
                value={selectedVoiceName}
                onChange={handleVoiceChange}
                title="Seleccionar voz"
              >
                {sortedVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang.split('-')[0].toUpperCase()})
                  </option>
                ))}
              </select>

              {/* Speed toggle */}
              <div className="player-speed" onClick={toggleSpeed} title="Velocidad de reproducción">
                {speechRate}x
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
