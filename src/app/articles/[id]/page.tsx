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

  // Audio / Speech State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [speechRate, setSpeechRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  
  // Edge TTS additions
  const [audioEngine, setAudioEngine] = useState<'device' | 'edge'>('device');
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState('es-ES-AlvaroNeural');
  
  // Autoplay flow control
  const [pendingAutoplay, setPendingAutoplay] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Initialize HTML5 Audio element for Edge TTS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audioRef.current = audio;
      
      return () => {
        audio.pause();
        audio.src = '';
      };
    }
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

    try {
      window.speechSynthesis.cancel();
    } catch (cancelErr) {
      console.warn('speechSynthesis.cancel error:', cancelErr);
    }

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
    
    // Config voice safely (Safari voice setting protection)
    try {
      const voice = voices.find((v) => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    } catch (voiceErr) {
      console.warn('Could not set speechSynthesis voice, falling back to system default:', voiceErr);
    }
    
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
    
    try {
      window.speechSynthesis.speak(utterance);
    } catch (speakErr) {
      console.error('speechSynthesis.speak error:', speakErr);
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const playEdgeParagraph = (index: number) => {
    if (!article || !audioRef.current) return;

    // Stop local speech
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    if (index < 0 || index >= article.paragraphs.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveParagraphIndex(-1);
      setCurrentCharIndex(-1);
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(-1); // No word-by-word highlights in Edge mode

    const text = article.paragraphs[index];
    const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${selectedEdgeVoice}`;
    
    audioRef.current.src = url;
    audioRef.current.playbackRate = speechRate;

    audioRef.current.onplay = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setupMediaSession();
    };

    audioRef.current.onpause = () => {
      setIsPaused(true);
    };

    audioRef.current.onended = () => {
      if (index + 1 < article.paragraphs.length) {
        playEdgeParagraph(index + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveParagraphIndex(-1);
        setCurrentCharIndex(-1);
      }
    };

    audioRef.current.onerror = (e) => {
      console.error('Audio element error:', e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    audioRef.current.play().catch(err => {
      console.error('Failed to play audio:', err);
      setIsPlaying(false);
      setIsPaused(false);
    });
  };

  const setupMediaSession = () => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !article) return;
    
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: article.title,
        artist: article.author,
        album: 'Audioblog',
        artwork: [
          { src: 'https://audioblog-omega.vercel.app/icon.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        handlePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        handlePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handleSkipBackward();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleSkipForward();
      });
    } catch (err) {
      console.warn('Error setting up MediaSession:', err);
    }
  };

  // Autoplay Trigger: Runs when both article and voices are loaded and autoplay is requested
  useEffect(() => {
    if (pendingAutoplay && article && (audioEngine === 'edge' || voices.length > 0)) {
      setPendingAutoplay(false);
      setIsPlaying(true);
      setIsPaused(false);
      
      // Delay slightly for engine initialization
      const timer = setTimeout(() => {
        if (audioEngine === 'edge') {
          playEdgeParagraph(0);
        } else {
          speakParagraph(0);
        }
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [pendingAutoplay, article, voices, audioEngine]);

  const handlePlayPause = () => {
    if (typeof window === 'undefined') return;

    if (isPlaying) {
      if (isPaused) {
        if (audioEngine === 'edge' && audioRef.current) {
          audioRef.current.play().catch(e => console.error(e));
        } else {
          window.speechSynthesis.resume();
        }
        setIsPaused(false);
      } else {
        if (audioEngine === 'edge' && audioRef.current) {
          audioRef.current.pause();
        } else {
          window.speechSynthesis.pause();
        }
        setIsPaused(true);
      }
    } else {
      setIsPlaying(true);
      setIsPaused(false);
      const startIndex = activeParagraphIndex >= 0 ? activeParagraphIndex : 0;
      if (audioEngine === 'edge') {
        playEdgeParagraph(startIndex);
      } else {
        speakParagraph(startIndex);
      }
    }
  };

  const handleStop = () => {
    if (typeof window === 'undefined') return;
    if (audioEngine === 'edge' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    } else {
      window.speechSynthesis.cancel();
    }
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
        if (audioEngine === 'edge') {
          playEdgeParagraph(nextIndex);
        } else {
          speakParagraph(nextIndex);
        }
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
        if (audioEngine === 'edge') {
          playEdgeParagraph(prevIndex);
        } else {
          speakParagraph(prevIndex);
        }
      } else {
        setActiveParagraphIndex(prevIndex);
        setCurrentCharIndex(0);
      }
    } else if (activeParagraphIndex === 0) {
      if (isPlaying) {
        if (audioEngine === 'edge') {
          playEdgeParagraph(0);
        } else {
          speakParagraph(0);
        }
      } else {
        setCurrentCharIndex(0);
      }
    }
  };

  const handleParagraphClick = (index: number) => {
    if (isPlaying) {
      if (audioEngine === 'edge') {
        playEdgeParagraph(index);
      } else {
        speakParagraph(index);
      }
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

  const handleEdgeVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceValue = e.target.value;
    setSelectedEdgeVoice(voiceValue);
    if (isPlaying && !isPaused) {
      playEdgeParagraph(activeParagraphIndex);
    }
  };

  const handleEngineChange = (engine: 'device' | 'edge') => {
    const wasPlaying = isPlaying;
    handleStop();
    setAudioEngine(engine);
    
    // Select a sensible Edge voice based on the article's text language
    if (engine === 'edge') {
      const isEnglish = article?.paragraphs.join(' ').toLowerCase().includes(' the ') || false;
      const defaultVoice = isEnglish ? 'en-US-AriaNeural' : 'es-ES-AlvaroNeural';
      setSelectedEdgeVoice(defaultVoice);
    }
    
    if (wasPlaying) {
      setTimeout(() => {
        setIsPlaying(true);
        setIsPaused(false);
        const startIndex = activeParagraphIndex >= 0 ? activeParagraphIndex : 0;
        if (engine === 'edge') {
          playEdgeParagraph(startIndex);
        } else {
          speakParagraph(startIndex);
        }
      }, 150);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const currentIndex = speeds.indexOf(speechRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeechRate(nextSpeed);
    
    if (audioEngine === 'edge') {
      if (audioRef.current) {
        audioRef.current.playbackRate = nextSpeed;
      }
    } else {
      if (isPlaying && !isPaused) {
        speakParagraph(activeParagraphIndex);
      }
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

        <div className="sidebar-card glass" style={{ marginTop: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-sliders" style={{ color: 'var(--color-primary)' }}></i> Ajustes de Reproducción
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Motor de Audio</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <button
                  className="btn-toggle"
                  onClick={() => handleEngineChange('device')}
                  style={{
                    border: 'none',
                    padding: '6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: audioEngine === 'device' ? 'var(--bg-card)' : 'transparent',
                    color: audioEngine === 'device' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: audioEngine === 'device' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  🌐 Local
                </button>
                <button
                  className="btn-toggle"
                  onClick={() => handleEngineChange('edge')}
                  style={{
                    border: 'none',
                    padding: '6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: audioEngine === 'edge' ? 'var(--bg-card)' : 'transparent',
                    color: audioEngine === 'edge' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: audioEngine === 'edge' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  ✨ Neuronal (Fondo)
                </button>
              </div>
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
                  {sortedVoices.map((voice) => (
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
                  {EDGE_VOICES.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {audioEngine === 'device' ? (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)', padding: '6px 8px', borderRadius: '4px', lineHeight: '1.3' }}>
                ⚠️ El motor local se pausa al bloquear la pantalla o abrir otra app. Usa el motor <strong>Neuronal</strong> para reproducción continua y CarPlay.
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: '#137333', background: 'rgba(52, 168, 83, 0.05)', padding: '6px 8px', borderRadius: '4px', lineHeight: '1.3', borderLeft: '2px solid #34a853' }}>
                ✅ Reproducción de fondo activa. Compatible con mandos de bloqueo y CarPlay / Bluetooth.
              </div>
            )}
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
              {audioEngine === 'device' ? (
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
              ) : (
                <select
                  className="player-select"
                  value={selectedEdgeVoice}
                  onChange={handleEdgeVoiceChange}
                  title="Seleccionar voz"
                >
                  {EDGE_VOICES.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              )}

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
