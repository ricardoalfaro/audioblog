'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { shareArticle } from '@/lib/shareArticle';
import { getGradientClass } from '@/lib/gradientClass';
import { useLocale } from '@/contexts/LocaleContext';
import { getArticlesList } from '@/lib/articleStorage';
import { WarningTriangle, Headset, SkipPrev, Pause, Play, SkipNext, Check, ShareIos } from 'iconoir-react';

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
    getRemainingTime,
    speechRate,
    isLoading,
    toggleSpeed,
    ttsError,
    queue,
    hasNext,
    hasPrevious,
  } = useAudioPlayer();

  const [shareCopied, setShareCopied] = useState(false);
  const hasArticle = Boolean(playingArticle);

  const formatRemainingTime = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const hourMinutes = minutes % 60;
      return `-${hours}:${hourMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `-${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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
            <WarningTriangle />
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
                <Headset />
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
              <SkipPrev />
            </button>
            <button className="player-btn player-btn-play" onClick={handlePlayPause} disabled={!hasArticle || isLoading} title={hasArticle ? undefined : t('player.emptyPlayDisabled')}>
              {isLoading ? (
                <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
              ) : (
                isPlaying && !isPaused ? <Pause /> : <Play />
              )}
            </button>
            <button className="player-btn" onClick={handleSkipForward} disabled={!hasArticle || !hasNext} title="Siguiente artículo">
              <SkipNext />
            </button>
          </div>
          
          <div className="player-settings" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <span className="player-remaining-time" aria-live="off">
              {hasArticle ? formatRemainingTime(getRemainingTime()) : '--:--'}
            </span>
            <button className="player-btn player-speed-btn" onClick={toggleSpeed} disabled={!hasArticle} title="Velocidad">
              {speechRate}x
            </button>
            <button
              className="player-btn"
              onClick={handleShare}
              disabled={!playingArticle || playingArticle.url === 'manual'}
              title={shareCopied ? 'Enlace copiado' : 'Compartir artículo'}
              aria-label={shareCopied ? 'Enlace copiado' : 'Compartir artículo'}
            >
              {shareCopied ? <Check /> : <ShareIos />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
