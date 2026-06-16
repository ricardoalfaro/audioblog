'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Article } from '@/types';

export const EDGE_VOICES = [
  { name: 'Alvaro (España, Neural)', value: 'es-ES-AlvaroNeural', lang: 'es-ES' },
  { name: 'Elvira (España, Neural)', value: 'es-ES-ElviraNeural', lang: 'es-ES' },
  { name: 'Dalia (México, Neural)', value: 'es-MX-DaliaNeural', lang: 'es-MX' },
  { name: 'Jorge (México, Neural)', value: 'es-MX-JorgeNeural', lang: 'es-MX' },
  { name: 'Aria (EE.UU., Neural)', value: 'en-US-AriaNeural', lang: 'en-US' },
  { name: 'Guy (EE.UU., Neural)', value: 'en-US-GuyNeural', lang: 'en-US' },
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
  isLoading: boolean;
  
  playArticle: (article: Article, forceParagraphIndex?: number) => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  handleSkipForward: () => void;
  handleSkipBackward: () => void;
  handleParagraphClick: (index: number) => void;
  handleEngineChange: (engine: 'device' | 'edge') => void;
  handleVoiceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleEdgeVoiceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  toggleSpeed: () => void;
  getProgressPercentage: () => number;
  getRemainingTime: () => number;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [playingArticle, setPlayingArticle] = useState<Article | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs to fix stale closures in audio events
  const isPausedRef = useRef(false);
  const playingArticleIdRef = useRef<string | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [audioEngine, setAudioEngine] = useState<'device' | 'edge'>('edge');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState('es-ES-AlvaroNeural');

  // Keep ref in sync so async prefetch callbacks always use the current voice
  useEffect(() => { selectedEdgeVoiceRef.current = selectedEdgeVoice; }, [selectedEdgeVoice]);

  // Load persisted preferences on mount (client-only)
  useEffect(() => {
    try {
      const engine = localStorage.getItem('pref_audioEngine') as 'device' | 'edge' | null;
      if (engine) setAudioEngine(engine);
      const edgeVoice = localStorage.getItem('pref_edgeVoice');
      if (edgeVoice) setSelectedEdgeVoice(edgeVoice);
      const voiceName = localStorage.getItem('pref_voiceName');
      if (voiceName) setSelectedVoiceName(voiceName);
      const rate = parseFloat(localStorage.getItem('pref_speechRate') || '');
      if (!isNaN(rate)) setSpeechRate(rate);
    } catch {}
  }, []);

  // Persist audio preferences to localStorage
  useEffect(() => { try { localStorage.setItem('pref_audioEngine', audioEngine); } catch {} }, [audioEngine]);
  useEffect(() => { try { localStorage.setItem('pref_edgeVoice', selectedEdgeVoice); } catch {} }, [selectedEdgeVoice]);
  useEffect(() => { try { localStorage.setItem('pref_voiceName', selectedVoiceName); } catch {} }, [selectedVoiceName]);
  useEffect(() => { try { localStorage.setItem('pref_speechRate', String(speechRate)); } catch {} }, [speechRate]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Prefetch state for Edge TTS double-buffering
  const prefetchedBlobUrlRef = useRef<string | null>(null);
  const prefetchedIndexRef = useRef<number>(-1);
  const selectedEdgeVoiceRef = useRef('es-ES-AlvaroNeural');

  // Load local voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        if (!selectedVoiceName) {
          const esVoice = availableVoices.find(v => v.lang.startsWith('es'));
          setSelectedVoiceName(esVoice ? esVoice.name : availableVoices[0].name);
        }
      }
    };
    loadVoices();
    if (typeof window !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedVoiceName]);

  // Init Edge Audio Element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audioRef.current = audio;
      
      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, []);

  const updateArticleProgress = (article: Article, paragraphIndex: number) => {
    try {
      const localData = localStorage.getItem('articles');
      if (localData) {
        const articlesList: Article[] = JSON.parse(localData);
        const index = articlesList.findIndex((a) => a.id === article.id);
        if (index !== -1) {
          articlesList[index].progress = paragraphIndex;
          localStorage.setItem('articles', JSON.stringify(articlesList));
        }
      }
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  };

  const speakParagraph = (index: number, article: Article) => {
    if (!article || typeof window === 'undefined') return;

    try {
      window.speechSynthesis.cancel();
    } catch (cancelErr) {
      console.warn('speechSynthesis.cancel error:', cancelErr);
    }

    if (index < 0 || index >= article.paragraphs.length) {
      if (index >= article.paragraphs.length) {
        updateArticleProgress(article, 0); // Artículo terminado: reinicia progreso
      }
      handleStop();
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(0);
    updateArticleProgress(article, index);

    const text = article.paragraphs[index];
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedVoiceName) {
      const voice = voices.find((v) => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }
    
    utterance.rate = speechRate;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentCharIndex(event.charIndex);
      }
    };

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setIsLoading(false);
    };

    utterance.onend = () => {
      if (!isPausedRef.current && playingArticleIdRef.current === article.id) {
        speakParagraph(index + 1, article);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    utteranceRef.current = utterance;
    
    try {
      window.speechSynthesis.speak(utterance);
      setIsLoading(true);
    } catch (speakErr) {
      console.error('speechSynthesis.speak error:', speakErr);
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const revokePrefetchedBlob = () => {
    if (prefetchedBlobUrlRef.current) {
      URL.revokeObjectURL(prefetchedBlobUrlRef.current);
      prefetchedBlobUrlRef.current = null;
      prefetchedIndexRef.current = -1;
    }
  };

  const prefetchNextParagraph = (index: number, article: Article) => {
    const nextIndex = index + 1;
    if (nextIndex >= article.paragraphs.length) return;
    // Already prefetched this index
    if (prefetchedIndexRef.current === nextIndex) return;

    revokePrefetchedBlob();

    const text = article.paragraphs[nextIndex];
    const voice = selectedEdgeVoiceRef.current;
    const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${voice}`;

    fetch(url)
      .then(res => {
        if (!res.ok) return;
        // Abort if the article or voice changed while fetching
        if (
          playingArticleIdRef.current !== article.id ||
          selectedEdgeVoiceRef.current !== voice
        ) return;
        return res.blob();
      })
      .then(blob => {
        if (!blob) return;
        prefetchedBlobUrlRef.current = URL.createObjectURL(blob);
        prefetchedIndexRef.current = nextIndex;
      })
      .catch(() => {});
  };

  const playEdgeParagraph = (index: number, article: Article) => {
    if (!audioRef.current || !article) return;

    try { window.speechSynthesis.cancel(); } catch (e) {}

    if (index < 0 || index >= article.paragraphs.length) {
      if (index >= article.paragraphs.length) {
        updateArticleProgress(article, 0); // Artículo terminado: reinicia progreso
      }
      handleStop();
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(-1);
    updateArticleProgress(article, index);

    // Use prefetched blob if available for this index, otherwise fall back to API URL
    let src: string;
    if (prefetchedIndexRef.current === index && prefetchedBlobUrlRef.current) {
      src = prefetchedBlobUrlRef.current;
      // Clear ref so we don't revoke it before the audio element finishes reading it
      prefetchedBlobUrlRef.current = null;
      prefetchedIndexRef.current = -1;
    } else {
      src = `/api/tts?text=${encodeURIComponent(article.paragraphs[index])}&voice=${selectedEdgeVoice}`;
    }

    audioRef.current.src = src;
    audioRef.current.playbackRate = speechRate;

    audioRef.current.onplay = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setIsLoading(false);
      // Revoke blob URL now that the audio element has loaded it
      if (src.startsWith('blob:')) URL.revokeObjectURL(src);
      // Kick off prefetch for the paragraph after this one
      prefetchNextParagraph(index, article);
    };

    audioRef.current.onended = () => {
      if (!isPausedRef.current && playingArticleIdRef.current === article.id) {
        playEdgeParagraph(index + 1, article);
      }
    };

    audioRef.current.onerror = () => {
      console.error("Edge TTS audio error");
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    setIsLoading(true);
    audioRef.current.play().catch(e => {
      console.error("Audio play failed:", e);
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    });
  };

  const handleParagraphClick = (index: number) => {
    if (!playingArticle) return;
    if (audioEngine === 'edge') {
      playEdgeParagraph(index, playingArticle);
    } else {
      speakParagraph(index, playingArticle);
    }
  };

  const playArticle = (article: Article, forceParagraphIndex?: number) => {
    setPlayingArticle(article);
    playingArticleIdRef.current = article.id;
    isPausedRef.current = false;
    
    const rawIdx = forceParagraphIndex !== undefined ? forceParagraphIndex : (article.progress || 0);
    const startIdx = Math.max(0, Math.min(rawIdx, article.paragraphs.length - 1));
    if (audioEngine === 'edge') {
      playEdgeParagraph(startIdx, article);
    } else {
      speakParagraph(startIdx, article);
    }
  };

  const handlePlayPause = () => {
    if (!playingArticle) return;
    
    if (audioEngine === 'edge' && audioRef.current) {
      if (isPlaying && !isPaused) {
        audioRef.current.pause();
        setIsPaused(true);
        isPausedRef.current = true;
      } else {
        if (!audioRef.current.src || activeParagraphIndex === -1) {
          playEdgeParagraph(playingArticle.progress || 0, playingArticle);
        } else {
          audioRef.current.play();
          setIsPaused(false);
          isPausedRef.current = false;
          setIsPlaying(true);
        }
      }
    } else {
      if (typeof window !== 'undefined') {
        if (isPlaying && !isPaused) {
          window.speechSynthesis.pause();
          setIsPaused(true);
          isPausedRef.current = true;
        } else {
          if (activeParagraphIndex === -1) {
            speakParagraph(playingArticle.progress || 0, playingArticle);
          } else {
            window.speechSynthesis.resume();
            setIsPaused(false);
            isPausedRef.current = false;
            setIsPlaying(true);
          }
        }
      }
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined') {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    revokePrefetchedBlob();
    setIsPlaying(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setActiveParagraphIndex(-1);
    setCurrentCharIndex(-1);
    setPlayingArticle(null);
    playingArticleIdRef.current = null;
  };

  const getArticlesList = (): Article[] => {
    try {
      const data = localStorage.getItem('articles');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  };

  const handleSkipForward = () => {
    if (!playingArticle) return;
    const list = getArticlesList();
    const idx = list.findIndex(a => a.id === playingArticle.id);
    if (idx !== -1 && idx < list.length - 1) {
      playArticle(list[idx + 1], 0);
    }
  };

  const handleSkipBackward = () => {
    if (!playingArticle) return;
    const list = getArticlesList();
    const idx = list.findIndex(a => a.id === playingArticle.id);
    if (idx > 0) {
      playArticle(list[idx - 1], 0);
    }
  };

  const handleEngineChange = (engine: 'device' | 'edge') => {
    setAudioEngine(engine);
    if (isPlaying) {
      handleStop();
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoiceName(e.target.value);
    if (isPlaying && audioEngine === 'device') {
      handleStop();
    }
  };

  const handleEdgeVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEdgeVoice(e.target.value);
    revokePrefetchedBlob(); // discard prefetch — wrong voice
    if (isPlaying && audioEngine === 'edge') {
      handleStop();
    }
  };

  const toggleSpeed = () => {
    setSpeechRate(prev => {
      const next = prev >= 2 ? 0.75 : prev + 0.25;
      if (audioRef.current && audioEngine === 'edge') {
        audioRef.current.playbackRate = next;
      }
      return next;
    });
  };

  const getProgressPercentage = () => {
    if (!playingArticle) return 0;
    if (activeParagraphIndex < 0) return (playingArticle.progress || 0) / playingArticle.paragraphs.length * 100;
    return (activeParagraphIndex / playingArticle.paragraphs.length) * 100;
  };

  const getRemainingTime = () => {
    if (!playingArticle) return 0;
    const totalPar = playingArticle.paragraphs.length;
    const current = activeParagraphIndex >= 0 ? activeParagraphIndex : (playingArticle.progress || 0);
    const progressFactor = current / totalPar;
    return playingArticle.duration * (1 - progressFactor);
  };

  return (
    <AudioPlayerContext.Provider value={{
      playingArticle,
      isPlaying,
      isPaused,
      activeParagraphIndex,
      currentCharIndex,
      speechRate,
      isLoading,
      audioEngine,
      voices,
      selectedVoiceName,
      selectedEdgeVoice,
      playArticle,
      handlePlayPause,
      handleStop,
      handleSkipForward,
      handleSkipBackward,
      handleParagraphClick,
      handleEngineChange,
      handleVoiceChange,
      handleEdgeVoiceChange,
      toggleSpeed,
      getProgressPercentage,
      getRemainingTime
    }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
