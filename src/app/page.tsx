'use client';

import { useState, useEffect } from 'react';
import { Article } from '@/types';
import { defaultArticles } from '@/data/defaultArticles';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

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

  const { playingArticle, isPlaying, isPaused, playArticle, handlePlayPause, formatTime } = useAudioPlayer();

  useEffect(() => {
    fetchArticles();
    const savedView = localStorage.getItem('viewMode') as 'grid' | 'list' | null;
    if (savedView) setViewMode(savedView);
  }, []);

  const pruneArticles = (loadedArticles: Article[]): Article[] => {
    const defaultIds = new Set(defaultArticles.map(a => a.id));
    const customArticles = loadedArticles.filter(a => !defaultIds.has(a.id));
    const activeDefaultArticles = loadedArticles.filter(a => defaultIds.has(a.id));

    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let prunedCustom = customArticles.filter(a => {
      if (!a.addedAt) return true;
      return (now - new Date(a.addedAt).getTime()) < tenDaysMs;
    });

    const MAX_CUSTOM_ARTICLES = 15;
    if (prunedCustom.length > MAX_CUSTOM_ARTICLES) {
      prunedCustom.sort((a, b) => {
        const tA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const tB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return tB - tA;
      });
      prunedCustom = prunedCustom.slice(0, MAX_CUSTOM_ARTICLES);
    }

    return [...prunedCustom, ...activeDefaultArticles];
  };

  const fetchArticles = () => {
    try {
      setIsLoading(true);
      const localData = localStorage.getItem('articles');
      if (localData) {
        const parsed = JSON.parse(localData);
        const pruned = pruneArticles(parsed);
        if (parsed.length !== pruned.length) localStorage.setItem('articles', JSON.stringify(pruned));
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

  const handlePlayDirectly = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();

    if (playingArticle?.id === article.id) {
      handlePlayPause();
    } else {
      playArticle(article, 0);
    }
  };

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

      if (scrapeCategory !== 'auto') scrapeData.category = scrapeCategory;

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
      };

      const urlExists = articles.some(a => a.url !== 'manual' && a.url.toLowerCase() === newArticle.url.toLowerCase());
      if (urlExists) throw new Error('Este artículo ya ha sido importado.');

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
      const paragraphs = manualContent
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean);

      if (paragraphs.length === 0) throw new Error('El contenido debe tener al menos un párrafo.');

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

    const updatedArticles = articles.filter(a => a.id !== id);
    setArticles(updatedArticles);
    localStorage.setItem('articles', JSON.stringify(updatedArticles));
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  const filteredArticles = articles.filter(article => {
    const matchesCategory = selectedCategory === 'Todos' || article.category === selectedCategory;
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['Todos', ...Array.from(new Set(articles.map(a => a.category)))];

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
          {categories.map(category => (
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
              onChange={e => setSearchQuery(e.target.value)}
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

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flex: 1 }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        </div>
      ) : filteredArticles.length > 0 ? (
        viewMode === 'grid' ? (
          <section className="articles-grid">
            {filteredArticles.map(article => {
              const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
              return (
                <a href={`/articles/${article.id}`} key={article.id} className="article-card">
                  <button
                    className="trash-btn"
                    onClick={e => handleDeleteArticle(e, article.id, article.title)}
                    title="Eliminar artículo"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>

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

                    <button
                      className={`card-play-btn ${playingArticle?.id === article.id ? 'is-playing' : ''}`}
                      onClick={e => handlePlayDirectly(e, article)}
                      title={isCurrentPlaying ? 'Pausar' : 'Reproducir ahora'}
                    >
                      {isCurrentPlaying
                        ? <i className="fa-solid fa-pause"></i>
                        : <i className="fa-solid fa-play"></i>}
                    </button>
                  </div>

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
          <section className="articles-list-container">
            <div className="list-header">
              <span>Nombre</span>
              <span>Autor</span>
              <span>Categoría</span>
              <span>Duración</span>
              <span style={{ textAlign: 'right' }}>Acciones</span>
            </div>

            <div className="list-rows">
              {filteredArticles.map(article => {
                const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
                return (
                  <a href={`/articles/${article.id}`} key={article.id} className="list-row-item">
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

                    <div className="list-col-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="list-action-btn listen"
                        onClick={e => handlePlayDirectly(e, article)}
                        title={isCurrentPlaying ? 'Pausar' : 'Escuchar ahora'}
                      >
                        {isCurrentPlaying
                          ? <i className="fa-solid fa-pause"></i>
                          : <i className="fa-solid fa-play"></i>}
                      </button>
                      <button
                        className="list-action-btn delete"
                        onClick={e => handleDeleteArticle(e, article.id, article.title)}
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

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', background: 'rgba(0,0,0,0.03)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)', lineHeight: '1.4' }}>
              💡 <strong>Límites y Privacidad:</strong> Los artículos se guardan de forma privada en el almacenamiento local de tu navegador. Se conservan un máximo de <strong>15 artículos importados</strong> y cada uno se elimina automáticamente <strong>10 días</strong> después de haber sido creado.
            </div>

            {modalTab === 'url' ? (
              <form onSubmit={handleScrapeSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="url-input">Enlace del Artículo</label>
                  <input
                    id="url-input"
                    type="url"
                    className="form-input"
                    placeholder="https://ejemplo.com/articulo-interesante"
                    value={scrapeUrl}
                    onChange={e => setScrapeUrl(e.target.value)}
                    required
                    disabled={isScraping}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="category-select-scrape">Categoría (Opcional)</label>
                    <select
                      id="category-select-scrape"
                      className="form-input"
                      value={scrapeCategory}
                      onChange={e => setScrapeCategory(e.target.value)}
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
                    <label className="form-label" htmlFor="translate-select">Traducir a (Opcional)</label>
                    <select
                      id="translate-select"
                      className="form-input"
                      value={translateTo}
                      onChange={e => setTranslateTo(e.target.value)}
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
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isScraping}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isScraping || !scrapeUrl}>
                    {isScraping ? (
                      <><div className="spinner" style={{ marginRight: '8px' }}></div>Extrayendo y Traduciendo...</>
                    ) : 'Extraer y Guardar'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleManualSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="title-input">Título del Artículo</label>
                  <input
                    id="title-input"
                    type="text"
                    className="form-input"
                    placeholder="Título del artículo"
                    value={manualTitle}
                    onChange={e => setManualTitle(e.target.value)}
                    required
                    disabled={isSavingManual}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="author-input">Autor</label>
                    <input
                      id="author-input"
                      type="text"
                      className="form-input"
                      placeholder="Nombre del autor"
                      value={manualAuthor}
                      onChange={e => setManualAuthor(e.target.value)}
                      disabled={isSavingManual}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="category-select">Categoría</label>
                    <select
                      id="category-select"
                      className="form-input"
                      value={manualCategory}
                      onChange={e => setManualCategory(e.target.value)}
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
                  <label className="form-label" htmlFor="content-textarea">Contenido del Artículo</label>
                  <textarea
                    id="content-textarea"
                    className="form-input"
                    rows={5}
                    placeholder="Escribe o pega el contenido aquí. Usa dos saltos de línea para separar párrafos."
                    value={manualContent}
                    onChange={e => setManualContent(e.target.value)}
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
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSavingManual}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSavingManual || !manualTitle || !manualContent}>
                    {isSavingManual ? (
                      <><div className="spinner" style={{ marginRight: '8px' }}></div>Guardando...</>
                    ) : 'Guardar Artículo'}
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
