import { Article } from '@/types';

export function validateArticle(a: unknown): a is Article {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  return (
    typeof o.id === 'string' && o.id.length > 0 &&
    typeof o.title === 'string' &&
    typeof o.url === 'string' &&
    typeof o.addedAt === 'string' &&
    Array.isArray(o.paragraphs)
  );
}

export function getArticlesList(): Article[] {
  try {
    const data = localStorage.getItem('articles');
    if (!data) return [];
    const raw: unknown[] = JSON.parse(data);
    return raw.filter(validateArticle);
  } catch { return []; }
}

function writeProgressNow(article: Article, paragraphIndex: number, updateLastPlayed: boolean): void {
  try {
    const localData = localStorage.getItem('articles');
    if (localData) {
      const list: Article[] = JSON.parse(localData);
      const idx = list.findIndex((a) => a.id === article.id);
      if (idx !== -1) {
        list[idx].progress = paragraphIndex;
        if (updateLastPlayed) list[idx].lastPlayedAt = new Date().toISOString();
        localStorage.setItem('articles', JSON.stringify(list));
      }
    }
  } catch (err) {
    console.error('Error updating progress:', err);
  }
}

// P6: sin throttle, cada avance de párrafo parseaba+reescribía la librería completa
// (todos los artículos, con su texto) en localStorage — costoso en artículos largos o
// bibliotecas grandes. Se debounce por PROGRESS_DEBOUNCE_MS, colapsando ráfagas de avances
// (ej. saltar varios párrafos rápido) en una sola escritura con el último valor.
const PROGRESS_DEBOUNCE_MS = 1000;
let pendingProgress: { article: Article; paragraphIndex: number; updateLastPlayed: boolean } | null = null;
let progressDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function updateArticleProgress(
  article: Article,
  paragraphIndex: number,
  updateLastPlayed = false
): void {
  pendingProgress = { article, paragraphIndex, updateLastPlayed };
  if (progressDebounceTimer) clearTimeout(progressDebounceTimer);
  progressDebounceTimer = setTimeout(() => {
    progressDebounceTimer = null;
    flushArticleProgress();
  }, PROGRESS_DEBOUNCE_MS);
}

// Escribe inmediatamente cualquier progreso pendiente del debounce — se llama al detener la
// reproducción (handleStop) y en beforeunload, para no perder el último avance real si el
// usuario para de escuchar o cierra la pestaña dentro de la ventana de debounce.
export function flushArticleProgress(): void {
  if (progressDebounceTimer) {
    clearTimeout(progressDebounceTimer);
    progressDebounceTimer = null;
  }
  if (pendingProgress) {
    const { article, paragraphIndex, updateLastPlayed } = pendingProgress;
    pendingProgress = null;
    writeProgressNow(article, paragraphIndex, updateLastPlayed);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushArticleProgress);
}

export function saveArticleVoicePreference(
  articleId: string,
  patch: Partial<Pick<Article, 'preferredEngine' | 'preferredEdgeVoice' | 'preferredVoiceName'>>
): void {
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
}
