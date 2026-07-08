import { Article } from '@/types';

export type ShareResult = 'shared' | 'copied' | 'skipped';

/**
 * Comparte un artículo: arma el deep link (`/app?url=…&ogTitle=…&ogImage=…&lang=…`) para que
 * el receptor lo importe (con preview OG, B10; e idioma de traducción, F8), lo acorta vía
 * TinyURL (F16, nunca bloquea si falla) y usa `navigator.share`; si no está disponible, cae a
 * copiar al portapapeles. Extraído del reader para reusarlo desde el GlobalPlayer sin duplicar.
 *
 * - `'shared'`: se abrió la hoja de compartir nativa.
 * - `'copied'`: no había Web Share API, se copió el link al portapapeles.
 * - `'skipped'`: artículo manual (sin URL de origen), no compartible.
 */
export async function shareArticle(article: Article): Promise<ShareResult> {
  if (!article || article.url === 'manual') return 'skipped';

  const params = new URLSearchParams({ url: article.url, ogTitle: article.title });
  if (article.imageUrl) params.set('ogImage', article.imageUrl);
  // F8: si este artículo se importó traducido, quien reciba el link lo importa ya traducido al mismo idioma
  if (article.translateTo) params.set('lang', article.translateTo);
  const deepLink = `${window.location.origin}/app?${params.toString()}`;

  // Acortamos vía TinyURL para que el link no arrastre los ~400-600 chars de url+ogTitle+ogImage.
  // Si falla (timeout, rate-limit, servicio caído), compartimos el link largo igual — nunca bloquea el share (F16)
  let shareLink = deepLink;
  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: deepLink }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.shortUrl) shareLink = data.shortUrl;
    }
  } catch {}

  if (navigator.share) {
    try {
      await navigator.share({ title: article.title, url: shareLink });
      return 'shared';
    } catch {}
  }
  await navigator.clipboard.writeText(shareLink);
  return 'copied';
}
