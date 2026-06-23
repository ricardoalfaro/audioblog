'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Article } from '@/types';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import Link from 'next/link';

export default function ArchivePage() {
  const router = useRouter();
  const [archivedArticles, setArchivedArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { handleStop, playingArticle } = useAudioPlayer();

  useEffect(() => {
    try {
      const localData = localStorage.getItem('articles');
      if (localData) {
        const parsed: Article[] = JSON.parse(localData);
        // Mostrar artículos donde el progreso llegó al total de párrafos
        const archived = parsed.filter(a => a.progress !== undefined && a.paragraphs && a.progress >= a.paragraphs.length);
        setArchivedArticles(archived);
      }
    } catch (err) {
      console.error('Error loading articles from localStorage:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteArticle = (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar "${title}" de tu historial?`);
    if (!confirmDelete) return;

    if (playingArticle?.id === id) {
      handleStop();
    }

    try {
      const localData = localStorage.getItem('articles');
      if (localData) {
        const parsed: Article[] = JSON.parse(localData);
        const updatedArticles = parsed.filter((a) => a.id !== id);
        localStorage.setItem('articles', JSON.stringify(updatedArticles));
        setArchivedArticles(updatedArticles.filter(a => a.progress !== undefined && a.paragraphs && a.progress >= a.paragraphs.length));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getGradientClass = (id: string) => {
    const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `card-gradient-${(sum % 5) + 1}`;
  };

  return (
    <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
        <Link href="/app" style={{ color: 'var(--text-secondary)', fontSize: '20px', textDecoration: 'none' }}>
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
        <h1 style={{ fontSize: '32px', margin: 0 }}>Archivo</h1>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '16px' }}>
        Artículos que ya terminaste de escuchar. Se eliminarán automáticamente después de 30 días de su importación.
      </p>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flex: 1 }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        </div>
      ) : archivedArticles.length > 0 ? (
        <div className="grid-new">
          {archivedArticles.map(article => (
            <div key={article.id} className="article-card card-square" onClick={() => router.push(`/app/articles/${article.id}`)}>
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
                  <div style={{ color: 'var(--color-primary)', fontSize: '14px', fontWeight: 'bold' }}>
                    <i className="fa-solid fa-check"></i> Terminado
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: '40px' }}>
          <div style={{ fontSize: '48px', color: 'var(--border-color)', marginBottom: '16px' }}>
            <i className="fa-solid fa-box-archive"></i>
          </div>
          <h3>Tu archivo está vacío</h3>
          <p>Los artículos que termines de escuchar aparecerán aquí automáticamente.</p>
          <Link href="/app" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-block', textDecoration: 'none' }}>
            Volver al inicio
          </Link>
        </div>
      )}
    </main>
  );
}
