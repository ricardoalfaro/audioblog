'use client';

import { useState, useEffect } from 'react';
import { Article } from '@/types';

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'url' | 'manual'>('url');
  
  // Scraper form state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  // Manual form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualCategory, setManualCategory] = useState('Tecnología');
  const [manualContent, setManualContent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    fetchArticles();
  }, []);

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

  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl) return;

    setIsScraping(true);
    setScrapeError('');

    try {
      // Step 1: Scrape article content
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        throw new Error(scrapeData.error || 'Ocurrió un error al extraer el artículo.');
      }

      // Step 2: Save the scraped article to the JSON database
      const saveRes = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapeData),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || 'No se pudo guardar el artículo.');
      }

      // Refresh list, close modal, reset input
      setArticles((prev) => [saveData, ...prev]);
      setIsModalOpen(false);
      setScrapeUrl('');
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
      // Split content by double newlines to form paragraphs
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

      // Refresh list, close modal, reset inputs
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

  // Extract unique categories
  const categories = ['Todos', ...Array.from(new Set(articles.map((a) => a.category)))];

  // Filter and search articles
  const filteredArticles = articles.filter((article) => {
    const matchesCategory = selectedCategory === 'Todos' || article.category === selectedCategory;
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  return (
    <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      <section className="hero">
        <h1>Transforma la Web en tus Audiolibros Personales</h1>
        <p className="readable-text">
          Importa artículos, tutoriales o ensayos de tus blogs favoritos y escúchalos con una experiencia
          de lectura inmersiva y enfocada.
        </p>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: '4px' }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Importar artículo
        </button>
      </section>

      {/* Filters & Search */}
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

        <div className="search-box">
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por título, autor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Articles Grid */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flex: 1 }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        </div>
      ) : filteredArticles.length > 0 ? (
        <section className="articles-grid">
          {filteredArticles.map((article) => (
            <a href={`/articles/${article.id}`} key={article.id} className="article-card glass">
              <div>
                <div className="card-top">
                  <span className="card-category">{article.category}</span>
                  <span className="card-duration">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatDuration(article.duration)}
                  </span>
                </div>
                <h3 className="card-title">{article.title}</h3>
                <p className="card-excerpt">{article.excerpt}</p>
              </div>

              <div className="card-footer">
                <span className="card-author">Por {article.author}</span>
                <span className="listen-link">
                  Escuchar
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </section>
      ) : (
        <div className="empty-state glass">
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
          <div className="dialog-content glass">
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
                  <span className="form-help">
                    Funciona mejor con artículos de Medium, Substack, blogs técnicos o páginas basadas en texto.
                  </span>
                </div>

                {scrapeError && (
                  <div style={{ color: 'var(--color-accent)', fontSize: '14px', marginBottom: '16px' }}>
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
                        Extrayendo...
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
                    rows={6}
                    placeholder="Escribe o pega el contenido aquí. Usa dos saltos de línea para separar párrafos."
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    required
                    disabled={isSavingManual}
                    style={{ resize: 'vertical', fontFamily: 'var(--font-serif)' }}
                  />
                </div>

                {manualError && (
                  <div style={{ color: 'var(--color-accent)', fontSize: '14px', marginBottom: '16px' }}>
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
