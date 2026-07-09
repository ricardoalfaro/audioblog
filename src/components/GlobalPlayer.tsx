'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { shareArticle } from '@/lib/shareArticle';
import { getGradientClass } from '@/lib/gradientClass';
import { useLocale } from '@/contexts/LocaleContext';
import { getArticlesList } from '@/lib/articleStorage';

export default function GlobalPlayer() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const {
    playingArticle,
    isPlaying,
    isPaused,
    handlePlayPause,
    handleSkipForward,
    handleSkipBackward,
    getProgressPercentage,
    speechRate,
    isLoading,
    toggleSpeed,
    audioEngine,
    handleEngineChange,
    ttsError,
    queue,
    hasNext,
    hasPrevious,
  } = useAudioPlayer();

  const [shareCopied, setShareCopied] = useState(false);
  const hasArticle = Boolean(playingArticle);

  const handleEmptyCoverClick = () => {
    if (playingArticle || getArticlesList().length > 0) return;
    if (pathname === '/app') {
      window.dispatchEvent(new CustomEvent('audiodocs:open-import'));
    } else {
      router.push('/app?open=import');
    }
  };

  const handleShare = async () => {
    if (!playingArticle) return;
    if (await shareArticle(playingArticle) === 'copied') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!playingArticle) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkipForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkipBackward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playingArticle, handlePlayPause, handleSkipForward, handleSkipBackward]);

  return (
    <div className="bottom-player-container">
      <div className={`bottom-player${hasArticle ? '' : ' is-empty'}`} style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Progress bar line top - inside the player pill */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: 'var(--border-color)' }}>
          <div style={{ height: '100%', width: hasArticle ? `${getProgressPercentage()}%` : '0%', backgroundColor: 'var(--color-primary)', transition: 'width 0.3s' }}></div>
        </div>

        {ttsError && (
          <div style={{ fontSize: '12px', color: '#d93025', textAlign: 'center', padding: '2px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            {ttsError}
          </div>
        )}
        <div className="player-main-controls">
          <div style={{ width: '48px', height: '48px', flexShrink: 0, marginRight: '16px', display: 'flex', justifyContent: 'center' }}>
            {playingArticle?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playingArticle.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
            ) : playingArticle ? (
              <div className={`${getGradientClass(playingArticle.id)}`} style={{ width: '100%', height: '100%', borderRadius: '8px' }}></div>
            ) : (
              <button
                type="button"
                className="player-empty-thumb"
                onClick={handleEmptyCoverClick}
                title={t('player.emptyCoverImport')}
                aria-label={t('player.emptyCoverImport')}
              >
                <i className="fa-solid fa-headphones"></i>
              </button>
            )}
          </div>
          
          <div className="player-info player-info-text" style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '2px', minWidth: 0, flex: 1, marginRight: '16px' }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', fontSize: '15px', fontWeight: 600 }}>
              {playingArticle?.title ?? t('player.emptyTitle')}
            </div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {playingArticle?.author ?? t('player.emptySubtitle')}
              {queue.length > 0 && (
                <span style={{ marginLeft: '6px', color: 'var(--color-primary)', fontWeight: 500 }}>
                  · {queue.length} en cola
                </span>
              )}
            </div>
          </div>

          <div className="player-core" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '16px', flexShrink: 0 }}>
            <button className="player-btn" onClick={handleSkipBackward} disabled={!hasArticle || !hasPrevious} title="Artículo anterior">
              <i className="fa-solid fa-backward-step"></i>
            </button>
            <button className="player-btn player-btn-play" onClick={handlePlayPause} disabled={!hasArticle || isLoading} title={hasArticle ? undefined : t('player.emptyPlayDisabled')}>
              {isLoading ? (
                <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
              ) : (
                <i className={`fa-solid ${isPlaying && !isPaused ? 'fa-pause' : 'fa-play'}`}></i>
              )}
            </button>
            <button className="player-btn" onClick={handleSkipForward} disabled={!hasArticle || !hasNext} title="Siguiente artículo">
              <i className="fa-solid fa-forward-step"></i>
            </button>
          </div>
          
          <div className="player-settings" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <button className="player-btn" onClick={toggleSpeed} disabled={!hasArticle} title="Velocidad" style={{ fontSize: '13px', fontWeight: 600, width: '32px' }}>
              {speechRate}x
            </button>
            <button
              className="player-btn"
              onClick={() => handleEngineChange(audioEngine === 'edge' ? 'device' : 'edge')}
              title={audioEngine === 'edge' ? 'Voz Natural activa — click para cambiar a voz del sistema' : 'Voz del sistema activa — click para cambiar a voz natural'}
            >
              <i className={`fa-solid ${audioEngine === 'edge' ? 'fa-user' : 'fa-robot'}`}></i>
            </button>
            <button
              className="player-btn"
              onClick={handleShare}
              disabled={!playingArticle || playingArticle.url === 'manual'}
              title={shareCopied ? 'Enlace copiado' : 'Compartir artículo'}
              aria-label={shareCopied ? 'Enlace copiado' : 'Compartir artículo'}
            >
              <i className={`fa-solid ${shareCopied ? 'fa-check' : 'fa-arrow-up-from-bracket'}`}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
