'use client';

import { useAudioPlayer, EDGE_VOICES } from '@/contexts/AudioPlayerContext';

export default function BottomPlayer() {
  const {
    playingArticle, isPlaying, isPaused, activeParagraphIndex,
    speechRate, audioEngine, sortedVoices, selectedVoiceName, selectedEdgeVoice,
    handlePlayPause, handleStop, handleSkipForward, handleSkipBackward,
    handleParagraphClick, toggleSpeed, handleEngineChange, handleVoiceChange, handleEdgeVoiceChange,
    getRemainingTime, getProgressPercentage, formatTime,
  } = useAudioPlayer();

  if (!playingArticle) return null;

  const remainingTime = getRemainingTime();
  const progress = getProgressPercentage();
  const elapsed = activeParagraphIndex >= 0
    ? Math.round(((playingArticle.duration - remainingTime) / playingArticle.duration) * playingArticle.duration)
    : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(
      playingArticle.paragraphs.length - 1,
      Math.floor(pct * playingArticle.paragraphs.length),
    );
    handleParagraphClick(idx);
  };

  return (
    <div className="bottom-player-container" style={{ animation: 'slideUp 0.3s ease-out' }}>
      <div className="bottom-player glass">
        {/* Progress bar */}
        <div className="player-progress-container">
          <span className="player-time">{formatTime(elapsed)}</span>

          <div className="player-slider-wrapper" onClick={handleSeek}>
            <div className="player-slider-fill" style={{ width: `${progress}%` }} />
            <div className="player-slider-thumb" style={{ left: `${progress}%` }} />
          </div>

          <span className="player-time">{formatTime(playingArticle.duration)}</span>
        </div>

        {/* Controls row */}
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
              <i className="fa-solid fa-backward-step" style={{ fontSize: '18px' }} />
            </button>

            <button
              className="player-btn player-btn-play"
              onClick={handlePlayPause}
              title={isPlaying && !isPaused ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying && !isPaused
                ? <i className="fa-solid fa-pause" style={{ fontSize: '18px' }} />
                : <i className="fa-solid fa-play" style={{ fontSize: '18px', marginLeft: '2px' }} />}
            </button>

            <button className="player-btn" onClick={handleSkipForward} title="Siguiente párrafo">
              <i className="fa-solid fa-forward-step" style={{ fontSize: '18px' }} />
            </button>

            <button className="player-btn" onClick={handleStop} title="Detener" style={{ marginLeft: '8px' }}>
              <i className="fa-solid fa-square" style={{ fontSize: '18px' }} />
            </button>
          </div>

          <div className="player-settings">
            <div className="player-visualizer">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`visualizer-bar ${isPlaying && !isPaused ? 'playing' : ''}`} />
              ))}
            </div>

            {/* Engine toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
              <label
                className="switch"
                title={audioEngine === 'device' ? 'Cambiar a Voz Neuronal (Fondo / CarPlay)' : 'Cambiar a Voz Local'}
              >
                <input
                  type="checkbox"
                  checked={audioEngine === 'edge'}
                  onChange={(e) => handleEngineChange(e.target.checked ? 'edge' : 'device')}
                />
                <span className="slider" />
              </label>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '40px' }}>
                {audioEngine === 'device' ? 'Local' : 'Neural'}
              </span>
            </div>

            {/* Voice select */}
            {audioEngine === 'device' ? (
              <select className="player-select" value={selectedVoiceName} onChange={handleVoiceChange} title="Voz">
                {sortedVoices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang.split('-')[0].toUpperCase()})</option>
                ))}
              </select>
            ) : (
              <select className="player-select" value={selectedEdgeVoice} onChange={handleEdgeVoiceChange} title="Voz">
                {EDGE_VOICES.map(v => (
                  <option key={v.value} value={v.value}>{v.name}</option>
                ))}
              </select>
            )}

            <div className="player-speed" onClick={toggleSpeed} title="Velocidad">
              {speechRate}x
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
