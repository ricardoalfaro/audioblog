'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Article } from '@/types';
import { STATIC_CATEGORIES, detectCategory } from '@/lib/categories';
import { defaultArticles } from '@/data/defaultArticles';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import SplashScreen from '@/components/SplashScreen';
import Footer from '@/components/Footer';


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
  
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'url' | 'manual'>('url');
  
  // Scraper form state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('auto');
  const [translateTo, setTranslateTo] = useState('none');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [scrapeStep, setScrapeStep] = useState<0|1|2|3>(0);
  const [importSuccess, setImportSuccess] = useState(false);

  const { playArticle, playingArticle, handleStop, isPlaying, isPaused, handlePlayPause, activeParagraphIndex } = useAudioPlayer();

  // Listen for import trigger from header dropdown
  useEffect(() => {
    const handler = () => setIsModalOpen(true);
    window.addEventListener('audiodocs:open-import', handler);
    return () => window.removeEventListener('audiodocs:open-import', handler);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen && !isScraping) setIsModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isScraping]);

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
  const [manualContent, setManualContent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const fetchArticles = () => {
    try {
      setIsLoading(true);
      const localData = localStorage.getItem('articles');
      if (localData) {
        setArticles(JSON.parse(localData));
      } else {
        setArticles([]);
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

  // Re-read articles when the player advances paragraphs or stops,
  // so Escuchando / Archivo sections reflect real-time progress
  useEffect(() => {
    if (playingArticle) fetchArticles();
  }, [activeParagraphIndex, isPlaying]);

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
    setScrapeStep(1);

    const stepTimer = setTimeout(() => setScrapeStep(2), 2500);

    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, translateTo }),
      });

      clearTimeout(stepTimer);

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

      setScrapeStep(3);
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

      const existingArticle = articles.find(a => a.url !== 'manual' && a.url.toLowerCase() === newArticle.url.toLowerCase());
      if (existingArticle) {
        const isArchived = existingArticle.progress !== undefined && existingArticle.paragraphs?.length && existingArticle.progress >= existingArticle.paragraphs.length;
        if (isArchived) {
          setIsScraping(false);
          setScrapeStep(0);
          setIsModalOpen(false);
          setScrapeUrl('');
          setScrapeCategory('auto');
          setTranslateTo('none');
          sessionStorage.setItem('archive_toast', 'Este artículo ya lo tienes en el archivo.');
          router.push('/app/archive');
          return;
        }
        throw new Error('Este artículo ya ha sido importado.');
      }

      const updatedArticles = pruneArticles([newArticle, ...articles]);
      setArticles(updatedArticles);
      localStorage.setItem('articles', JSON.stringify(updatedArticles));

      setIsScraping(false);
      setScrapeStep(0);
      setImportSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setImportSuccess(false);
        setScrapeUrl('');
        setScrapeCategory('auto');
        setTranslateTo('none');
      }, 1600);
    } catch (err: any) {
      clearTimeout(stepTimer);
      setScrapeStep(0);
      setScrapeError(err.message || 'Error al importar el artículo.');
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
        author: 'Manual',
        url: 'manual',
        addedAt: new Date().toISOString(),
        category: detectCategory(manualTitle + ' ' + manualContent),
        excerpt: manualContent.slice(0, 160) + '...',
        duration: durationSeconds,
        paragraphs,
        imageUrl: undefined,
        progress: 0,
      };

      const updatedArticles = pruneArticles([newArticle, ...articles]);
      setArticles(updatedArticles);
      localStorage.setItem('articles', JSON.stringify(updatedArticles));

      setIsSavingManual(false);
      setImportSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setImportSuccess(false);
        setManualTitle('');
        setManualContent('');
      }, 1600);
    } catch (err: any) {
      setManualError(err.message || 'Error al guardar el artículo.');
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
    return selectedCategory === 'Todos' || article.category === selectedCategory;
  });

  const activeArticles = articles.filter(a => !a.paragraphs?.length || (a.progress ?? 0) < a.paragraphs.length);
  const filteredActiveArticles = activeArticles.filter(a => selectedCategory === 'Todos' || a.category === selectedCategory);
  const categories = ['Todos', ...Array.from(new Set(activeArticles.map((a) => a.category).filter(Boolean)))];

  const listeningArticles = filteredArticles
    .filter(a => a.lastPlayedAt && (!a.progress || a.progress < a.paragraphs.length))
    .sort((a, b) => (b.lastPlayedAt || '') > (a.lastPlayedAt || '') ? 1 : -1);
  const newArticles = filteredArticles.filter(a => !a.lastPlayedAt);

  const getGradientClass = (id: string) => {
    const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `card-gradient-${(sum % 5) + 1}`;
  };

  const renderArticleCard = (article: Article, shapeClass: string) => {
    const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
    
    if (viewMode === 'list') {
      return (
        <div key={article.id} className="article-list-item" onClick={() => router.push(`/app/articles/${article.id}`)}>
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
      <div key={article.id} className={`article-card ${shapeClass}`} onClick={() => router.push(`/app/articles/${article.id}`)}>
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
          <div className="card-title-wrapper">
            <h3 className="card-title" title={article.title}>{article.title}</h3>
          </div>
        </div>
        {article.lastPlayedAt && article.paragraphs.length > 0 && (
          <div className="card-progress-bar">
            <div
              className="card-progress-fill"
              style={{ width: `${Math.min(100, ((article.progress || 0) / article.paragraphs.length) * 100)}%` }}
            />
          </div>
        )}
        <div className="card-content">
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
    <>
    <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

      {(activeArticles.length > 0 || isLoading) && <section className="tabs-container">
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
          <button
            className="view-btn active"
            onClick={() => toggleViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title={viewMode === 'grid' ? 'Vista en cuadrícula' : 'Vista en lista'}
          >
            <i className={`fa-solid ${viewMode === 'grid' ? 'fa-grip' : 'fa-list'}`}></i>
          </button>
        </div>
      </section>}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flex: 1 }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        </div>
      ) : (
        <>
          {listeningArticles.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}><i className="fa-solid fa-headphones" style={{marginRight: '2px', fontSize: '20px'}}></i> Estás escuchando</h2>
                <button className="import-inline-btn" onClick={() => setIsModalOpen(true)} title="Importar un nuevo artículo">
                  <i className="fa-solid fa-file-import"></i> Importar documento
                </button>
              </div>
              <div className={viewMode === 'grid' ? 'listening-carousel' : 'articles-list'}>
                {listeningArticles.map(article => renderArticleCard(article, 'card-vertical'))}
              </div>
            </section>
          )}

          {filteredActiveArticles.length > 0 && (
            <section style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  <i className="fa-solid fa-inbox" style={{ marginRight: '2px', fontSize: '20px' }}></i> Nuevos importados
                </h2>
                {listeningArticles.length === 0 && (
                  <button className="import-inline-btn" onClick={() => setIsModalOpen(true)} title="Importar un nuevo artículo">
                    <i className="fa-solid fa-file-import"></i> Importar documento
                  </button>
                )}
              </div>
              <div className={viewMode === 'grid' ? 'grid-new' : 'articles-list'}>
                {newArticles.map(article => renderArticleCard(article, 'card-vertical'))}
              </div>
            </section>
          )}

          {filteredActiveArticles.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                {activeArticles.length === 0 ? (
                  <>
                    <h3>Tu biblioteca está vacía</h3>
                    <p>Importa tu primer artículo para empezar a escuchar.</p>
                    <button className="btn btn-primary" style={{ marginTop: '24px', gap: '8px' }} onClick={() => setIsModalOpen(true)}>
                      <i className="fa-solid fa-file-import"></i> Importar documento
                    </button>
                  </>
                ) : (
                  <>
                    <h3>No hay artículos en esta categoría</h3>
                    <p>Prueba seleccionando otra categoría.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}


      {isModalOpen && (
        <div className="modal-overlay" onClick={() => { if (!isScraping && !isSavingManual) setIsModalOpen(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={isScraping || isSavingManual} aria-label="Cerrar">
              <i className="fa-solid fa-xmark" />
            </button>

            {importSuccess ? (
              <div className="import-success">
                <i className="fa-solid fa-circle-check success-icon" />
                <p>¡Artículo guardado!</p>
                <span>Ya está disponible en tu biblioteca</span>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h2>{modalTab === 'url' ? 'Importar artículo' : 'Crear artículo'}</h2>
                </div>

                <div className="modal-tabs">
                  <button className={`modal-tab-btn ${modalTab === 'url' ? 'active' : ''}`} onClick={() => setModalTab('url')}>
                    Por URL
                  </button>
                  <button className={`modal-tab-btn ${modalTab === 'manual' ? 'active' : ''}`} onClick={() => setModalTab('manual')}>
                    Manual
                  </button>
                </div>

                {modalTab === 'url' && (
                  isScraping ? (
                    <div className="import-loading">
                      <div className="import-steps">
                        <div className={`import-step ${scrapeStep >= 1 ? 'active' : ''} ${scrapeStep > 1 ? 'done' : ''}`}>
                          <span className="step-icon">
                            {scrapeStep > 1 ? <i className="fa-solid fa-check" /> : scrapeStep === 1 ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-circle" />}
                          </span>
                          Leyendo página
                        </div>
                        <div className={`import-step ${scrapeStep >= 2 ? 'active' : ''} ${scrapeStep > 2 ? 'done' : ''}`}>
                          <span className="step-icon">
                            {scrapeStep > 2 ? <i className="fa-solid fa-check" /> : scrapeStep === 2 ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-circle" />}
                          </span>
                          Extrayendo texto
                        </div>
                        <div className={`import-step ${scrapeStep >= 3 ? 'active' : ''}`}>
                          <span className="step-icon">
                            {scrapeStep === 3 ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-circle" />}
                          </span>
                          Guardando
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleScrapeSubmit} className="modal-form">
                      <div>
                        <label className="form-label">URL del artículo</label>
                        <input type="url" className="form-control" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://..." required autoFocus />
                      </div>
                      <div>
                        <label className="form-label">Categoría</label>
                        <select className="form-control" value={scrapeCategory} onChange={e => setScrapeCategory(e.target.value)}>
                          <option value="auto">Automática (IA)</option>
                          {STATIC_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Traducir a <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                        <select className="form-control" value={translateTo} onChange={e => setTranslateTo(e.target.value)}>
                          <option value="none">No traducir — idioma original</option>
                          <option value="es">Español</option>
                          <option value="en">Inglés</option>
                        </select>
                      </div>
                      {scrapeError && <p className="modal-error">{scrapeError}</p>}
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        <i className="fa-solid fa-file-import" /> Importar
                      </button>
                    </form>
                  )
                )}

                {modalTab === 'manual' && (
                  <form onSubmit={handleManualSubmit} className="modal-form">
                    <div>
                      <label className="form-label">Título</label>
                      <input type="text" className="form-control" value={manualTitle} onChange={e => setManualTitle(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label className="form-label">Contenido <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(párrafos separados por línea vacía)</span></label>
                      <textarea className="form-control" value={manualContent} onChange={e => setManualContent(e.target.value)} rows={8} required />
                    </div>
                    {manualError && <p className="modal-error">{manualError}</p>}
                    <button type="submit" className="btn btn-primary" disabled={isSavingManual} style={{ width: '100%', justifyContent: 'center' }}>
                      {isSavingManual ? <><i className="fa-solid fa-circle-notch fa-spin" /> Guardando...</> : <><i className="fa-solid fa-floppy-disk" /> Guardar artículo</>}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    
      <SplashScreen />
    </main>
    <Footer />
    </>

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
