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

export function updateArticleProgress(
  article: Article,
  paragraphIndex: number,
  updateLastPlayed = false
): void {
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
