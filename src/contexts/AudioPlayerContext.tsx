'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { Article } from '@/types';
import { audioToDataUrl } from '@/lib/audioUtils';
import { getArticlesList, updateArticleProgress, saveArticleVoicePreference, flushArticleProgress } from '@/lib/articleStorage';
import { useQueue } from '@/hooks/useQueue';
import { useLocale } from '@/contexts/LocaleContext';

export const EDGE_VOICES = [
  // Variantes de español: México antes que España — es la región preferida por default (ver
  // uso de `EDGE_VOICES.find` en AppClient.tsx, que se queda con el primer match del idioma
  // cuando no hay una voz de la misma región ya seleccionada).
  { name: 'Dalia (México, Neural)', value: 'es-MX-DaliaNeural', lang: 'es-MX', gender: 'female' },
  { name: 'Jorge (México, Neural)', value: 'es-MX-JorgeNeural', lang: 'es-MX', gender: 'male' },
  { name: 'Alvaro (España, Neural)', value: 'es-ES-AlvaroNeural', lang: 'es-ES', gender: 'male' },
  { name: 'Elvira (España, Neural)', value: 'es-ES-ElviraNeural', lang: 'es-ES', gender: 'female' },
  { name: 'Aria (EE.UU., Neural)', value: 'en-US-AriaNeural', lang: 'en-US', gender: 'female' },
  { name: 'Guy (EE.UU., Neural)', value: 'en-US-GuyNeural', lang: 'en-US', gender: 'male' },
  { name: 'Francisca (Brasil, Neural)', value: 'pt-BR-FranciscaNeural', lang: 'pt-BR', gender: 'female' },
  { name: 'Antonio (Brasil, Neural)', value: 'pt-BR-AntonioNeural', lang: 'pt-BR', gender: 'male' },
  { name: 'Denise (Francia, Neural)', value: 'fr-FR-DeniseNeural', lang: 'fr-FR', gender: 'female' },
  { name: 'Henri (Francia, Neural)', value: 'fr-FR-HenriNeural', lang: 'fr-FR', gender: 'male' },
  { name: 'Katja (Alemania, Neural)', value: 'de-DE-KatjaNeural', lang: 'de-DE', gender: 'female' },
  { name: 'Conrad (Alemania, Neural)', value: 'de-DE-ConradNeural', lang: 'de-DE', gender: 'male' },
] as const;

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
  hasNext: boolean;
  hasPrevious: boolean;

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
  notifyLibraryChanged: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [playingArticle, setPlayingArticle] = useState<Article | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [audioProgressTick, setAudioProgressTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  // Refs to fix stale closures in audio events
  const isPausedRef = useRef(false);
  const playingArticleIdRef = useRef<string | null>(null);
  // Artículo "activo" en el reproductor — a diferencia de playingArticleIdRef, sobrevive a
  // handleStop() sin limpiarse. Sirve para (a) aplicar las preferencias de voz guardadas del
  // artículo (preferredEdgeVoice/preferredEngine/preferredVoiceName) solo la PRIMERA vez que
  // se reproduce en esta sesión del reproductor, no en cada play()/resume — de lo contrario
  // cualquier cambio manual de voz quedaba pisado en el siguiente play (bug reportado: cambiar
  // la voz nunca "pegaba"); y (b) persistir cambios de voz aunque el usuario haya detenido la
  // reproducción antes de cambiarla (handleStop pone playingArticle en null).
  const currentArticleIdRef = useRef<string | null>(null);
  // Increments on every new play session (new article, engine change, stop)
  // so in-flight TTS fetches from a previous session are discarded.
  const playSessionRef = useRef(0);
  const { queue, queueRef, addToQueue, removeFromQueue, consumeNextInQueue } = useQueue();
  const [speechRate, setSpeechRate] = useState(1);
  const [audioEngine, setAudioEngine] = useState<'device' | 'edge'>('edge');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState('es-MX-DaliaNeural');

  // Keep ref in sync so async prefetch callbacks always use the current voice
  useEffect(() => { selectedEdgeVoiceRef.current = selectedEdgeVoice; }, [selectedEdgeVoice]);
  // B22: la cadena onended/onend de cada párrafo llama a la siguiente dentro de un closure
  // congelado al iniciar esa reproducción — sin el ref, toggleSpeed cambiaría el párrafo
  // actual pero el siguiente volvería a la velocidad vieja.
  const speechRateRef = useRef(speechRate);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);

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
  const jingleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Prefetch state for Edge TTS double-buffering
  const prefetchedBlobUrlRef = useRef<string | null>(null);
  const prefetchedIndexRef = useRef<number>(-1);
  const prefetchedVoiceRef = useRef<string>('');
  const selectedEdgeVoiceRef = useRef('es-MX-DaliaNeural');

  // Load local voices
  useEffect(() => {
    if (!window.speechSynthesis) return;
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
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis?.cancel();
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

  // Init cortina musical (jingle) que suena antes de arrancar el TTS de un artículo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const jingle = new Audio('/jingle.mp3');
      jingleAudioRef.current = jingle;

      return () => {
        jingle.pause();
        jingle.src = '';
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
        const next = consumeNextInQueue();
        if (next) { playArticle(next, 0); return; }
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
    
    utterance.rate = speechRateRef.current;

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
        const next = consumeNextInQueue();
        if (next) { playArticle(next, 0); return; }
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
        // Ocultar spinner durante la espera del retry para que el usuario no vea un colgón
        setIsLoading(false);
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
        setTtsError(t('errors.audioError', { detail: detail ? ` [${detail}]` : '' }));
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
      audioRef.current.ontimeupdate = () => {
        const seconds = Math.floor(audioRef.current?.currentTime ?? 0);
        setAudioProgressTick((prev) => (prev === seconds ? prev : seconds));
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
      audioRef.current.playbackRate = speechRateRef.current;
      setIsLoading(true);
      const playCallSession = playSessionRef.current;
      audioRef.current.play().catch(e => {
        // AbortError significa que esta promesa fue interrumpida por una acción más
        // reciente (cambio de párrafo/artículo/voz que reasigna src o llama pause()) —
        // no es un error real, la reproducción nueva ya está en curso (B12)
        if (e?.name === 'AbortError' || playSessionRef.current !== playCallSession) return;
        console.error('Audio play() failed:', e?.name, e?.message);
        setIsPlaying(false);
        setIsPaused(false);
        setIsLoading(false);
        setTtsError(t('errors.playbackBlocked', { name: e?.name ?? 'error' }));
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
    const ttsTimeout = setTimeout(() => ctrl.abort(), 12_000);
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
        if (!buffer || buffer.byteLength === 0) throw new Error('EMPTY_BUFFER');
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
    const sessionId = playSessionRef.current;
    // Hard-stop any ongoing audio from previous article to prevent cross-engine interference
    try { window.speechSynthesis.cancel(); } catch {}
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.src = '';
    }
    if (jingleAudioRef.current) {
      jingleAudioRef.current.pause();
      jingleAudioRef.current.onended = null;
      jingleAudioRef.current.ontimeupdate = null;
      jingleAudioRef.current.currentTime = 0;
      jingleAudioRef.current.volume = 1;
    }
    revokePrefetchedBlob();
    // If this article was queued, remove it so it doesn't play twice
    if (queueRef.current.find(a => a.id === article.id)) {
      removeFromQueue(article.id);
    }
    setPlayingArticle(article);
    playingArticleIdRef.current = article.id;
    isPausedRef.current = false;
    
    const rawIdx = forceParagraphIndex !== undefined ? forceParagraphIndex : (article.progress || 0);
    // If progress is at or beyond end (article was completed), restart from 0
    const startIdx = rawIdx >= article.paragraphs.length ? 0 : Math.max(0, rawIdx);
    const firstIdx = startIdx === 0 ? -1 : startIdx;
    updateArticleProgress(article, startIdx, true);

    // Restore per-article voice preferences if saved — solo la primera vez que se reproduce
    // este artículo en la sesión actual (ver comentario de currentArticleIdRef arriba).
    let engine = audioEngine;
    if (currentArticleIdRef.current !== article.id) {
      currentArticleIdRef.current = article.id;
      engine = article.preferredEngine ?? audioEngine;
      if (article.preferredEngine) setAudioEngine(article.preferredEngine);
      if (article.preferredEdgeVoice) {
        setSelectedEdgeVoice(article.preferredEdgeVoice);
        // eslint-disable-next-line react-hooks/immutability
        selectedEdgeVoiceRef.current = article.preferredEdgeVoice;
      }
      if (article.preferredVoiceName) setSelectedVoiceName(article.preferredVoiceName);
    }

    const startPlayback = () => {
      if (engine === 'edge') {
        playEdgeParagraph(firstIdx, article);
      } else {
        speakParagraph(firstIdx, article);
      }
    };

    // Cortina musical solo al arrancar el artículo desde el principio (no al resumir/saltar párrafos).
    // Timeout de seguridad: si el jingle no carga/termina, no debe bloquear la escucha del artículo.
    const jingle = jingleAudioRef.current;
    if (firstIdx === -1 && jingle) {
      const FADE_MS = 500;
      setIsLoading(true);
      jingle.currentTime = 0;
      jingle.volume = 1;
      let advanced = false;
      const advanceToPlayback = () => {
        if (advanced) return;
        advanced = true;
        clearTimeout(safetyTimer);
        jingle.ontimeupdate = null;
        if (playSessionRef.current !== sessionId) return;
        startPlayback();
      };
      const safetyTimer = setTimeout(advanceToPlayback, 8000);
      jingle.ontimeupdate = () => {
        if (!isFinite(jingle.duration)) return;
        const remainingMs = (jingle.duration - jingle.currentTime) * 1000;
        if (remainingMs <= FADE_MS) {
          jingle.volume = Math.max(0, Math.min(1, remainingMs / FADE_MS));
        }
      };
      jingle.onended = advanceToPlayback;
      jingle.play().catch(advanceToPlayback);
    } else {
      startPlayback();
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
          const resumeSession = playSessionRef.current;
          audioRef.current.play().catch(e => {
            if (e?.name === 'AbortError' || playSessionRef.current !== resumeSession) return;
            console.error('Audio play() failed:', e?.name, e?.message);
            setIsPlaying(false);
            setIsPaused(false);
            setTtsError(t('errors.playbackBlocked', { name: e?.name ?? 'error' }));
            setTimeout(() => setTtsError(null), 8000);
          });
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
    flushArticleProgress(); // P6: persistir de inmediato el último progreso pendiente del debounce
    if (typeof window !== 'undefined') {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.src = '';
    }
    if (jingleAudioRef.current) {
      jingleAudioRef.current.pause();
      jingleAudioRef.current.onended = null;
      jingleAudioRef.current.ontimeupdate = null;
      jingleAudioRef.current.currentTime = 0;
      jingleAudioRef.current.volume = 1;
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

  // B28: además de por playingArticle?.id, recalcula cuando libraryVersion cambia — AppClient
  // llama a notifyLibraryChanged() tras cada import/delete, así que hasNext/hasPrevious no
  // quedan stale si la lista cambia sin cambiar el artículo en curso. Sigue memoizado (no
  // recalcula en cada word-boundary de la reproducción, ver P1) para no repetir el costo de
  // parsear toda la librería en cada render.
  const [libraryVersion, setLibraryVersion] = useState(0);
  const notifyLibraryChanged = () => setLibraryVersion(v => v + 1);
  const articleId = playingArticle?.id;
  const hasNext = useMemo(() => {
    if (!articleId) return false;
    const list = getArticlesList();
    const idx = list.findIndex(a => a.id === articleId);
    return idx !== -1 && idx < list.length - 1;
    // libraryVersion no se usa en el cuerpo — es un trigger deliberado de recálculo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, libraryVersion]);

  const hasPrevious = useMemo(() => {
    if (!articleId) return false;
    const list = getArticlesList();
    const idx = list.findIndex(a => a.id === articleId);
    return idx > 0;
    // libraryVersion no se usa en el cuerpo — es un trigger deliberado de recálculo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, libraryVersion]);

  const handleEngineChange = (engine: 'device' | 'edge') => {
    playSessionRef.current += 1;
    setAudioEngine(engine);
    if (playingArticle) saveArticleVoicePreference(playingArticle.id, { preferredEngine: engine });
    if ((isPlaying || isLoading) && playingArticle) {
      try { window.speechSynthesis.cancel(); } catch {}
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current.onerror = null; audioRef.current.ontimeupdate = null; audioRef.current.src = ''; }
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
    const targetArticleId = playingArticle?.id ?? currentArticleIdRef.current;
    if (targetArticleId) saveArticleVoicePreference(targetArticleId, { preferredVoiceName: e.target.value });
    // Reinicia el párrafo actual con la voz nueva sin perder el artículo en curso — usar
    // handleStop() acá (como antes) limpiaba playingArticle, así que al volver a dar play
    // el botón del reader ya no reconocía "mismo artículo en curso" y arrancaba de índice 0
    // en vez de retomar donde iba (bug reportado: la voz cambiaba pero reiniciaba desde el
    // principio). Mismo patrón que handleEngineChange.
    if ((isPlaying || isLoading) && playingArticle && audioEngine === 'device') {
      playSessionRef.current += 1;
      try { window.speechSynthesis.cancel(); } catch {}
      setIsPlaying(false);
      setIsPaused(false);
      isPausedRef.current = false;
      const idx = activeParagraphIndex >= 0 ? activeParagraphIndex : 0;
      speakParagraph(idx, playingArticle);
    }
  };

  const handleEdgeVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // eslint-disable-next-line react-hooks/immutability
    selectedEdgeVoiceRef.current = e.target.value;
    setSelectedEdgeVoice(e.target.value);
    const targetArticleId = playingArticle?.id ?? currentArticleIdRef.current;
    if (targetArticleId) saveArticleVoicePreference(targetArticleId, { preferredEdgeVoice: e.target.value });
    revokePrefetchedBlob();
    // Ídem handleVoiceChange: reinicia el párrafo actual en vez de handleStop(), que además
    // dejaba el <audio> con onerror/onended del párrafo anterior todavía enganchados —
    // reasignar src='' sobre un audio en curso dispara un error de media (code 4) que ese
    // handler viejo capturaba y mostraba como error real (bug reportado: "error de audio
    // media 4" al cambiar de voz sin detener la reproducción).
    if ((isPlaying || isLoading) && playingArticle && audioEngine === 'edge') {
      playSessionRef.current += 1;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.ontimeupdate = null;
        audioRef.current.src = '';
      }
      setIsPlaying(false);
      setIsPaused(false);
      isPausedRef.current = false;
      const idx = activeParagraphIndex >= 0 ? activeParagraphIndex : 0;
      playEdgeParagraph(idx, playingArticle);
    }
  };

  // handlePlayPause/handleSkipBackward/handleSkipForward son funciones planas que se
  // redefinen en cada render (memoizarlas en cascada arrastraría a playArticle/speakParagraph/
  // playEdgeParagraph y chocaría con la memoización automática del compiler). Se guarda la
  // versión más reciente en un ref — actualizado sin array de dependencias, así que corre en
  // cada render — para que el efecto de Media Session de abajo pueda llamarlas sin declararlas
  // como dependencia (evita el warning de exhaustive-deps sin tocar la lógica de reproducción).
  const latestHandlersRef = useRef({ handlePlayPause, handleSkipBackward, handleSkipForward });
  useEffect(() => {
    latestHandlersRef.current = { handlePlayPause, handleSkipBackward, handleSkipForward };
  });

  // Media Session API: expone metadata y controles a la lock screen / Control Center del SO
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;

    if (!playingArticle) {
      navigator.mediaSession.metadata = null;
      return;
    }

    // Sin fallback explícito, iOS/Safari elige su propio candidato (el favicon de 32x32)
    // y lo estira al tile grande del lock screen, quedando pixelado (B13)
    const artwork = playingArticle.imageUrl
      ? [{ src: playingArticle.imageUrl }]
      : [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: playingArticle.title,
      artist: playingArticle.author,
      artwork,
    });

    navigator.mediaSession.setActionHandler('play', () => latestHandlersRef.current.handlePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => latestHandlersRef.current.handlePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => latestHandlersRef.current.handleSkipBackward());
    navigator.mediaSession.setActionHandler('nexttrack', () => latestHandlersRef.current.handleSkipForward());
  }, [playingArticle]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    if (!playingArticle) {
      navigator.mediaSession.playbackState = 'none';
    } else {
      navigator.mediaSession.playbackState = isPlaying && !isPaused ? 'playing' : 'paused';
    }
  }, [playingArticle, isPlaying, isPaused]);

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
    const paragraphs = playingArticle.paragraphs;
    if (!paragraphs?.length) return 0;
    const idx = activeParagraphIndex >= 0 ? activeParagraphIndex : (playingArticle.progress || 0);
    const wordCounts = paragraphs.map(p => p.split(/\s+/).filter(Boolean).length || 1);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    if (totalWords === 0) return 0;
    return (wordCounts.slice(0, idx).reduce((a, b) => a + b, 0) / totalWords) * 100;
  };

  const getRemainingTime = () => {
    void audioProgressTick;
    if (!playingArticle) return 0;
    const paragraphs = playingArticle.paragraphs;
    if (!paragraphs?.length) return 0;
    const idx = activeParagraphIndex >= 0 ? activeParagraphIndex : (playingArticle.progress || 0);
    const wordCounts = paragraphs.map(p => p.split(/\s+/).filter(Boolean).length || 1);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    if (totalWords === 0) return 0;
    const safeRate = Math.max(0.25, speechRateRef.current);
    if (idx < 0) return playingArticle.duration / safeRate;

    const currentWords = wordCounts[idx] ?? 0;
    let currentParagraphProgress = 0;
    if (audioEngine === 'edge' && audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      currentParagraphProgress = Math.min(1, Math.max(0, audioRef.current.currentTime / audioRef.current.duration));
    } else if (currentCharIndex >= 0 && paragraphs[idx]) {
      const spokenText = paragraphs[idx].slice(0, currentCharIndex);
      const spokenWords = spokenText.split(/\s+/).filter(Boolean).length;
      currentParagraphProgress = Math.min(1, Math.max(0, spokenWords / currentWords));
    }

    const wordsAfterCurrent = wordCounts.slice(idx + 1).reduce((a, b) => a + b, 0);
    const wordsRemaining = (currentWords * (1 - currentParagraphProgress)) + wordsAfterCurrent;
    return (playingArticle.duration * (wordsRemaining / totalWords)) / safeRate;
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
      hasNext,
      hasPrevious,
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
      notifyLibraryChanged,
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
