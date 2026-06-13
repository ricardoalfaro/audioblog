'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Article } from '@/types';
import { defaultArticles } from '@/data/defaultArticles';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

const STATIC_CATEGORIES = ['General', 'Tecnología', 'Diseño', 'Negocios', 'Pagos', 'Seguros', 'Fintech', 'Política', 'Historia', 'Economía', 'Noticias'];

const EDGE_VOICES = [
  { name: 'Alvaro (España, Neural)', value: 'es-ES-AlvaroNeural', lang: 'es-ES' },
  { name: 'Elvira (España, Neural)', value: 'es-ES-ElviraNeural', lang: 'es-ES' },
  { name: 'Dalia (México, Neural)', value: 'es-MX-DaliaNeural', lang: 'es-MX' },
  { name: 'Jorge (México, Neural)', value: 'es-MX-JorgeNeural', lang: 'es-MX' },
  { name: 'Aria (EE.UU., Neural)', value: 'en-US-AriaNeural', lang: 'en-US' },
  { name: 'Guy (EE.UU., Neural)', value: 'en-US-GuyNeural', lang: 'en-US' },
];

function HomeContent() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
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

  const { playArticle, playingArticle, handleStop, isPlaying, isPaused, handlePlayPause } = useAudioPlayer();

  const handlePlayDirectly = (e: React.MouseEvent, targetArticle: Article) => {
    e.preventDefault();
    if (playingArticle?.id === targetArticle.id) {
      handlePlayPause();
    } else {
      playArticle(targetArticle, targetArticle.progress || 0);
    }
  };

  // Manual form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualCategory, setManualCategory] = useState('Tecnología');
  const [manualContent, setManualContent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const fetchArticles = () => {
    try {
      setIsLoading(true);
      const localData = localStorage.getItem('articles');
      if (localData) {
        const parsed = JSON.parse(localData);
        const pruned = pruneArticles(parsed);
        if (parsed.length !== pruned.length) {
          localStorage.setItem('articles', JSON.stringify(pruned));
        }
        setArticles(pruned);
      } else {
        localStorage.setItem('articles', JSON.stringify(defaultArticles));
        setArticles(defaultArticles);
      }
    } catch (err) {
      console.error('Error loading articles from localStorage:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
    const savedView = localStorage.getItem('viewMode') as 'grid' | 'list' | null;
    if (savedView) {
      setViewMode(savedView);
    }
  }, []);

  useEffect(() => {
    // When playingArticle changes (a new article starts playing), refresh the local storage list
    // so it immediately appears in "Estas escuchando".
    if (playingArticle?.id) {
      fetchArticles();
    }
  }, [playingArticle?.id]);

  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY > 0) {
        currentY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = () => {
      if (startY > 0 && currentY > startY + 120 && window.scrollY === 0) {
        window.location.reload();
      }
      startY = 0;
      currentY = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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

      if (!scrapeRes.ok) {
        let errorMsg = 'Ocurrió un error al extraer el artículo.';
        try {
          const errData = await scrapeRes.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = `Error del servidor (${scrapeRes.status}): ${scrapeRes.statusText || 'Respuesta no válida'}`;
        }
        throw new Error(errorMsg);
      }

      const scrapeData = await scrapeRes.json();

      if (scrapeCategory !== 'auto') {
        scrapeData.category = scrapeCategory;
      }

      const wordCount = scrapeData.paragraphs?.join(' ').split(/\s+/).filter(Boolean).length || 0;
      const durationSeconds = Math.max(30, Math.round((wordCount / 160) * 60));

      const newArticle: Article = {
        id: Date.now().toString(),
        title: scrapeData.title || 'Artículo sin título',
        author: scrapeData.author || 'Desconocido',
        url: scrapeData.url || 'manual',
        addedAt: new Date().toISOString(),
        category: scrapeData.category || 'General',
        excerpt: scrapeData.excerpt || (scrapeData.paragraphs?.[0] ? scrapeData.paragraphs[0].slice(0, 160) + '...' : ''),
        duration: durationSeconds,
        paragraphs: scrapeData.paragraphs || [],
        imageUrl: scrapeData.imageUrl || undefined,
        progress: 0,
      };

      const urlExists = articles.some(a => a.url !== 'manual' && a.url.toLowerCase() === newArticle.url.toLowerCase());
      if (urlExists) {
        throw new Error('Este artículo ya ha sido importado.');
      }

      const updatedArticles = pruneArticles([newArticle, ...articles]);
      setArticles(updatedArticles);
      localStorage.setItem('articles', JSON.stringify(updatedArticles));

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
      const paragraphs = manualContent.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

      if (paragraphs.length === 0) {
        throw new Error('El contenido debe tener al menos un párrafo.');
      }

      const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length || 0;
      const durationSeconds = Math.max(30, Math.round((wordCount / 160) * 60));

      const newArticle: Article = {
        id: Date.now().toString(),
        title: manualTitle,
        author: manualAuthor || 'Redacción',
        url: 'manual',
        addedAt: new Date().toISOString(),
        category: manualCategory,
        excerpt: manualContent.slice(0, 160) + '...',
        duration: durationSeconds,
        paragraphs,
        progress: 0,
      };

      const updatedArticles = pruneArticles([newArticle, ...articles]);
      setArticles(updatedArticles);
      localStorage.setItem('articles', JSON.stringify(updatedArticles));

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

  const handleDeleteArticle = (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar "${title}" de tu historial?`);
    if (!confirmDelete) return;

    if (playingArticle?.id === id) {
      handleStop();
    }

    const updatedArticles = articles.filter((a) => a.id !== id);
    setArticles(updatedArticles);
    localStorage.setItem('articles', JSON.stringify(updatedArticles));
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  const filteredArticles = articles.filter((article) => {
    const matchesCategory = selectedCategory === 'Todos' || article.category === selectedCategory;
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const hasImportedArticles = articles.some(a => !defaultArticles.find(da => da.id === a.id));

  const categories = ['Todos', ...Array.from(new Set(articles.map((a) => a.category)))];

  const listeningArticles = filteredArticles.filter(a => a.progress && a.progress > 0 && a.progress < a.paragraphs.length);
  const newArticles = filteredArticles.filter(a => !a.progress || a.progress === 0);

  const getGradientClass = (id: string) => {
    const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `card-gradient-${(sum % 5) + 1}`;
  };

  const renderArticleCard = (article: Article, shapeClass: string) => {
    const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
    
    if (viewMode === 'list') {
      return (
        <div key={article.id} className="article-list-item" onClick={() => router.push(`/articles/${article.id}`)}>
          <div className={`list-img-wrapper ${!article.imageUrl ? getGradientClass(article.id) : ''}`}>
            {article.imageUrl && <img src={article.imageUrl} alt={article.title} />}
          </div>
          <div className="list-item-content">
            <h3 className="list-item-title">{article.title}</h3>
            <div className="list-item-meta">{article.author} • {formatTime(article.duration)}</div>
          </div>
          <button
            className={`card-play-btn ${playingArticle?.id === article.id ? 'is-playing' : ''}`}
            onClick={(e) => { e.stopPropagation(); handlePlayDirectly(e, article); }}
            style={{ width: '32px', height: '32px', fontSize: '14px', flexShrink: 0 }}
          >
            {isCurrentPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}
          </button>
          <button
            className="trash-btn"
            style={{ position: 'relative', top: '0', right: '0', opacity: 1, marginLeft: '8px' }}
            onClick={(e) => { e.stopPropagation(); handleDeleteArticle(e, article.id, article.title); }}
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
        </div>
      );
    }

    return (
      <div key={article.id} className={`article-card ${shapeClass}`} onClick={() => router.push(`/articles/${article.id}`)}>
        <button
          className="trash-btn"
          onClick={(e) => { e.stopPropagation(); handleDeleteArticle(e, article.id, article.title); }}
          title="Eliminar artículo"
        >
          <i className="fa-solid fa-trash-can"></i>
        </button>
        <div className="card-image-wrapper">
          {article.imageUrl ? (
            <img src={article.imageUrl} alt={article.title} className="card-image" />
          ) : (
            <div className={`card-image ${getGradientClass(article.id)}`}></div>
          )}
          <div className="card-gradient-overlay"></div>
        </div>
        <div className="card-content">
          <div className="card-title-wrapper">
            <h3 className="card-title" title={article.title}>{article.title}</h3>
          </div>
          <div className="card-footer">
            <div className="card-meta">
              <span>{article.author}</span>
            </div>
            <button
              className={`card-play-btn ${playingArticle?.id === article.id ? 'is-playing' : ''}`}
              onClick={(e) => { e.stopPropagation(); handlePlayDirectly(e, article); }}
              title={isCurrentPlaying ? 'Pausar' : 'Reproducir ahora'}
            >
              {isCurrentPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <section className="hero hero-section">
        <div className="hero-content-wrapper">
          <h1 className="hero-title">Convierte tus lecturas en mini podcasts</h1>
          <p className="hero-subtitle">
            Importa cualquier artículo, newsletter o blog y escúchalo en cualquier lugar usando IA neural avanzada con voces ultrarrealistas.
          </p>
          <button className="btn btn-hero" onClick={() => setIsModalOpen(true)}>
            <i className="fa-solid fa-plus"></i> {hasImportedArticles ? 'Importar un nuevo artículo' : 'Importar mi primer artículo'}
          </button>
        </div>
        <div className="hero-bg-circle-1"></div>
        <div className="hero-bg-circle-2"></div>
      </section>

      <section className="tabs-container">
        <div className="categories-scroll">
          {categories.map((category) => (
            <button
              key={category}
              className={`tab-item ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="view-toggles">
          <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => toggleViewMode('grid')}>
            <i className="fa-solid fa-grip"></i>
          </button>
          <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => toggleViewMode('list')}>
            <i className="fa-solid fa-list"></i>
          </button>
        </div>
      </section>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flex: 1 }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        </div>
      ) : (
        <>
          {listeningArticles.length > 0 && (
            <section>
              <h2 className="section-title"><i className="fa-solid fa-volume-high" style={{marginRight: '8px'}}></i> Estás escuchando</h2>
              <div className={viewMode === 'grid' ? 'listening-carousel' : 'articles-list'}>
                {listeningArticles.map(article => renderArticleCard(article, 'card-vertical'))}
              </div>
            </section>
          )}

          {newArticles.length > 0 && (
            <section>
              <h2 className="section-title">Sin leer</h2>
              <div className={viewMode === 'grid' ? 'grid-new' : 'articles-list'}>
                {newArticles.map(article => renderArticleCard(article, 'card-square'))}
              </div>
            </section>
          )}

          {filteredArticles.length === 0 && (
            <div className="empty-state">
              <h3>No hay artículos que mostrar</h3>
              <p>Intenta importar uno nuevo o cambiar tu búsqueda.</p>
            </div>
          )}
        </>
      )}


      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 600 }}>Añadir a la biblioteca</h2>
            
            <div className="modal-tabs" style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button 
                className={`tab-btn ${modalTab === 'url' ? 'active' : ''}`}
                onClick={() => setModalTab('url')}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: modalTab === 'url' ? 600 : 400, color: modalTab === 'url' ? 'var(--primary-color)' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Por URL
              </button>
              <button 
                className={`tab-btn ${modalTab === 'manual' ? 'active' : ''}`}
                onClick={() => setModalTab('manual')}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: modalTab === 'manual' ? 600 : 400, color: modalTab === 'manual' ? 'var(--primary-color)' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Manual
              </button>
            </div>

            {modalTab === 'url' && (
              <form onSubmit={handleScrapeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">URL del artículo</label>
                  <input type="url" className="form-control" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://..." required />
                </div>
                <div>
                  <label className="form-label">Categoría</label>
                  <select className="form-control" value={scrapeCategory} onChange={e => setScrapeCategory(e.target.value)}>
                    <option value="auto">Automática (IA)</option>
                    {STATIC_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Traducir a (opcional)</label>
                  <select className="form-control" value={translateTo} onChange={e => setTranslateTo(e.target.value)}>
                    <option value="none">No traducir (idioma original)</option>
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                  </select>
                </div>
                {scrapeError && <p style={{ color: 'var(--primary-color)', fontSize: '14px' }}>{scrapeError}</p>}
                <button type="submit" className="btn btn-primary" disabled={isScraping} style={{ width: '100%', justifyContent: 'center' }}>
                  {isScraping ? 'Procesando...' : 'Importar'}
                </button>
              </form>
            )}

            {modalTab === 'manual' && (
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Título</label>
                  <input type="text" className="form-control" value={manualTitle} onChange={e => setManualTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Autor</label>
                  <input type="text" className="form-control" value={manualAuthor} onChange={e => setManualAuthor(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Categoría</label>
                  <select className="form-control" value={manualCategory} onChange={e => setManualCategory(e.target.value)}>
                    {STATIC_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Contenido (párrafos separados por salto de línea)</label>
                  <textarea className="form-control" value={manualContent} onChange={e => setManualContent(e.target.value)} rows={5} required />
                </div>
                {manualError && <p style={{ color: 'var(--primary-color)', fontSize: '14px' }}>{manualError}</p>}
                <button type="submit" className="btn btn-primary" disabled={isSavingManual} style={{ width: '100%', justifyContent: 'center' }}>
                  {isSavingManual ? 'Guardando...' : 'Guardar Artículo'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    
      <footer className="main-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '40px 0 120px 0', marginTop: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>
          Un proyecto de Ricardo Alfaro co-creado con IA - <a href="https://github.com/ricardoalfaro/audioblog" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Github</a>
        </p>
      </footer>
    </main>

  );
}


export const pruneArticles = (loadedArticles: Article[]): Article[] => {
  const defaultIds = new Set(defaultArticles.map((a: Article) => a.id));
  const customArticles = loadedArticles.filter((a: Article) => !defaultIds.has(a.id));
  const activeDefaultArticles = loadedArticles.filter((a: Article) => defaultIds.has(a.id));

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  let prunedCustom = customArticles.filter((a: Article) => {
    if (!a.addedAt) return true;
    const addedTime = new Date(a.addedAt).getTime();
    return (now - addedTime) < thirtyDaysMs;
  });

  const MAX_CUSTOM_ARTICLES = 50;
  if (prunedCustom.length > MAX_CUSTOM_ARTICLES) {
    prunedCustom.sort((a: Article, b: Article) => {
      const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return timeB - timeA;
    });
    prunedCustom = prunedCustom.slice(0, MAX_CUSTOM_ARTICLES);
  }

  return [...prunedCustom, ...activeDefaultArticles];
};

export default function Home() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" style={{ width: '40px', height: '40px' }}></div></div>}>
      <HomeContent />
    </Suspense>
  );
}
