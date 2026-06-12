'use client';

import React from 'react';
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
    toggleSpeed,
    audioEngine,
    handleEngineChange
  } = useAudioPlayer();

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
            <button className="player-btn player-btn-play" onClick={handlePlayPause}>
              <i className={`fa-solid ${isPlaying && !isPaused ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            <button className="player-btn" onClick={handleSkipForward}>
              <i className="fa-solid fa-forward-step"></i>
            </button>
          </div>
          
          <div className="player-settings" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <button className="player-btn" onClick={toggleSpeed} title="Velocidad" style={{ fontSize: '13px', fontWeight: 600, width: '32px' }}>
              {speechRate}x
            </button>
            <label className="switch" title="Selector de tipo de voz: Natural o del Navegador" style={{ transform: 'scale(0.8)', margin: 0 }}>
              <input
                type="checkbox"
                checked={audioEngine === 'edge'}
                onChange={(e) => handleEngineChange(e.target.checked ? 'edge' : 'device')}
              />
              <span className="slider"></span>
            </label>
            <button className="player-btn" onClick={handleStop} title="Cerrar reproductor">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
