'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Article } from '@/types';

export const EDGE_VOICES = [
  { name: 'Alvaro (España, Neural)', value: 'es-ES-AlvaroNeural', lang: 'es-ES' },
  { name: 'Elvira (España, Neural)', value: 'es-ES-ElviraNeural', lang: 'es-ES' },
  { name: 'Dalia (México, Neural)', value: 'es-MX-DaliaNeural', lang: 'es-MX' },
  { name: 'Jorge (México, Neural)', value: 'es-MX-JorgeNeural', lang: 'es-MX' },
  { name: 'Aria (EE.UU., Neural)', value: 'en-US-AriaNeural', lang: 'en-US' },
  { name: 'Guy (EE.UU., Neural)', value: 'en-US-GuyNeural', lang: 'en-US' },
  { name: 'Francisca (Brasil, Neural)', value: 'pt-BR-FranciscaNeural', lang: 'pt-BR' },
  { name: 'Antonio (Brasil, Neural)', value: 'pt-BR-AntonioNeural', lang: 'pt-BR' },
  { name: 'Denise (Francia, Neural)', value: 'fr-FR-DeniseNeural', lang: 'fr-FR' },
  { name: 'Henri (Francia, Neural)', value: 'fr-FR-HenriNeural', lang: 'fr-FR' },
];

interface AudioPlayerContextType {
  playingArticle: Article | null;
  isPlaying: boolean;
  isPaused: boolean;
  activeParagraphIndex: number;
  currentCharIndex: number;
  speechRate: number;
  audioEngine: 'device' | 'edge';
  voices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  selectedEdgeVoice: string;

  playArticle: (article: Article, fromIndex?: number) => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  handleSkipForward: () => void;
  handleSkipBackward: () => void;
  handleParagraphClick: (index: number) => void;
  toggleSpeed: () => void;
  handleEngineChange: (engine: 'device' | 'edge') => void;
  handleVoiceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleEdgeVoiceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;

  getRemainingTime: () => number;
  getProgressPercentage: () => number;
  formatTime: (secs: number) => string;
  sortedVoices: SpeechSynthesisVoice[];
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [playingArticle, setPlayingArticle] = useState<Article | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [speechRate, setSpeechRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState('es-ES-AlvaroNeural');
  const [audioEngine, setAudioEngineState] = useState<'device' | 'edge'>('device');

  // Refs to avoid stale closures in audio callbacks
  const playingArticleRef = useRef<Article | null>(null);
  const speechRateRef = useRef(1);
  const selectedVoiceNameRef = useRef('');
  const selectedEdgeVoiceRef = useRef('es-ES-AlvaroNeural');
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioEngineRef = useRef<'device' | 'edge'>('device');
  const activeParagraphIndexRef = useRef(-1);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep refs in sync
  useEffect(() => { playingArticleRef.current = playingArticle; }, [playingArticle]);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);
  useEffect(() => { selectedVoiceNameRef.current = selectedVoiceName; }, [selectedVoiceName]);
  useEffect(() => { selectedEdgeVoiceRef.current = selectedEdgeVoice; }, [selectedEdgeVoice]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { audioEngineRef.current = audioEngine; }, [audioEngine]);
  useEffect(() => { activeParagraphIndexRef.current = activeParagraphIndex; }, [activeParagraphIndex]);

  // Load saved preferences
  useEffect(() => {
    try {
      const savedEngine = localStorage.getItem('audioEngine') as 'device' | 'edge' | null;
      const savedEdgeVoice = localStorage.getItem('edgeVoice');
      const savedRate = localStorage.getItem('speechRate');
      if (savedEngine) { setAudioEngineState(savedEngine); audioEngineRef.current = savedEngine; }
      if (savedEdgeVoice) { setSelectedEdgeVoice(savedEdgeVoice); selectedEdgeVoiceRef.current = savedEdgeVoice; }
      if (savedRate) { const r = parseFloat(savedRate); setSpeechRate(r); speechRateRef.current = r; }
    } catch (_) {}
  }, []);

  // Load Web Speech voices
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
      voicesRef.current = allVoices;
      if (allVoices.length > 0 && !selectedVoiceNameRef.current) {
        const saved = localStorage.getItem('deviceVoice');
        const pick = (saved && allVoices.find(v => v.name === saved))
          || allVoices.find(v => v.default)
          || allVoices.find(v => v.lang.startsWith('es'))
          || allVoices.find(v => v.lang.startsWith('en'))
          || allVoices[0];
        setSelectedVoiceName(pick.name);
        selectedVoiceNameRef.current = pick.name;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // Initialize HTML5 Audio for Edge TTS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = new Audio();
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  // --- Core speak functions ---

  const speakParagraph = (index: number) => {
    const article = playingArticleRef.current;
    if (!article || typeof window === 'undefined') return;

    try { window.speechSynthesis.cancel(); } catch (_) {}

    if (index < 0 || index >= article.paragraphs.length) {
      setIsPlaying(false); setIsPaused(false);
      setActiveParagraphIndex(-1); setCurrentCharIndex(-1);
      setPlayingArticle(null);
      return;
    }

    setActiveParagraphIndex(index);
    activeParagraphIndexRef.current = index;
    setCurrentCharIndex(0);

    const text = article.paragraphs[index];
    const utterance = new SpeechSynthesisUtterance(text);

    try {
      const voice = voicesRef.current.find(v => v.name === selectedVoiceNameRef.current);
      if (voice) utterance.voice = voice;
    } catch (_) {}

    utterance.rate = speechRateRef.current;

    utterance.onboundary = (event) => {
      if (event.name === 'word') setCurrentCharIndex(event.charIndex);
    };

    utterance.onend = () => {
      const nextIndex = index + 1;
      if (nextIndex < article.paragraphs.length) {
        speakParagraph(nextIndex);
      } else {
        setIsPlaying(false); setIsPaused(false);
        setActiveParagraphIndex(-1); setCurrentCharIndex(-1);
        setPlayingArticle(null);
      }
    };

    utterance.onerror = () => { setIsPlaying(false); setIsPaused(false); };

    utteranceRef.current = utterance;
    try { window.speechSynthesis.speak(utterance); } catch (_) {
      setIsPlaying(false); setIsPaused(false);
    }
  };

  const playEdgeParagraph = (index: number) => {
    const article = playingArticleRef.current;
    if (!article || !audioRef.current) return;

    try { window.speechSynthesis.cancel(); } catch (_) {}

    if (index < 0 || index >= article.paragraphs.length) {
      setIsPlaying(false); setIsPaused(false);
      setActiveParagraphIndex(-1); setCurrentCharIndex(-1);
      setPlayingArticle(null);
      return;
    }

    setActiveParagraphIndex(index);
    activeParagraphIndexRef.current = index;
    setCurrentCharIndex(-1);

    const text = article.paragraphs[index];
    const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${selectedEdgeVoiceRef.current}`;

    audioRef.current.src = url;
    audioRef.current.playbackRate = speechRateRef.current;

    audioRef.current.onplay = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setupMediaSession();
    };

    audioRef.current.onpause = () => setIsPaused(true);

    audioRef.current.onended = () => {
      const nextIndex = index + 1;
      if (nextIndex < article.paragraphs.length) {
        playEdgeParagraph(nextIndex);
      } else {
        setIsPlaying(false); setIsPaused(false);
        setActiveParagraphIndex(-1); setCurrentCharIndex(-1);
        setPlayingArticle(null);
      }
    };

    audioRef.current.onerror = () => { setIsPlaying(false); setIsPaused(false); };

    audioRef.current.play().catch(() => { setIsPlaying(false); setIsPaused(false); });
  };

  const startParagraph = (index: number) => {
    if (audioEngineRef.current === 'edge') {
      playEdgeParagraph(index);
    } else {
      speakParagraph(index);
    }
  };

  const setupMediaSession = () => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    const article = playingArticleRef.current;
    if (!article) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: article.title,
        artist: article.author,
        album: 'Audioblog',
        artwork: [{ src: 'https://audioblog-omega.vercel.app/icon.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.setActionHandler('play', handlePlayPause);
      navigator.mediaSession.setActionHandler('pause', handlePlayPause);
      navigator.mediaSession.setActionHandler('previoustrack', handleSkipBackward);
      navigator.mediaSession.setActionHandler('nexttrack', handleSkipForward);
    } catch (_) {}
  };

  // --- Public handlers ---

  const playArticle = (article: Article, fromIndex = 0) => {
    // Stop whatever is currently playing
    try { window.speechSynthesis.cancel(); } catch (_) {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }

    setPlayingArticle(article);
    playingArticleRef.current = article;
    setIsPlaying(true);
    setIsPaused(false);

    // Auto-detect Edge voice language
    if (audioEngineRef.current === 'edge') {
      const isEnglish = article.paragraphs.join(' ').toLowerCase().includes(' the ');
      const defaultVoice = isEnglish ? 'en-US-AriaNeural' : 'es-ES-AlvaroNeural';
      const savedEdgeVoice = localStorage.getItem('edgeVoice');
      if (!savedEdgeVoice) {
        setSelectedEdgeVoice(defaultVoice);
        selectedEdgeVoiceRef.current = defaultVoice;
      }
    }

    // Defer to next tick so state has settled before playback starts
    setTimeout(() => startParagraph(fromIndex), 0);
  };

  const handlePlayPause = () => {
    if (typeof window === 'undefined') return;

    if (isPlaying) {
      if (isPaused) {
        if (audioEngineRef.current === 'edge' && audioRef.current) {
          audioRef.current.play().catch(() => {});
        } else {
          window.speechSynthesis.resume();
        }
        setIsPaused(false);
      } else {
        if (audioEngineRef.current === 'edge' && audioRef.current) {
          audioRef.current.pause();
        } else {
          window.speechSynthesis.pause();
        }
        setIsPaused(true);
      }
    } else {
      const startIndex = activeParagraphIndexRef.current >= 0 ? activeParagraphIndexRef.current : 0;
      setIsPlaying(true);
      setIsPaused(false);
      startParagraph(startIndex);
    }
  };

  const handleStop = () => {
    if (typeof window === 'undefined') return;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    setIsPlaying(false); setIsPaused(false);
    setActiveParagraphIndex(-1); setCurrentCharIndex(-1);
    setPlayingArticle(null);
    playingArticleRef.current = null;
  };

  const handleSkipForward = () => {
    const article = playingArticleRef.current;
    if (!article) return;
    const next = activeParagraphIndexRef.current + 1;
    if (next < article.paragraphs.length) startParagraph(next);
  };

  const handleSkipBackward = () => {
    const prev = activeParagraphIndexRef.current - 1;
    if (prev >= 0) {
      startParagraph(prev);
    } else {
      startParagraph(0);
    }
  };

  const handleParagraphClick = (index: number) => {
    if (isPlaying) {
      startParagraph(index);
    } else {
      setActiveParagraphIndex(index);
      activeParagraphIndexRef.current = index;
      setCurrentCharIndex(0);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const next = speeds[(speeds.indexOf(speechRateRef.current) + 1) % speeds.length];
    setSpeechRate(next);
    speechRateRef.current = next;
    localStorage.setItem('speechRate', String(next));

    if (audioEngineRef.current === 'edge' && audioRef.current) {
      audioRef.current.playbackRate = next;
    } else if (isPlaying && !isPaused) {
      speakParagraph(activeParagraphIndexRef.current);
    }
  };

  const handleEngineChange = (engine: 'device' | 'edge') => {
    const wasPlaying = isPlaying;
    const idx = activeParagraphIndexRef.current;
    handleStop();
    setAudioEngineState(engine);
    audioEngineRef.current = engine;
    localStorage.setItem('audioEngine', engine);

    if (engine === 'edge' && !localStorage.getItem('edgeVoice')) {
      const isEnglish = playingArticleRef.current?.paragraphs.join(' ').toLowerCase().includes(' the ') || false;
      const voice = isEnglish ? 'en-US-AriaNeural' : 'es-ES-AlvaroNeural';
      setSelectedEdgeVoice(voice);
      selectedEdgeVoiceRef.current = voice;
    }

    if (wasPlaying && playingArticleRef.current) {
      const article = playingArticleRef.current;
      setTimeout(() => {
        setPlayingArticle(article);
        playingArticleRef.current = article;
        setIsPlaying(true);
        setIsPaused(false);
        if (engine === 'edge') playEdgeParagraph(idx >= 0 ? idx : 0);
        else speakParagraph(idx >= 0 ? idx : 0);
      }, 150);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedVoiceName(name);
    selectedVoiceNameRef.current = name;
    localStorage.setItem('deviceVoice', name);
    if (isPlaying && !isPaused) speakParagraph(activeParagraphIndexRef.current);
  };

  const handleEdgeVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voice = e.target.value;
    setSelectedEdgeVoice(voice);
    selectedEdgeVoiceRef.current = voice;
    localStorage.setItem('edgeVoice', voice);
    if (isPlaying && !isPaused) playEdgeParagraph(activeParagraphIndexRef.current);
  };

  // --- Helpers ---

  const getRemainingTime = () => {
    const article = playingArticle;
    if (!article) return 0;
    let words = 0;
    for (let i = activeParagraphIndex + 1; i < article.paragraphs.length; i++) {
      words += article.paragraphs[i].split(/\s+/).filter(Boolean).length;
    }
    if (activeParagraphIndex >= 0) {
      const remaining = article.paragraphs[activeParagraphIndex].slice(currentCharIndex);
      words += remaining.split(/\s+/).filter(Boolean).length;
    } else {
      words = article.paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    }
    return Math.round((words / (160 * speechRate)) * 60);
  };

  const getProgressPercentage = () => {
    const article = playingArticle;
    if (!article || activeParagraphIndex < 0) return 0;
    const total = article.paragraphs.join('').length;
    let read = 0;
    for (let i = 0; i < activeParagraphIndex; i++) read += article.paragraphs[i].length;
    read += Math.max(0, currentCharIndex);
    return Math.min(100, (read / total) * 100);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const sortedVoices = [...voices].sort((a, b) => {
    const aEs = a.lang.startsWith('es'), bEs = b.lang.startsWith('es');
    const aEn = a.lang.startsWith('en'), bEn = b.lang.startsWith('en');
    if (aEs && !bEs) return -1; if (!aEs && bEs) return 1;
    if (aEn && !bEn) return -1; if (!aEn && bEn) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <AudioPlayerContext.Provider value={{
      playingArticle, isPlaying, isPaused, activeParagraphIndex, currentCharIndex,
      speechRate, audioEngine, voices, selectedVoiceName, selectedEdgeVoice,
      playArticle, handlePlayPause, handleStop, handleSkipForward, handleSkipBackward,
      handleParagraphClick, toggleSpeed, handleEngineChange, handleVoiceChange, handleEdgeVoiceChange,
      getRemainingTime, getProgressPercentage, formatTime, sortedVoices,
    }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used inside AudioPlayerProvider');
  return ctx;
}
