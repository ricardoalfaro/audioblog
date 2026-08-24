'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Article } from '@/types';
import { STATIC_CATEGORIES, detectCategory } from '@/lib/categories';
import { defaultArticles } from '@/data/defaultArticles';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { validateArticle, getArticlesList, backupAndResetCorruptedArticles, isQuotaExceededError } from '@/lib/articleStorage';
import { VALID_TRANSLATE_LANGS } from '@/lib/translation';
import { buildArticleFromScrape } from '@/lib/buildArticleFromScrape';
import BulkImportPanel from './BulkImportPanel';
import SplashScreen from '@/components/SplashScreen';
import { useLocale } from '@/contexts/LocaleContext';
import { translateApiError, DisplayError } from '@/lib/i18n/apiError';
import { getGradientClass } from '@/lib/gradientClass';
import {
  Trash, Pause, Play, MoreVert, MinusCircle, PlusCircle, List, Import, Headset, Drawer, Undo,
  Xmark, CheckCircle, Check, Refresh, Circle, FloppyDisk, DotsGrid3x3,
} from 'iconoir-react';


function HomeContent() {
  const router = useRouter();
  const { t, tCategory, locale, isLocaleReady } = useLocale();
  const [articles, setArticles] = useState<Article[]>([]);
  // Arranca en true: la lectura de localStorage es síncrona (dura ~0ms), así que sin esto
  // nunca se llega a pintar el estado de carga — pasa directo de "vacío" a poblado en el
  // mismo tick. Con esto, el primer render (server y cliente) ya muestra el skeleton (U17).
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'url' | 'list' | 'manual'>('url');
  
  // Scraper form state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('auto');
  // Regla de import: por defecto se detecta el idioma y se traduce al idioma de la interfaz
  // solo si difieren. El usuario puede conservar el original o elegir otro destino explícito.
  const [translateTo, setTranslateTo] = useState('auto');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [scrapeStep, setScrapeStep] = useState<0|1|2|3|4>(0);
  const [importSuccess, setImportSuccess] = useState(false);
  // R6: refleja el flag `translationFailed` de /api/scrape — antes, si Google Translate y
  // MyMemory fallaban los dos, el artículo se guardaba sin traducir sin que el usuario lo notara.
  const [importTranslationFailed, setImportTranslationFailed] = useState(false);
  // URL recibida por parámetro ?url= — se procesa después de que los artículos carguen
  const pendingAutoImportRef = useRef<{ url: string; lang?: string } | null>(null);
  const emptyAutoImportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyAutoImportDismissedRef = useRef(false);

  const { playArticle, playingArticle, handleStop, isPlaying, isPaused, handlePlayPause, activeParagraphIndex, addToQueue, removeFromQueue, queue, selectedEdgeVoice, notifyLibraryChanged } = useAudioPlayer();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const newArticlesCarouselRef = useRef<HTMLDivElement>(null);
  const listeningCarouselRef = useRef<HTMLDivElement>(null);
  const archivedCarouselRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Open import modal via custom event (desde la misma página) o URL param (navegando desde otra)
  useEffect(() => {
    const handler = () => setIsModalOpen(true);
    window.addEventListener('audiodocs:open-import', handler);

    const params = new URLSearchParams(window.location.search);
    if (params.get('open') === 'import') {
      setIsModalOpen(true);
      window.history.replaceState(null, '', '/app');
    }
    // Auto-import desde ?url=, o desde el Web Share Target del sistema (share_target
    // en el manifest): algunas apps ponen el enlace en `text` o `title` en vez de `url`.
    const firstUrlIn = (s: string | null) => s?.match(/https?:\/\/[^\s]+/)?.[0] ?? null;
    const urlParam = params.get('url');
    const sharedUrl = (urlParam && /^https?:\/\/.+/.test(urlParam))
      ? urlParam
      : (firstUrlIn(params.get('text')) ?? firstUrlIn(params.get('title')));
    if (sharedUrl) {
      // F8: si quien compartió el link tradujo el artículo, ?lang= hace que se importe ya traducido igual
      const lang = params.get('lang');
      pendingAutoImportRef.current = { url: sharedUrl, lang: lang && VALID_TRANSLATE_LANGS.has(lang) ? lang : undefined };
      window.history.replaceState(window.history.state, '', '/app');
    }

    return () => window.removeEventListener('audiodocs:open-import', handler);
  }, []);


  // Paste de URL desde cualquier lugar de la página abre el modal con el link ya pegado
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const text = e.clipboardData?.getData('text/plain')?.trim() ?? '';
      if (/^https?:\/\/.+/.test(text)) {
        e.preventDefault();
        setScrapeUrl(text);
        setModalTab('url');
        setIsModalOpen(true);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Para usuarios nuevos: si la biblioteca está vacía y no hacen nada durante 10s,
  // abrir el modal de importación una sola vez. Cualquier interacción real cancela el
  // disparo automático para no interrumpir a quien ya está explorando la pantalla.
  useEffect(() => {
    if (isLoading || articles.length > 0 || isModalOpen || emptyAutoImportDismissedRef.current) {
      if (emptyAutoImportTimerRef.current) {
        clearTimeout(emptyAutoImportTimerRef.current);
        emptyAutoImportTimerRef.current = null;
      }
      return;
    }

    const cancelAutoOpen = () => {
      emptyAutoImportDismissedRef.current = true;
      if (emptyAutoImportTimerRef.current) {
        clearTimeout(emptyAutoImportTimerRef.current);
        emptyAutoImportTimerRef.current = null;
      }
    };

    emptyAutoImportTimerRef.current = setTimeout(() => {
      emptyAutoImportDismissedRef.current = true;
      emptyAutoImportTimerRef.current = null;
      setModalTab('url');
      setIsModalOpen(true);
    }, 10_000);

    window.addEventListener('pointerdown', cancelAutoOpen, { once: true });
    window.addEventListener('keydown', cancelAutoOpen, { once: true });
    window.addEventListener('scroll', cancelAutoOpen, { once: true, passive: true });

    return () => {
      if (emptyAutoImportTimerRef.current) {
        clearTimeout(emptyAutoImportTimerRef.current);
        emptyAutoImportTimerRef.current = null;
      }
      window.removeEventListener('pointerdown', cancelAutoOpen);
      window.removeEventListener('keydown', cancelAutoOpen);
      window.removeEventListener('scroll', cancelAutoOpen);
    };
  }, [articles.length, isLoading, isModalOpen]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen && !isScraping) setIsModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isScraping]);

  // El modal tiene su propio scroll interno (overflow-y auto); sin esto, si quedó
  // scrolleado (ej. el usuario bajó hasta el botón Importar) y luego cambia de vista
  // dentro del mismo modal (al tab Manual, a los pasos de progreso, al éxito), esa
  // vista nueva aparece ya desplazada en vez de arrancar arriba.
  useEffect(() => {
    modalContentRef.current?.scrollTo({ top: 0 });
  }, [isModalOpen, modalTab, isScraping, importSuccess]);

  // Close card menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.('.card-menu-wrapper, .list-kebab-wrapper')) return;
      setOpenMenuId(null);
      setConfirmDeleteId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  // When a new article is imported (prepended to front), scroll the carousel back to start
  const firstNewArticleId = articles.find(a => !a.lastPlayedAt)?.id;
  useEffect(() => {
    newArticlesCarouselRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [firstNewArticleId]);

  const handlePlayDirectly = (e: React.MouseEvent, targetArticle: Article) => {
    e.preventDefault();
    if (playingArticle?.id === targetArticle.id) {
      handlePlayPause();
    } else {
      playArticle(targetArticle, targetArticle.progress || 0);
    }
  };

  // Manual form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  // withMinDuration: solo para la carga inicial (U17) — el refetch al cambiar de artículo
  // reproduciéndose (más abajo) debe seguir siendo instantáneo, si no cada play/skip mostraría
  // el skeleton completo tapando el reordenamiento en vivo del carrusel "Estás escuchando" (B20).
  const SKELETON_MIN_MS = 1500;
  const fetchArticles = (withMinDuration = false) => {
    const startedAt = Date.now();
    try {
      setIsLoading(true);
      const localData = localStorage.getItem('articles');
      if (localData) {
        let valid: Article[];
        try {
          const raw: unknown[] = JSON.parse(localData);
          valid = raw.filter(validateArticle);
        } catch (parseErr) {
          // R5: JSON corrupto — antes esto caía al catch de afuera sin limpiar `articles`
          // (setArticles nunca se llamaba) y cada carga futura repetía el mismo fallo para
          // siempre. Se hace backup de la clave rota y se resetea para arrancar en limpio.
          console.error('Error parseando articles de localStorage, se resetea:', parseErr);
          backupAndResetCorruptedArticles(localData);
          valid = [];
        }
        const pruned = pruneArticles(valid);
        try {
          localStorage.setItem('articles', JSON.stringify(pruned));
        } catch (writeErr) {
          // No hay UI de error acá (esto corre en cada carga, no en un submit de import) —
          // el estado en memoria sigue siendo correcto aunque no se pueda persistir todavía.
          console.error('Error guardando articles en localStorage:', writeErr);
        }
        setArticles(pruned);
      } else {
        setArticles([]);
      }
    } catch (err) {
      console.error('Error loading articles from localStorage:', err);
    } finally {
      if (withMinDuration) {
        const remaining = Math.max(0, SKELETON_MIN_MS - (Date.now() - startedAt));
        setTimeout(() => setIsLoading(false), remaining);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchArticles(true);
    const savedView = localStorage.getItem('viewMode') as 'grid' | 'list' | null;
    if (savedView) {
      setViewMode(savedView);
    }
  }, []);

  // R5: sin esto, dos pestañas abiertas divergen en silencio — cada una escribe 'articles'
  // sobre su propia copia en memoria y la última en guardar pisa a la otra sin avisar. El
  // evento `storage` solo dispara en las pestañas que NO hicieron el cambio (nunca en la que
  // escribió), así que es la señal correcta para refrescar sin loop.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'articles' || e.key === null) fetchArticles();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Refresh sections when the playing article changes (start, stop, next-in-queue).
  // Este efecto también corre en el montaje inicial (todo efecto corre una vez al montar,
  // sin importar sus dependencias) — sin el guard de abajo, pisaba el isLoading recién
  // seteado por el efecto de arriba y el skeleton (U17) desaparecía en el mismo tick, sin
  // llegar a mostrarse nunca pese al mínimo de duración.
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    fetchArticles();
  }, [playingArticle?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };


  // R5: localStorage.setItem puede tirar QuotaExceededError (nombre distinto por navegador,
  // ver isQuotaExceededError) — antes cualquier catch genérico de import lo mostraba como
  // "Error al importar el artículo", sin pista de que el problema es espacio agotado, no la
  // importación en sí. Se usa en los submits (import por URL y manual) para poder distinguirlo.
  const persistArticles = (list: Article[]): void => {
    try {
      localStorage.setItem('articles', JSON.stringify(list));
    } catch (err) {
      if (isQuotaExceededError(err)) {
        throw new DisplayError(t('errors.storageQuotaExceeded'));
      }
      throw err;
    }
  };

  // Persistencia de un artículo importado desde la pestaña "Lista" (BulkImportPanel) — mismo
  // patrón que la cola de persistencia de runScrape (B25: lee la copia fresca de localStorage
  // antes de escribir, para no pisar progress/lastPlayedAt de otras pestañas).
  const handleBulkArticleImported = (newArticle: Article) => {
    const freshArticles = getArticlesList();
    const updatedArticles = pruneArticles([newArticle, ...freshArticles]);
    setArticles(updatedArticles);
    persistArticles(updatedArticles);
    notifyLibraryChanged();
  };

  // --- Scraper / Import form submissions ---
  const resetScrapeForm = () => {
    setScrapeUrl('');
    setScrapeCategory('auto');
    setTranslateTo('auto');
  };

  const runScrape = async (url: string, redirectOnSuccess = false, translateToOverride?: string) => {
    setIsModalOpen(true);
    setIsScraping(true);
    setScrapeError('');
    setScrapeStep(1);
    setImportTranslationFailed(false);

    // translateToOverride: usado por el auto-import (F8, ?lang=) para no depender del
    // estado translateTo, que todavía no se actualizó cuando se llama a runScrape en el mismo tick
    const effectiveTranslateTo = translateToOverride ?? translateTo;
    const isTranslating = effectiveTranslateTo && effectiveTranslateTo !== 'none';
    const stepTimer1 = setTimeout(() => setScrapeStep(2), 2500);
    const stepTimer2 = isTranslating ? setTimeout(() => setScrapeStep(3), 5000) : null;

    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          translateTo: effectiveTranslateTo,
          preferredLang: effectiveTranslateTo === 'auto' ? locale : undefined,
        }),
      });

      clearTimeout(stepTimer1);
      if (stepTimer2) clearTimeout(stepTimer2);

      if (!scrapeRes.ok) {
        let errorMsg: string;
        try {
          const errData = await scrapeRes.json();
          errorMsg = translateApiError(t, errData, 'errors.scrapeGeneric', { tab: t('modal.manual') });
        } catch {
          errorMsg = t('errors.serverErrorStatus', { status: scrapeRes.status });
        }
        throw new DisplayError(errorMsg);
      }

      const scrapeData = await scrapeRes.json();
      setScrapeStep(scrapeData.translatedTo ? 4 : 3);

      if (scrapeData.translationFailed) setImportTranslationFailed(true);

      const newArticle = buildArticleFromScrape(scrapeData, {
        categoryOverride: scrapeCategory !== 'auto' ? scrapeCategory : undefined,
        selectedEdgeVoice,
      });

      // B25: usar la copia más fresca de localStorage (no el estado `articles`, que puede
      // estar stale si el player escribió progress/lastPlayedAt directo vía articleStorage.ts
      // desde el último fetchArticles) para no pisar esos cambios al persistir el import
      const freshArticles = getArticlesList();

      const existingArticle = freshArticles.find(a => a.url !== 'manual' && a.url.toLowerCase() === newArticle.url.toLowerCase());
      if (existingArticle) {
        setIsScraping(false);
        setScrapeStep(0);
        setIsModalOpen(false);
        resetScrapeForm();
        if (redirectOnSuccess) {
          router.replace(`/app/articles/${existingArticle.id}`);
        } else {
          router.push(`/app/articles/${existingArticle.id}`);
        }
        return;
      }

      const updatedArticles = pruneArticles([newArticle, ...freshArticles]);
      setArticles(updatedArticles);
      persistArticles(updatedArticles);
      notifyLibraryChanged(); // B28: hasNext/hasPrevious del reproductor pueden depender de esta lista

      setIsScraping(false);
      setScrapeStep(0);

      if (redirectOnSuccess) {
        setIsModalOpen(false);
        resetScrapeForm();
        router.replace(`/app/articles/${newArticle.id}`);
      } else {
        setImportSuccess(true);
        setTimeout(() => {
          setIsModalOpen(false);
          setImportSuccess(false);
          resetScrapeForm();
        }, 1600);
      }
    } catch (err: unknown) {
      clearTimeout(stepTimer1);
      if (stepTimer2) clearTimeout(stepTimer2);
      setScrapeStep(0);
      setScrapeError(err instanceof DisplayError ? err.message : t('errors.importGeneric'));
      setIsScraping(false);
    }
  };

  // Dispara el auto-import una vez que los artículos han cargado.
  useEffect(() => {
    // Esperar a que LocaleProvider lea el idioma real de localStorage. Esto importa para los
    // enlaces que abre la extensión: el primer render siempre parte en español por SSR.
    if (!isLoading && isLocaleReady && pendingAutoImportRef.current) {
      const { url, lang } = pendingAutoImportRef.current;
      pendingAutoImportRef.current = null;
      setScrapeUrl(url);
      if (lang) setTranslateTo(lang);
      runScrape(url, true, lang ?? 'auto');
    }
  }, [isLoading, isLocaleReady, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl) return;
    await runScrape(scrapeUrl, false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualContent) {
      setManualError(t('errors.manualFieldsRequired'));
      return;
    }

    setIsSavingManual(true);
    setManualError('');

    try {
      const paragraphs = manualContent.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

      if (paragraphs.length === 0) {
        throw new DisplayError(t('errors.manualNoParagraphs'));
      }

      const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length || 0;
      const durationSeconds = Math.max(30, Math.round((wordCount / 160) * 60));

      const newArticle: Article = {
        id: Date.now().toString(),
        title: manualTitle,
        author: 'Manual',
        url: 'manual',
        addedAt: new Date().toISOString(),
        category: detectCategory(manualTitle + ' ' + manualContent),
        excerpt: manualContent.slice(0, 160) + '...',
        duration: durationSeconds,
        paragraphs,
        imageUrl: undefined,
        progress: 0,
      };

      // B25: mergear desde la copia fresca de localStorage, ver comentario en runScrape
      const updatedArticles = pruneArticles([newArticle, ...getArticlesList()]);
      setArticles(updatedArticles);
      persistArticles(updatedArticles);
      notifyLibraryChanged(); // B28

      setIsSavingManual(false);
      setImportSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setImportSuccess(false);
        setManualTitle('');
        setManualContent('');
      }, 1600);
    } catch (err: unknown) {
      setManualError(err instanceof DisplayError ? err.message : t('errors.manualSaveGeneric'));
      setIsSavingManual(false);
    }
  };

  const handleDeleteArticle = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (playingArticle?.id === id) {
      handleStop();
    }

    removeFromQueue(id);
    // B25: mergear desde la copia fresca de localStorage, ver comentario en runScrape
    const updatedArticles = getArticlesList().filter((a) => a.id !== id);
    setArticles(updatedArticles);
    localStorage.setItem('articles', JSON.stringify(updatedArticles));
    notifyLibraryChanged(); // B28
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  // P4: memoizados porque el motor Edge dispara setAudioProgressTick/setCurrentCharIndex por
  // palabra durante la reproducción — sin useMemo, cada uno de esos renders repetía los ~6
  // filter/sort sobre toda la librería aunque `articles`/`selectedCategory` no hubieran cambiado.
  const filteredArticles = useMemo(() => articles.filter((article) => {
    return selectedCategory === 'Todos' || article.category === selectedCategory;
  }), [articles, selectedCategory]);

  const activeArticles = useMemo(
    () => articles.filter(a => !a.paragraphs?.length || (a.progress ?? 0) < a.paragraphs.length),
    [articles]
  );
  const filteredActiveArticles = useMemo(
    () => activeArticles.filter(a => selectedCategory === 'Todos' || a.category === selectedCategory),
    [activeArticles, selectedCategory]
  );
  const categories = useMemo(
    () => ['Todos', ...Array.from(new Set(activeArticles.map((a) => a.category).filter(Boolean)))],
    [activeArticles]
  );

  const listeningArticles = useMemo(() => filteredArticles
    .filter(a => a.lastPlayedAt && (!a.progress || a.progress < a.paragraphs.length))
    .sort((a, b) => (b.lastPlayedAt || '') > (a.lastPlayedAt || '') ? 1 : -1), [filteredArticles]);
  const newArticles = useMemo(() => filteredArticles.filter(a => !a.lastPlayedAt), [filteredArticles]);
  const archivedArticles = useMemo(
    () => filteredArticles.filter(a => a.paragraphs?.length && (a.progress ?? 0) >= a.paragraphs.length),
    [filteredArticles]
  );

  // Mismo problema que firstNewArticleId (línea 122): al reproducir un artículo se antepone
  // como primero en "Estás escuchando" (ordenado por lastPlayedAt desc). El overflow-anchor:
  // none de .listening-carousel (globals.css) evita que el navegador desplace scrollLeft para
  // "compensar" el nuevo primer hijo, pero si el usuario había scrolleado manualmente el
  // carrusel, hace falta este reset explícito para revelar la card recién activada. Sin
  // `behavior: 'smooth'`: una animación en curso podía quedar a mitad de camino si otro
  // re-render (ej. el fetchArticles que dispara el cambio de playingArticle) mutaba scrollLeft
  // mientras tanto — el salto instantáneo no tiene ese problema de carrera. Depende del id
  // sobre `articles` sin filtrar (no `filteredArticles`) para no disparar el reset al cambiar
  // de categoría, solo cuando cambia de verdad quién es el primero de "escuchando".
  const firstListeningArticleId = articles
    .filter(a => a.lastPlayedAt && (!a.progress || a.progress < a.paragraphs.length))
    .sort((a, b) => (b.lastPlayedAt || '') > (a.lastPlayedAt || '') ? 1 : -1)[0]?.id;
  useEffect(() => {
    if (listeningCarouselRef.current) listeningCarouselRef.current.scrollLeft = 0;
  }, [firstListeningArticleId]);

  const renderArticleCard = (article: Article, shapeClass: string) => {
    const isCurrentPlaying = playingArticle?.id === article.id && isPlaying && !isPaused;
    const progressIdx = article.id === playingArticle?.id && activeParagraphIndex >= 0
      ? activeParagraphIndex : (article.progress || 0);
    const queuePos = queue.findIndex(a => a.id === article.id);
    
    if (viewMode === 'list') {
      return (
        <div key={article.id} className="article-list-item" onClick={() => router.push(`/app/articles/${article.id}`)}>
          {confirmDeleteId === article.id && (
            <div className="card-delete-overlay card-delete-overlay--inline" onClick={e => e.stopPropagation()}>
              <div className="card-delete-overlay-info">
                <Trash className="card-delete-overlay-icon" />
                <p>{t('card.confirmDelete')}</p>
              </div>
              <div className="card-delete-overlay-actions">
                <button className="btn-confirm" onClick={(e) => { e.stopPropagation(); handleDeleteArticle(e, article.id); setConfirmDeleteId(null); }}>{t('card.delete')}</button>
                <button className="btn-cancel" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>{t('card.cancel')}</button>
              </div>
            </div>
          )}
          <div className={`list-img-wrapper ${!article.imageUrl ? getGradientClass(article.id) : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {article.imageUrl && <img src={article.imageUrl} alt={article.title} />}
          </div>
          <div className="list-item-content">
            <h3 className="list-item-title">{article.title}</h3>
            <div className="list-item-meta">
              {article.author} • {formatTime(article.duration)}
              {queuePos >= 0 && <span className="queue-pill">#{queuePos + 1} {t('card.inQueue')}</span>}
            </div>
          </div>
          <button
            className={`card-play-btn ${playingArticle?.id === article.id ? 'is-playing' : ''}`}
            onClick={(e) => { e.stopPropagation(); handlePlayDirectly(e, article); }}
            style={{ width: '32px', height: '32px', fontSize: '14px', flexShrink: 0 }}
          >
            {isCurrentPlaying ? <Pause /> : <Play />}
          </button>
          <div className="list-kebab-wrapper" onClick={e => e.stopPropagation()}>
            <button
              className="kebab-btn"
              style={{ opacity: 1, position: 'relative', top: 'auto', right: 'auto', marginLeft: '8px' }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === article.id ? null : article.id); }}
              title={t('card.moreOptions')}
            >
              <MoreVert />
            </button>
            {openMenuId === article.id && (
              <div className="card-menu card-menu--left">
                <button
                  className="card-menu-item"
                  onClick={(e) => { e.stopPropagation(); if (queue.find(a => a.id === article.id)) { removeFromQueue(article.id); } else { addToQueue(article); } setOpenMenuId(null); }}
                >
                  {queue.find(a => a.id === article.id)
                    ? <><MinusCircle /> {t('card.removeFromQueue')}</>
                    : <><PlusCircle /> {t('card.addToQueue')}</>}
                </button>
                <button
                  className="card-menu-item card-menu-item--danger"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(article.id); setOpenMenuId(null); }}
                >
                  <Trash /> {t('card.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={article.id} className={`article-card ${shapeClass}`} onClick={() => router.push(`/app/articles/${article.id}`)}>
        {confirmDeleteId === article.id && (
          <div className="card-delete-overlay" onClick={e => e.stopPropagation()}>
            <div className="card-delete-overlay-info">
              <Trash className="card-delete-overlay-icon" />
              <p>{t('card.confirmDelete')}</p>
            </div>
            <div className="card-delete-overlay-actions">
              <button className="btn-confirm" onClick={(e) => { e.stopPropagation(); handleDeleteArticle(e, article.id); setConfirmDeleteId(null); }}>{t('card.delete')}</button>
              <button className="btn-cancel" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>{t('card.cancel')}</button>
            </div>
          </div>
        )}
        <div className="card-menu-wrapper" onClick={e => e.stopPropagation()}>
          <button
            className="kebab-btn"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === article.id ? null : article.id); }}
            title={t('card.moreOptions')}
          >
            <MoreVert />
          </button>
          {openMenuId === article.id && (
            <div className="card-menu">
              <button
                className="card-menu-item"
                onClick={(e) => { e.stopPropagation(); if (queue.find(a => a.id === article.id)) { removeFromQueue(article.id); } else { addToQueue(article); } setOpenMenuId(null); }}
              >
                {queue.find(a => a.id === article.id)
                  ? <><MinusCircle /> {t('card.removeFromQueue')}</>
                  : <><PlusCircle /> {t('card.addToQueue')}</>}
              </button>
              <button
                className="card-menu-item card-menu-item--danger"
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(article.id); setOpenMenuId(null); }}
              >
                <Trash /> {t('card.delete')}
              </button>
            </div>
          )}
        </div>
        <div className="card-image-wrapper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {article.imageUrl ? <img src={article.imageUrl} alt={article.title} className="card-image" /> : <div className={`card-image ${getGradientClass(article.id)}`}></div>}
          <div className="card-gradient-overlay"></div>
          {queuePos >= 0 && (
            <div className="queue-badge">
              <List /> #{queuePos + 1}
            </div>
          )}
          <div className="card-title-wrapper">
            <h3 className="card-title" title={article.title}>{article.title}</h3>
          </div>
        </div>
        {article.lastPlayedAt && article.paragraphs.length > 0 && (
          <div className="card-progress-bar">
            <div className="card-progress-fill" style={{ width: `${Math.min(100, progressIdx / article.paragraphs.length * 100)}%` }} />
          </div>
        )}
        <div className="card-content">
          <div className="card-footer">
            <div className="card-meta">
              <span>{article.author}</span>
            </div>
            <button
              className={`card-play-btn ${playingArticle?.id === article.id ? 'is-playing' : ''}`}
              onClick={(e) => { e.stopPropagation(); handlePlayDirectly(e, article); }}
              title={isCurrentPlaying ? t('card.pause') : t('card.playNow')}
            >
              {isCurrentPlaying ? <Pause /> : <Play />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <main className="container app-main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

      {isLoading && <section className="tabs-container">
        <div className="skeleton-tabs">
          <div className="skeleton-block skeleton-tab" style={{ width: 48 }} />
          <div className="skeleton-block skeleton-tab" style={{ width: 76 }} />
          <div className="skeleton-block skeleton-tab" style={{ width: 60 }} />
          <div className="skeleton-block skeleton-tab" style={{ width: 88 }} />
        </div>
      </section>}

      {(articles.length > 0 && !isLoading) && <section className="tabs-container">
        <div className="tabs-scroll-wrapper">
          <div className="categories-scroll">
            {categories.map((category) => (
              <button
                key={category}
                className={`tab-item ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {tCategory(category)}
              </button>
            ))}
            {/* B31: spacer para que el degradado de .tabs-scroll-wrapper::after no tape el
                último tab real cuando el scroll llega al final */}
            <div className="categories-scroll-spacer" aria-hidden="true" />
          </div>
        </div>
        {/* En mobile las categorías van en un <select> compacto en vez de la barra scrolleable
            (que se oculta por CSS a partir de 600px) — libera espacio en esta barra sticky para
            que el CTA de Importar de abajo quede siempre fijo ahí, sin depender de scrollear
            hasta arriba para alcanzarlo. */}
        <select
          className="category-select sidebar-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label={t('reader.category')}
        >
          {categories.map((category) => (
            <option key={category} value={category}>{tCategory(category)}</option>
          ))}
        </select>
        <div className="view-toggles">
          <button
            className="view-btn active"
            onClick={() => toggleViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title={viewMode === 'grid' ? t('card.gridView') : t('card.listView')}
          >
            {viewMode === 'grid' ? <DotsGrid3x3 /> : <List />}
          </button>
          <button
            className="import-inline-btn tabs-import-btn"
            onClick={() => setIsModalOpen(true)}
            title={t('modal.importArticle')}
          >
            <Import /> {t('modal.import')}
          </button>
        </div>
      </section>}

      {isLoading ? (
        // U17: en vez de un spinner genérico, un preview de la forma real del contenido
        // (carruseles con cards) para que el usuario ya entienda cómo se organiza la librería.
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '24px' }}>
          <section>
            <div className="skeleton-section-header">
              <div className="skeleton-block skeleton-icon" />
              <div className="skeleton-block skeleton-title" style={{ width: 170 }} />
            </div>
            <div className="skeleton-cards-row">
              <div className="skeleton-block skeleton-card" />
              <div className="skeleton-block skeleton-card" />
              <div className="skeleton-block skeleton-card" />
            </div>
          </section>
          <section>
            <div className="skeleton-section-header">
              <div className="skeleton-block skeleton-icon" />
              <div className="skeleton-block skeleton-title" style={{ width: 140 }} />
            </div>
            <div className="skeleton-cards-row">
              <div className="skeleton-block skeleton-card" />
              <div className="skeleton-block skeleton-card" />
            </div>
          </section>
        </div>
      ) : (
        <>
          {(listeningArticles.length > 0 || filteredActiveArticles.length > 0 || archivedArticles.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '16px' }}>
              {listeningArticles.length > 0 && (
                <section>
                  <h2 className="section-title" style={{ marginBottom: '16px' }}><Headset style={{marginRight: '2px', fontSize: '16px'}} /> {t('app.listening')}</h2>
                  <div ref={listeningCarouselRef} className={viewMode === 'grid' ? 'listening-carousel' : 'articles-list'}>
                    {listeningArticles.map(article => renderArticleCard(article, 'card-vertical'))}
                  </div>
                </section>
              )}

              {newArticles.length > 0 && (
                <section>
                  <h2 className="section-title" style={{ marginBottom: '16px' }}>
                    <Drawer style={{ marginRight: '2px', fontSize: '16px' }} /> {t('app.readyToListen')}
                  </h2>
                  <div ref={newArticlesCarouselRef} className={viewMode === 'grid' ? 'listening-carousel' : 'articles-list'}>
                    {newArticles.map(article => renderArticleCard(article, 'card-vertical'))}
                  </div>
                </section>
              )}

              {archivedArticles.length > 0 && (
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>
                      <Undo style={{ marginRight: '6px', fontSize: '16px' }} /> {t('app.backToListen')}
                    </h2>
                  </div>
                  <div ref={archivedCarouselRef} className={viewMode === 'grid' ? 'listening-carousel archived-cards' : 'articles-list archived-cards'}>
                    {archivedArticles.map(article => renderArticleCard(article, 'card-vertical'))}
                  </div>
                </section>
              )}
            </div>
          )}

          {filteredActiveArticles.length === 0 && archivedArticles.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                {articles.length === 0 ? (
                  <>
                    <h3>{t('app.emptyLibraryTitle')}</h3>
                    <p>{t('app.emptyLibrarySubtitle')}</p>
                    <button className="btn btn-primary" style={{ marginTop: '24px', gap: '8px' }} onClick={() => setIsModalOpen(true)}>
                      <Import /> {t('app.importDocument')}
                    </button>
                  </>
                ) : (
                  <>
                    <h3>{t('app.emptyCategoryTitle')}</h3>
                    <p>{t('app.emptyCategorySubtitle')}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}


      {isModalOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => { if (!isScraping && !isSavingManual) setIsModalOpen(false); }}>
          <div
            ref={modalContentRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={t('modal.importArticle')}
            onClick={e => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={isScraping || isSavingManual} aria-label={t('modal.close')}>
              <Xmark />
            </button>

            {importSuccess ? (
              <div className="import-success">
                <CheckCircle className="success-icon" />
                <p>{t('modal.saved')}</p>
                <span>{t('modal.savedSubtitle')}</span>
                {importTranslationFailed && (
                  <span className="import-warning">{t('modal.translationFailedWarning')}</span>
                )}
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h2>{modalTab === 'manual' ? t('modal.createArticle') : t('modal.importArticle')}</h2>
                </div>

                <div className="modal-tabs">
                  <button className={`modal-tab-btn ${modalTab === 'url' ? 'active' : ''}`} onClick={() => setModalTab('url')}>
                    {t('modal.byUrl')}
                  </button>
                  <button className={`modal-tab-btn ${modalTab === 'list' ? 'active' : ''}`} onClick={() => setModalTab('list')}>
                    {t('modal.bulkTab')}
                  </button>
                  <button className={`modal-tab-btn ${modalTab === 'manual' ? 'active' : ''}`} onClick={() => setModalTab('manual')}>
                    {t('modal.manual')}
                  </button>
                </div>

                {modalTab === 'list' && (
                  <BulkImportPanel onArticleImported={handleBulkArticleImported} />
                )}

                {modalTab === 'url' && (
                  isScraping ? (
                    <div className="import-loading">
                      <div className="import-steps">
                        <div className={`import-step ${scrapeStep >= 1 ? 'active' : ''} ${scrapeStep > 1 ? 'done' : ''}`}>
                          <span className="step-icon">
                            {scrapeStep > 1 ? <Check /> : scrapeStep === 1 ? <Refresh className="icon-spin" /> : <Circle />}
                          </span>
                          {t('modal.stepReading')}
                        </div>
                        <div className={`import-step ${scrapeStep >= 2 ? 'active' : ''} ${scrapeStep > 2 ? 'done' : ''}`}>
                          <span className="step-icon">
                            {scrapeStep > 2 ? <Check /> : scrapeStep === 2 ? <Refresh className="icon-spin" /> : <Circle />}
                          </span>
                          {t('modal.stepExtracting')}
                        </div>
                        {translateTo && translateTo !== 'none' ? (
                          <>
                            <div className={`import-step ${scrapeStep >= 3 ? 'active' : ''} ${scrapeStep > 3 ? 'done' : ''}`}>
                              <span className="step-icon">
                                {scrapeStep > 3 ? <Check /> : scrapeStep === 3 ? <Refresh className="icon-spin" /> : <Circle />}
                              </span>
                              {t('modal.stepTranslating')}
                            </div>
                            <div className={`import-step ${scrapeStep >= 4 ? 'active' : ''}`}>
                              <span className="step-icon">
                                {scrapeStep === 4 ? <Refresh className="icon-spin" /> : <Circle />}
                              </span>
                              {t('modal.stepSaving')}
                            </div>
                          </>
                        ) : (
                          <div className={`import-step ${scrapeStep >= 3 ? 'active' : ''}`}>
                            <span className="step-icon">
                              {scrapeStep === 3 ? <Refresh className="icon-spin" /> : <Circle />}
                            </span>
                            {t('modal.stepSaving')}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleScrapeSubmit} className="modal-form">
                      <div>
                        <label className="form-label">{t('modal.articleUrl')}</label>
                        <input type="url" className="form-control" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://..." required autoFocus />
                      </div>
                      <div>
                        <label className="form-label">{t('modal.category')}</label>
                        <select className="form-control" value={scrapeCategory} onChange={e => setScrapeCategory(e.target.value)}>
                          <option value="auto">{t('modal.categoryAuto')}</option>
                          {STATIC_CATEGORIES.map(cat => <option key={cat} value={cat}>{tCategory(cat)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t('modal.translateTo')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('modal.optional')}</span></label>
                        <select className="form-control" value={translateTo} onChange={e => setTranslateTo(e.target.value)}>
                          <option value="auto">{t('modal.translateAuto')}</option>
                          <option value="none">{t('modal.translateNone')}</option>
                          <option value="es">{t('modal.langEs')}</option>
                          <option value="en">{t('modal.langEn')}</option>
                          <option value="pt">{t('modal.langPt')}</option>
                          <option value="de">{t('modal.langDe')}</option>
                          <option value="fr">{t('modal.langFr')}</option>
                        </select>
                      </div>
                      {scrapeError && <p className="modal-error">{scrapeError}</p>}
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        <Import /> {t('modal.import')}
                      </button>
                    </form>
                  )
                )}

                {modalTab === 'manual' && (
                  <form onSubmit={handleManualSubmit} className="modal-form">
                    <div>
                      <label className="form-label">{t('modal.title')}</label>
                      <input type="text" className="form-control" value={manualTitle} onChange={e => setManualTitle(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label className="form-label">{t('modal.content')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('modal.contentHint')}</span></label>
                      <textarea className="form-control" value={manualContent} onChange={e => setManualContent(e.target.value)} rows={8} required />
                    </div>
                    {manualError && <p className="modal-error">{manualError}</p>}
                    <button type="submit" className="btn btn-primary" disabled={isSavingManual} style={{ width: '100%', justifyContent: 'center' }}>
                      {isSavingManual ? <><Refresh className="icon-spin" /> {t('modal.saving')}</> : <><FloppyDisk /> {t('modal.saveArticle')}</>}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    
    </main>
    </>

  );
}


export { validateArticle };

export const pruneArticles = (loadedArticles: Article[]): Article[] => {
  const defaultIds = new Set(defaultArticles.map((a: Article) => a.id));
  const customArticles = loadedArticles.filter((a: Article) => !defaultIds.has(a.id));
  const activeDefaultArticles = loadedArticles.filter((a: Article) => defaultIds.has(a.id));

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  let prunedCustom = customArticles.filter((a: Article) => {
    if (!a.addedAt) return true;
    const addedTime = new Date(a.addedAt).getTime();
    return (now - addedTime) < thirtyDaysMs;
  });

  const MAX_CUSTOM_ARTICLES = 50;
  if (prunedCustom.length > MAX_CUSTOM_ARTICLES) {
    prunedCustom.sort((a: Article, b: Article) => {
      const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return timeB - timeA;
    });
    prunedCustom = prunedCustom.slice(0, MAX_CUSTOM_ARTICLES);
  }

  return [...prunedCustom, ...activeDefaultArticles];
};

export default function Home() {
  return (
    <>
      <SplashScreen />
      <HomeContent />
    </>
  );
}
