'use client';

import { useState, useEffect, useRef } from 'react';
import { Article } from '@/types';

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'url' | 'manual'>('url');
  
  // Scraper form state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('auto');
  const [translateTo, setTranslateTo] = useState('original');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  // Manual form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualCategory, setManualCategory] = useState('Tecnología');
  const [manualContent, setManualContent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  // --- Home Page Audio Player State ---
  const [playingArticle, setPlayingArticle] = useState<Article | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [speechRate, setSpeechRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load articles & initial configs
  useEffect(() => {
    fetchArticles();
    const savedView = localStorage.getItem('viewMode') as 'grid' | 'list' | null;
    if (savedView) {
      setViewMode(savedView);
    }
  }, []);

  // Load voices & clean up audio on unmount/navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
      if (allVoices.length > 0 && !selectedVoiceName) {
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
  }, [selectedVoiceName]);

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (err) {
      console.error('Error fetching articles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Audio Player Logic ---
  const speakParagraph = (index: number, targetArticle: Article) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();

    if (index < 0 || index >= targetArticle.paragraphs.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveParagraphIndex(-1);
      setCurrentCharIndex(-1);
      setPlayingArticle(null);
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(0);

    const text = targetArticle.paragraphs[index];
    const utterance = new SpeechSynthesisUtterance(text);

    const voice = voices.find((v) => v.name === selectedVoiceName);
    if (voice) utterance.voice = voice;
    utterance.rate = speechRate;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentCharIndex(event.charIndex);
      }
    };

    utterance.onend = () => {
      if (index + 1 < targetArticle.paragraphs.length) {
        speakParagraph(index + 1, targetArticle);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveParagraphIndex(-1);
        setCurrentCharIndex(-1);
        setPlayingArticle(null);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayPause = () => {
    if (typeof window === 'undefined' || !playingArticle) return;

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
      speakParagraph(startIndex, playingArticle);
    }
  };

  const handleStop = () => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveParagraphIndex(-1);
    setCurrentCharIndex(-1);
    setPlayingArticle(null);
  };

  const handleSkipForward = () => {
    if (!playingArticle) return;
    const nextIndex = activeParagraphIndex + 1;
    if (nextIndex < playingArticle.paragraphs.length) {
      speakParagraph(nextIndex, playingArticle);
    }
  };

  const handleSkipBackward = () => {
    if (!playingArticle) return;
    const prevIndex = activeParagraphIndex - 1;
    if (prevIndex >= 0) {
      speakParagraph(prevIndex, playingArticle);
    } else if (activeParagraphIndex === 0) {
      speakParagraph(0, playingArticle);
    }
  };

  const handlePlayDirectly = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();

    if (playingArticle?.id === article.id) {
      // Toggle play/pause for same article
      handlePlayPause();
    } else {
      // Start playing new article
      setPlayingArticle(article);
      setIsPlaying(true);
      setIsPaused(false);
      speakParagraph(0, article);
    }
  };

  // Change voice in real time
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceName = e.target.value;
    setSelectedVoiceName(voiceName);
    if (playingArticle && isPlaying && !isPaused) {
      speakParagraph(activeParagraphIndex, playingArticle);
    }
  };

  // Change rate in real time
  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const currentIndex = speeds.indexOf(speechRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeechRate(nextSpeed);
    
    if (playingArticle && isPlaying && !isPaused) {
      speakParagraph(activeParagraphIndex, playingArticle);
    }
  };

  const getRemainingTime = () => {
    if (!playingArticle) return 0;
    
    let remainingWordCount = 0;
    for (let i = activeParagraphIndex + 1; i < playingArticle.paragraphs.length; i++) {
      remainingWordCount += playingArticle.paragraphs[i].split(/\s+/).filter(Boolean).length;
    }
    
    if (activeParagraphIndex >= 0 && activeParagraphIndex < playingArticle.paragraphs.length) {
      const activeText = playingArticle.paragraphs[activeParagraphIndex];
      const remainingText = activeText.slice(currentCharIndex);
      remainingWordCount += remainingText.split(/\s+/).filter(Boolean).length;
    } else {
      remainingWordCount = playingArticle.paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    }
    
    const wpm = 160 * speechRate;
    return Math.round((remainingWordCount / wpm) * 60);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getProgressPercentage = () => {
    if (!playingArticle || activeParagraphIndex < 0) return 0;
    
    const totalLength = playingArticle.paragraphs.join('').length;
    let readLength = 0;
    
    for (let i = 0; i < activeParagraphIndex; i++) {
      readLength += playingArticle.paragraphs[i].length;
    }
    
    readLength += Math.max(0, currentCharIndex);
    return Math.min(100, (readLength / totalLength) * 100);
  };

  // --- Scraper / Import form submissions ---
  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl) return;

    setIsScraping(true);
    setScrapeError('');

    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, translateTo }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        throw new Error(scrapeData.error || 'Ocurrió un error al extraer el artículo.');
      }

      if (scrapeCategory !== 'auto') {
        scrapeData.category = scrapeCategory;
      }

      const saveRes = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapeData),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || 'No se pudo guardar el artículo.');
      }

      setArticles((prev) => [saveData, ...prev]);
      setIsModalOpen(false);
      setScrapeUrl('');
      setScrapeCategory('auto');
      setTranslateTo('original');
    } catch (err: any) {
      setScrapeError(err.message || 'Error al importar el artículo.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualContent) {
      setManualError('El título y el contenido son obligatorios.');
      return;
    }

    setIsSavingManual(true);
    setManualError('');

    try {
      const paragraphs = manualContent
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      if (paragraphs.length === 0) {
        throw new Error('El contenido debe tener al menos un párrafo.');
      }

      const newArticle = {
        title: manualTitle,
        author: manualAuthor || 'Redacción',
        category: manualCategory,
        paragraphs,
        url: 'manual',
      };

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el artículo.');
      }

      setArticles((prev) => [data, ...prev]);
      setIsModalOpen(false);
      setManualTitle('');
      setManualAuthor('');
      setManualCategory('Tecnología');
      setManualContent('');
    } catch (err: any) {
      setManualError(err.message || 'Error al guardar el artículo.');
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleDeleteArticle = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar "${title}" de tu historial?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        // If the deleted article is currently playing, stop it
        if (playingArticle?.id === id) {
          handleStop();
        }
        setArticles((prev) => prev.filter((a) => a.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar el artículo.');
      }
    } catch (err) {
      console.error('Error deleting article:', err);
      alert('Error de conexión al eliminar el artículo.');
    }
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  // Filter and search articles
  const filteredArticles = articles.filter((article) => {
    const matchesCategory = selectedCategory === 'Todos' || article.category === selectedCategory;
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Unique categories list
  const categories = ['Todos', ...Array.from(new Set(articles.map((a) => a.category)))];

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

  return (
    <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      <section className="hero">
        <h1>Escucha tus artículos favoritos</h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <i className="fa-solid fa-plus"></i> Importar artículo
        </button>
      </section>

      {/* Filters & View Toggles */}
      <section className="filter-bar">
        <div className="categories">
          {categories.map((category) => (
            <button
              key={category}
              className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="view-toggles">
            <button
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => toggleViewMode('grid')}
              title="Vista de cuadrícula"
            >
              <i className="fa-solid fa-grip"></i>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => toggleViewMode('list')}
              title="Vista de lista"
            >
              <i className="fa-solid fa-list"></i>
            </button>
          </div>
        </div>
      </section>

      {/* Grid or List View Content */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flex: 1 }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        </div>
      ) : filteredArticles.length > 0 ? (
        viewMode === 'grid' ? (
          <section className="articles-grid">
            {filteredArticles.map((article) => {
              const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
              return (
                <a href={`/articles/${article.id}?autoplay=true`} key={article.id} className="article-card">
                  {/* Delete Button */}
                  <button
                    className="trash-btn"
                    onClick={(e) => handleDeleteArticle(e, article.id, article.title)}
                    title="Eliminar artículo"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>

                  {/* Document Thumbnail with Play Overlay */}
                  <div className="card-thumbnail">
                    <div className="doc-sheet-preview">
                      <div className="doc-sheet-lines">
                        <div className="doc-sheet-line"></div>
                        <div className="doc-sheet-line"></div>
                        <div className="doc-sheet-line"></div>
                        <div className="doc-sheet-line"></div>
                        <div className="doc-sheet-line"></div>
                      </div>
                      <i className="fa-solid fa-file-audio doc-sheet-icon"></i>
                    </div>

                    {/* Direct Play Action */}
                    <button
                      className={`card-play-btn ${playingArticle?.id === article.id ? 'is-playing' : ''}`}
                      onClick={(e) => handlePlayDirectly(e, article)}
                      title={isCurrentPlaying ? 'Pausar' : 'Reproducir ahora'}
                    >
                      {isCurrentPlaying ? (
                        <i className="fa-solid fa-pause"></i>
                      ) : (
                        <i className="fa-solid fa-play"></i>
                      )}
                    </button>
                  </div>

                  {/* Card Info Details */}
                  <div className="card-details">
                    <h3 className="card-title" title={article.title}>{article.title}</h3>
                    <div className="card-meta-row">
                      <div className="card-meta-left">
                        <i className="fa-solid fa-user-circle"></i>
                        <span>{article.author}</span>
                      </div>
                      <span className="card-category-badge">{article.category}</span>
                    </div>
                    <div className="card-meta-row" style={{ marginTop: '2px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>
                        <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>
                        {formatTime(article.duration)} de audio
                      </span>
                      <span>{new Date(article.addedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </section>
        ) : (
          /* List View */
          <section className="articles-list-container">
            <div className="list-header">
              <span>Nombre</span>
              <span>Autor</span>
              <span>Categoría</span>
              <span>Duración</span>
              <span style={{ textAlign: 'right' }}>Acciones</span>
            </div>
            
            <div className="list-rows">
              {filteredArticles.map((article) => {
                const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
                return (
                  <a
                    href={`/articles/${article.id}?autoplay=true`}
                    key={article.id}
                    className="list-row-item"
                  >
                    <div className="list-col-name">
                      <i className="fa-solid fa-file-audio doc-icon"></i>
                      <span className="card-title" title={article.title}>{article.title}</span>
                    </div>
                    
                    <span className="list-col-author" title={article.author}>{article.author}</span>
                    
                    <div>
                      <span className="card-category-badge">{article.category}</span>
                    </div>
                    
                    <span className="list-col-duration">
                      <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>
                      {formatTime(article.duration)}
                    </span>
                    
                    <div className="list-col-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="list-action-btn listen"
                        onClick={(e) => handlePlayDirectly(e, article)}
                        title={isCurrentPlaying ? 'Pausar' : 'Escuchar ahora'}
                      >
                        {isCurrentPlaying ? (
                          <i className="fa-solid fa-pause"></i>
                        ) : (
                          <i className="fa-solid fa-play"></i>
                        )}
                      </button>
                      <button
                        className="list-action-btn delete"
                        onClick={(e) => handleDeleteArticle(e, article.id, article.title)}
                        title="Eliminar artículo"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🎙️</div>
          <h3>No se encontraron artículos</h3>
          <p>
            {searchQuery || selectedCategory !== 'Todos'
              ? 'Prueba modificando tus filtros de búsqueda.'
              : 'Empieza importando tu primer artículo de un blog o añádelo de forma manual.'}
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            Importar ahora
          </button>
        </div>
      )}

      {/* Floating Bottom Audio Player (only visible when playing an article on the home page) */}
      {playingArticle && (
        <div className="bottom-player-container" style={{ animation: 'slideUp 0.3s ease-out' }}>
          <div className="bottom-player glass">
            {/* Progress bar */}
            <div className="player-progress-container">
              <span className="player-time">
                {activeParagraphIndex >= 0 ? formatTime(Math.round(((playingArticle.duration - getRemainingTime()) / playingArticle.duration) * playingArticle.duration)) : '0:00'}
              </span>
              
              <div 
                className="player-slider-wrapper"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const pct = clickX / rect.width;
                  const targetIdx = Math.min(
                    playingArticle.paragraphs.length - 1,
                    Math.floor(pct * playingArticle.paragraphs.length)
                  );
                  speakParagraph(targetIdx, playingArticle);
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
                {formatTime(playingArticle.duration)}
              </span>
            </div>

            {/* Controls and settings */}
            <div className="player-main-controls">
              <div className="player-info">
                <div className="player-info-text">
                  <div className="player-info-title">{playingArticle.title}</div>
                  <div className="player-info-author">
                    Párrafo {activeParagraphIndex + 1} de {playingArticle.paragraphs.length} • Por {playingArticle.author}
                  </div>
                </div>
              </div>

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

                <button className="player-btn" onClick={handleStop} title="Detener" style={{ marginLeft: '8px' }}>
                  <i className="fa-solid fa-square" style={{ fontSize: '18px' }}></i>
                </button>
              </div>

              <div className="player-settings">
                {/* Visualizer animation */}
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
      )}

      {/* Import Modal */}
      {isModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              <h2>Añadir a la Biblioteca</h2>
              <button className="dialog-close" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="form-tabs">
              <div
                className={`form-tab ${modalTab === 'url' ? 'active' : ''}`}
                onClick={() => setModalTab('url')}
              >
                🔗 Importar por URL
              </div>
              <div
                className={`form-tab ${modalTab === 'manual' ? 'active' : ''}`}
                onClick={() => setModalTab('manual')}
              >
                ✍️ Crear Manualmente
              </div>
            </div>

            {modalTab === 'url' ? (
              <form onSubmit={handleScrapeSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="url-input">
                    Enlace del Artículo
                  </label>
                  <input
                    id="url-input"
                    type="url"
                    className="form-input"
                    placeholder="https://ejemplo.com/articulo-interesante"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    required
                    disabled={isScraping}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="category-select-scrape">
                      Categoría (Opcional)
                    </label>
                    <select
                      id="category-select-scrape"
                      className="form-input"
                      value={scrapeCategory}
                      onChange={(e) => setScrapeCategory(e.target.value)}
                      disabled={isScraping}
                    >
                      <option value="auto">✨ Asignar automáticamente</option>
                      <option value="Tecnología">Tecnología</option>
                      <option value="Diseño">Diseño</option>
                      <option value="Filosofía">Filosofía</option>
                      <option value="Negocios">Negocios</option>
                      <option value="Ciencia">Ciencia</option>
                      <option value="Literatura">Literatura</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="translate-select">
                      Traducir a (Opcional)
                    </label>
                    <select
                      id="translate-select"
                      className="form-input"
                      value={translateTo}
                      onChange={(e) => setTranslateTo(e.target.value)}
                      disabled={isScraping}
                    >
                      <option value="original">🌐 Mantener idioma original</option>
                      <option value="es">Español (Spanish)</option>
                      <option value="en">Inglés (English)</option>
                      <option value="pt">Portugués (Portuguese)</option>
                      <option value="fr">Francés (French)</option>
                      <option value="de">Alemán (German)</option>
                      <option value="it">Italiano (Italian)</option>
                    </select>
                  </div>
                </div>

                {scrapeError && (
                  <div style={{ color: 'var(--color-accent)', fontSize: '13px', marginBottom: '16px' }}>
                    ⚠️ {scrapeError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isScraping}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isScraping || !scrapeUrl}>
                    {isScraping ? (
                      <>
                        <div className="spinner" style={{ marginRight: '8px' }}></div>
                        Extrayendo y Traduciendo...
                      </>
                    ) : (
                      'Extraer y Guardar'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleManualSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="title-input">
                    Título del Artículo
                  </label>
                  <input
                    id="title-input"
                    type="text"
                    className="form-input"
                    placeholder="Título del artículo"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    required
                    disabled={isSavingManual}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="author-input">
                      Autor
                    </label>
                    <input
                      id="author-input"
                      type="text"
                      className="form-input"
                      placeholder="Nombre del autor"
                      value={manualAuthor}
                      onChange={(e) => setManualAuthor(e.target.value)}
                      disabled={isSavingManual}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="category-select">
                      Categoría
                    </label>
                    <select
                      id="category-select"
                      className="form-input"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      disabled={isSavingManual}
                    >
                      <option value="Tecnología">Tecnología</option>
                      <option value="Diseño">Diseño</option>
                      <option value="Filosofía">Filosofía</option>
                      <option value="Negocios">Negocios</option>
                      <option value="Ciencia">Ciencia</option>
                      <option value="Literatura">Literatura</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="content-textarea">
                    Contenido del Artículo
                  </label>
                  <textarea
                    id="content-textarea"
                    className="form-input"
                    rows={5}
                    placeholder="Escribe o pega el contenido aquí. Usa dos saltos de línea para separar párrafos."
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    required
                    disabled={isSavingManual}
                    style={{ resize: 'vertical', fontFamily: 'var(--font-serif)' }}
                  />
                </div>

                {manualError && (
                  <div style={{ color: 'var(--color-accent)', fontSize: '13px', marginBottom: '16px' }}>
                    ⚠️ {manualError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSavingManual}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingManual || !manualTitle || !manualContent}
                  >
                    {isSavingManual ? (
                      <>
                        <div className="spinner" style={{ marginRight: '8px' }}></div>
                        Guardando...
                      </>
                    ) : (
                      'Guardar Artículo'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
