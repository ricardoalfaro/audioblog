'use client';

import React, { useEffect } from 'react';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

export default function GlobalPlayer() {
  const {
    playingArticle,
    isPlaying,
    isPaused,
    handlePlayPause,
    handleStop,
    handleSkipForward,
    handleSkipBackward,
    getProgressPercentage,
    speechRate,
    isLoading,
    toggleSpeed,
    audioEngine,
    handleEngineChange
  } = useAudioPlayer();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
  }, [handlePlayPause, handleSkipForward, handleSkipBackward]);

  if (!playingArticle) return null;

  const getGradientClass = (id: string) => {
    const chars = id.slice(-2);
    const sum = chars.charCodeAt(0) + chars.charCodeAt(1);
    const options = [
      'gradient-blue-purple',
      'gradient-pink-orange',
      'gradient-green-teal',
      'gradient-purple-pink',
      'gradient-orange-red'
    ];
    return options[sum % options.length];
  };

  return (
    <div className="bottom-player-container">
      <div className="bottom-player" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Progress bar line top - inside the player pill */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: 'var(--border-color)' }}>
          <div style={{ height: '100%', width: `${getProgressPercentage()}%`, backgroundColor: 'var(--color-primary)', transition: 'width 0.3s' }}></div>
        </div>

        <div className="player-main-controls">
          <div style={{ width: '48px', height: '48px', flexShrink: 0, marginRight: '16px', display: 'flex', justifyContent: 'center' }}>
            {playingArticle.imageUrl ? (
              <img src={playingArticle.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
            ) : (
              <div className={`${getGradientClass(playingArticle.id)}`} style={{ width: '100%', height: '100%', borderRadius: '8px' }}></div>
            )}
          </div>
          
          <div className="player-info" style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '2px', minWidth: 0, flex: 1, marginRight: '16px' }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', fontSize: '15px', fontWeight: 600 }}>
              {playingArticle.title}
            </div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {playingArticle.author}
            </div>
          </div>

          <div className="player-core" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '16px', flexShrink: 0 }}>
            <button className="player-btn" onClick={handleSkipBackward}>
              <i className="fa-solid fa-backward-step"></i>
            </button>
            <button className="player-btn player-btn-play" onClick={handlePlayPause} disabled={isLoading}>
              {isLoading ? (
                <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
              ) : (
                <i className={`fa-solid ${isPlaying && !isPaused ? 'fa-pause' : 'fa-play'}`}></i>
              )}
            </button>
            <button className="player-btn" onClick={handleSkipForward}>
              <i className="fa-solid fa-forward-step"></i>
            </button>
          </div>
          
          <div className="player-settings" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <button className="player-btn" onClick={toggleSpeed} title="Velocidad" style={{ fontSize: '13px', fontWeight: 600, width: '32px' }}>
              {speechRate}x
            </button>
            <button
              className="player-btn"
              onClick={() => handleEngineChange(audioEngine === 'edge' ? 'device' : 'edge')}
              title={audioEngine === 'edge' ? 'Voz Natural activa — click para cambiar a voz del sistema' : 'Voz del sistema activa — click para cambiar a voz natural'}
            >
              <i className={`fa-solid ${audioEngine === 'edge' ? 'fa-user' : 'fa-robot'}`}></i>
            </button>
            <button className="player-btn" onClick={handleStop} title="Cerrar reproductor">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
