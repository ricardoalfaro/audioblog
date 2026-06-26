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
  isLoading: boolean;
  ttsError: string | null;
  queue: Article[];

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
  addToQueue: (article: Article) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [playingArticle, setPlayingArticle] = useState<Article | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  // Refs to fix stale closures in audio events
  const isPausedRef = useRef(false);
  const playingArticleIdRef = useRef<string | null>(null);
  // Increments on every new play session (new article, engine change, stop)
  // so in-flight TTS fetches from a previous session are discarded.
  const playSessionRef = useRef(0);
  const [queue, setQueue] = useState<Article[]>([]);
  const queueRef = useRef<Article[]>([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  const [speechRate, setSpeechRate] = useState(1);
  const [audioEngine, setAudioEngine] = useState<'device' | 'edge'>('edge');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState('es-MX-DaliaNeural');

  // Keep ref in sync so async prefetch callbacks always use the current voice
  useEffect(() => { selectedEdgeVoiceRef.current = selectedEdgeVoice; }, [selectedEdgeVoice]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Load persisted preferences on mount (client-only).
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
      const savedQueue = localStorage.getItem('playbackQueue');
      if (savedQueue) {
        const q: Article[] = JSON.parse(savedQueue);
        setQueue(q);
        queueRef.current = q;
      }
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
  const prefetchedVoiceRef = useRef<string>('');
  const selectedEdgeVoiceRef = useRef('es-MX-DaliaNeural');

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

  // iOS Safari requires audio.play() to be called synchronously within a user gesture.
  // Playing a silent clip on first interaction unlocks the audio element so that
  // subsequent async play() calls (after POST fetch) are allowed.
  useEffect(() => {
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    const unlock = () => {
      const el = audioRef.current;
      if (!el) return;
      el.src = SILENT_WAV;
      el.play().then(() => {
        el.pause();
        el.src = '';
        el.load();
      }).catch(() => {
        el.src = '';
      });
    };
    document.addEventListener('touchend', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  const updateArticleProgress = (article: Article, paragraphIndex: number, updateLastPlayed = false) => {
    try {
      const localData = localStorage.getItem('articles');
      if (localData) {
        const articlesList: Article[] = JSON.parse(localData);
        const index = articlesList.findIndex((a) => a.id === article.id);
        if (index !== -1) {
          articlesList[index].progress = paragraphIndex;
          if (updateLastPlayed) articlesList[index].lastPlayedAt = new Date().toISOString();
          localStorage.setItem('articles', JSON.stringify(articlesList));
        }
      }
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  };

  const saveArticleVoicePreference = (articleId: string, patch: Partial<Pick<Article, 'preferredEngine' | 'preferredEdgeVoice' | 'preferredVoiceName'>>) => {
    try {
      const localData = localStorage.getItem('articles');
      if (!localData) return;
      const list: Article[] = JSON.parse(localData);
      const idx = list.findIndex(a => a.id === articleId);
      if (idx !== -1) {
        Object.assign(list[idx], patch);
        localStorage.setItem('articles', JSON.stringify(list));
      }
    } catch {}
  };

  const speakParagraph = (index: number, article: Article) => {
    if (!article || typeof window === 'undefined') return;

    try {
      window.speechSynthesis.cancel();
    } catch (cancelErr) {
      console.warn('speechSynthesis.cancel error:', cancelErr);
    }

    // index -1 = title; index >= length = finished
    if (index < -1 || index >= article.paragraphs.length) {
      if (index >= article.paragraphs.length) {
        updateArticleProgress(article, article.paragraphs.length);
        if (queueRef.current.length > 0) {
          const [nextArticle, ...rest] = queueRef.current;
          setQueue(rest);
          queueRef.current = rest;
          try { localStorage.setItem('playbackQueue', JSON.stringify(rest)); } catch {}
          playArticle(nextArticle, 0);
          return;
        }
      }
      handleStop();
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(0);
    if (index >= 0) updateArticleProgress(article, index);

    const text = index === -1 ? article.title : article.paragraphs[index];
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

  // Convert audio ArrayBuffer to base64 data URL — more reliable than blob URLs
  // on iOS WebKit (standalone PWA mode rejects blob: URLs for media with MEDIA_ERR_SRC_NOT_SUPPORTED)
  const audioToDataUrl = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return `data:audio/mpeg;base64,${btoa(binary)}`;
  };

  const revokePrefetchedBlob = () => {
    if (prefetchedBlobUrlRef.current) {
      if (prefetchedBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(prefetchedBlobUrlRef.current);
      }
      prefetchedBlobUrlRef.current = null;
      prefetchedIndexRef.current = -1;
      prefetchedVoiceRef.current = '';
    }
  };

  const prefetchNextParagraph = (index: number, article: Article) => {
    const nextIndex = index + 1;
    if (nextIndex >= article.paragraphs.length) return;
    if (prefetchedIndexRef.current === nextIndex) return;

    revokePrefetchedBlob();

    const text = article.paragraphs[nextIndex];
    const voice = selectedEdgeVoiceRef.current;
    const sessionId = playSessionRef.current;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal,
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) return;
        if (
          playSessionRef.current !== sessionId ||
          playingArticleIdRef.current !== article.id ||
          selectedEdgeVoiceRef.current !== voice
        ) return;
        return res.arrayBuffer();
      })
      .then(buffer => {
        if (!buffer) return;
        prefetchedBlobUrlRef.current = audioToDataUrl(buffer);
        prefetchedIndexRef.current = nextIndex;
        prefetchedVoiceRef.current = voice;
      })
      .catch(() => { clearTimeout(timeoutId); });
  };

  const playEdgeParagraph = (index: number, article: Article, retries = 0) => {
    if (!audioRef.current || !article) return;

    try { window.speechSynthesis.cancel(); } catch {}

    // index -1 = title; index >= length = finished
    if (index < -1 || index >= article.paragraphs.length) {
      if (index >= article.paragraphs.length) {
        updateArticleProgress(article, article.paragraphs.length);
        if (queueRef.current.length > 0) {
          const [nextArticle, ...rest] = queueRef.current;
          setQueue(rest);
          queueRef.current = rest;
          try { localStorage.setItem('playbackQueue', JSON.stringify(rest)); } catch {}
          playArticle(nextArticle, 0);
          return;
        }
      }
      handleStop();
      return;
    }

    setActiveParagraphIndex(index);
    setCurrentCharIndex(-1);
    if (index >= 0) updateArticleProgress(article, index);

    const text = index === -1 ? article.title : article.paragraphs[index];
    const voice = selectedEdgeVoiceRef.current;

    // When playing the title, kick off prefetch for paragraph 0 immediately —
    // don't wait for onplay, since on cloud networks the title itself takes time
    // to load and that window is exactly when we should be fetching paragraph 0.
    if (index === -1) {
      prefetchNextParagraph(-1, article);
    }

    const onTTSError = (detail?: string) => {
      console.error(`Edge TTS error at index ${index}, attempt ${retries + 1}`, detail ?? '');
      if (retries < 1 && playingArticleIdRef.current === article.id && !isPausedRef.current) {
        setTimeout(() => {
          if (playingArticleIdRef.current === article.id && !isPausedRef.current) {
            revokePrefetchedBlob();
            playEdgeParagraph(index, article, retries + 1);
          }
        }, 1500);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setIsLoading(false);
        setTtsError(`Error de audio${detail ? ` [${detail}]` : ''}. Intenta de nuevo.`);
        setTimeout(() => setTtsError(null), 8000);
      }
    };

    const setupAndPlay = (audioSrc: string) => {
      if (!audioRef.current) return;

      audioRef.current.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
        setIsLoading(false);
        if (index >= 0) prefetchNextParagraph(index, article);
      };
      audioRef.current.onended = () => {
        if (!isPausedRef.current && playingArticleIdRef.current === article.id) {
          playEdgeParagraph(index + 1, article);
        }
      };
      audioRef.current.onerror = () => {
        const code = (audioRef.current?.error?.code ?? '?');
        onTTSError(`media ${code}`);
      };

      audioRef.current.src = audioSrc;
      audioRef.current.playbackRate = speechRate;
      setIsLoading(true);
      audioRef.current.play().catch(e => {
        console.error('Audio play() failed:', e?.name, e?.message);
        setIsPlaying(false);
        setIsPaused(false);
        setIsLoading(false);
        setTtsError(`play() bloqueado [${e?.name ?? 'error'}]. Intenta de nuevo.`);
        setTimeout(() => setTtsError(null), 8000);
      });
    };

    // Use prefetched blob if available and voice hasn't changed; otherwise fetch fresh
    if (index >= 0 && prefetchedIndexRef.current === index && prefetchedBlobUrlRef.current) {
      if (prefetchedVoiceRef.current === voice) {
        const blobUrl = prefetchedBlobUrlRef.current;
        prefetchedBlobUrlRef.current = null;
        prefetchedIndexRef.current = -1;
        prefetchedVoiceRef.current = '';
        setupAndPlay(blobUrl);
        return;
      }
      revokePrefetchedBlob();
    }

    setIsLoading(true);
    const ctrl = new AbortController();
    const ttsTimeout = setTimeout(() => ctrl.abort(), 30_000);
    const sessionId = playSessionRef.current;

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: ctrl.signal,
    })
      .then(res => {
        clearTimeout(ttsTimeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buffer => {
        if (playSessionRef.current !== sessionId || playingArticleIdRef.current !== article.id) return;
        if (!buffer || buffer.byteLength === 0) throw new Error('buffer vacío');
        setupAndPlay(audioToDataUrl(buffer));
      })
      .catch((err: unknown) => {
        clearTimeout(ttsTimeout);
        const msg = err instanceof Error ? err.message : 'fetch error';
        onTTSError(msg);
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
    playSessionRef.current += 1;
    // Hard-stop any ongoing audio from previous article to prevent cross-engine interference
    try { window.speechSynthesis.cancel(); } catch {}
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = '';
    }
    revokePrefetchedBlob();
    // If this article was queued, remove it so it doesn't play twice
    if (queueRef.current.find(a => a.id === article.id)) {
      const updated = queueRef.current.filter(a => a.id !== article.id);
      setQueue(updated);
      queueRef.current = updated;
      try { localStorage.setItem('playbackQueue', JSON.stringify(updated)); } catch {}
    }
    setPlayingArticle(article);
    playingArticleIdRef.current = article.id;
    isPausedRef.current = false;
    
    const rawIdx = forceParagraphIndex !== undefined ? forceParagraphIndex : (article.progress || 0);
    // If progress is at or beyond end (article was completed), restart from 0
    const startIdx = rawIdx >= article.paragraphs.length ? 0 : Math.max(0, rawIdx);
    const firstIdx = startIdx === 0 ? -1 : startIdx;
    updateArticleProgress(article, startIdx, true);

    // Restore per-article voice preferences if saved
    const engine = article.preferredEngine ?? audioEngine;
    if (article.preferredEngine) setAudioEngine(article.preferredEngine);
    if (article.preferredEdgeVoice) {
      setSelectedEdgeVoice(article.preferredEdgeVoice);
      // eslint-disable-next-line react-hooks/immutability
      selectedEdgeVoiceRef.current = article.preferredEdgeVoice;
    }
    if (article.preferredVoiceName) setSelectedVoiceName(article.preferredVoiceName);

    if (engine === 'edge') {
      playEdgeParagraph(firstIdx, article);
    } else {
      speakParagraph(firstIdx, article);
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
        if (!audioRef.current.src) {
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
          if (!utteranceRef.current) {
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
    playSessionRef.current += 1;
    if (typeof window !== 'undefined') {
      try { window.speechSynthesis.cancel(); } catch {}
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

  const addToQueue = (article: Article) => {
    setQueue(prev => {
      if (prev.find(a => a.id === article.id)) return prev;
      const next = [...prev, article];
      queueRef.current = next;
      try { localStorage.setItem('playbackQueue', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => {
      const next = prev.filter(a => a.id !== id);
      queueRef.current = next;
      try { localStorage.setItem('playbackQueue', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearQueue = () => {
    setQueue([]);
    queueRef.current = [];
    try { localStorage.removeItem('playbackQueue'); } catch {}
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
    playSessionRef.current += 1;
    setAudioEngine(engine);
    if (playingArticle) saveArticleVoicePreference(playingArticle.id, { preferredEngine: engine });
    if ((isPlaying || isLoading) && playingArticle) {
      try { window.speechSynthesis.cancel(); } catch {}
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      revokePrefetchedBlob();
      setIsPlaying(false);
      setIsPaused(false);
      isPausedRef.current = false;
      const idx = activeParagraphIndex >= 0 ? activeParagraphIndex : 0;
      if (engine === 'edge') {
        playEdgeParagraph(idx, playingArticle);
      } else {
        speakParagraph(idx, playingArticle);
      }
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoiceName(e.target.value);
    if (playingArticle) saveArticleVoicePreference(playingArticle.id, { preferredVoiceName: e.target.value });
    if (isPlaying && audioEngine === 'device') {
      handleStop();
    }
  };

  const handleEdgeVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // eslint-disable-next-line react-hooks/immutability
    selectedEdgeVoiceRef.current = e.target.value;
    setSelectedEdgeVoice(e.target.value);
    if (playingArticle) saveArticleVoicePreference(playingArticle.id, { preferredEdgeVoice: e.target.value });
    revokePrefetchedBlob();
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
      ttsError,
      audioEngine,
      voices,
      selectedVoiceName,
      selectedEdgeVoice,
      queue,
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
      getRemainingTime,
      addToQueue,
      removeFromQueue,
      clearQueue,
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
