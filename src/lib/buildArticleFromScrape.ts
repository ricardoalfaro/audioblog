import { Article } from '@/types';
import { EDGE_VOICES } from '@/contexts/AudioPlayerContext';

// Forma mínima de lo que devuelve POST /api/scrape que este helper necesita — evita acoplar
// este módulo al tipo completo de la respuesta del endpoint.
export interface ScrapeResponseData {
  title?: string;
  author?: string;
  url?: string;
  category?: string;
  excerpt?: string;
  paragraphs?: string[];
  imageUrl?: string;
  authorGender?: string;
  translatedTo?: string | null;
}

export interface BuildArticleOptions {
  categoryOverride?: string; // scrapeCategory del modal, cuando no es 'auto'
  selectedEdgeVoice: string;
}

// Construye un Article listo para persistir a partir de la respuesta de /api/scrape — extraído
// de runScrape (AppClient.tsx) para que el import de una sola URL y el import masivo por lista
// compartan exactamente la misma lógica de duración estimada, excerpt y voz por género de autor.
export function buildArticleFromScrape(scrapeData: ScrapeResponseData, options: BuildArticleOptions): Article {
  const isTranslating = Boolean(scrapeData.translatedTo);
  const effectiveTranslateTo = scrapeData.translatedTo ?? undefined;

  const wordCount = scrapeData.paragraphs?.join(' ').split(/\s+/).filter(Boolean).length || 0;
  const durationSeconds = Math.max(30, Math.round((wordCount / 160) * 60));

  const newArticle: Article = {
    id: Date.now().toString(),
    title: scrapeData.title || 'Artículo sin título',
    author: scrapeData.author || 'Desconocido',
    url: scrapeData.url || 'manual',
    addedAt: new Date().toISOString(),
    category: options.categoryOverride ?? scrapeData.category ?? 'General',
    excerpt: scrapeData.excerpt || (scrapeData.paragraphs?.[0] ? scrapeData.paragraphs[0].slice(0, 160) + '...' : ''),
    duration: durationSeconds,
    paragraphs: scrapeData.paragraphs || [],
    imageUrl: scrapeData.imageUrl || undefined,
    progress: 0,
    translateTo: isTranslating ? effectiveTranslateTo : undefined,
  };

  // Autoseleccionar voz según género del autor (detectado server-side con genderize.io). Si el
  // import tradujo el artículo, la voz debe ser del idioma AL QUE se tradujo (para que la
  // experiencia sea coherente de punta a punta) — no del idioma de la voz que estaba en uso
  // antes de este import. Sin traducción, se mantiene el idioma actual (no sabemos con certeza
  // el idioma original del artículo). Si no se detecta género, se deja el default.
  if (scrapeData.authorGender === 'male' || scrapeData.authorGender === 'female') {
    const gender = scrapeData.authorGender;
    const targetLangPrefix = isTranslating
      ? effectiveTranslateTo
      : EDGE_VOICES.find((v) => v.value === options.selectedEdgeVoice)?.lang.split('-')[0];
    let matchedVoice: (typeof EDGE_VOICES)[number] | undefined;
    if (targetLangPrefix) {
      const currentVoice = EDGE_VOICES.find((v) => v.value === options.selectedEdgeVoice);
      // Preferir la misma región (ej. es-MX) que la voz actual, si coincide con el idioma
      // destino, antes de conformarse con la primera variante regional del idioma en
      // EDGE_VOICES — que por default es la mexicana (ver orden del array), no la española.
      if (currentVoice && currentVoice.lang.startsWith(targetLangPrefix)) {
        matchedVoice = EDGE_VOICES.find((v) => v.lang === currentVoice.lang && v.gender === gender);
      }
      matchedVoice ??= EDGE_VOICES.find((v) => v.lang.startsWith(targetLangPrefix) && v.gender === gender);
    }
    if (matchedVoice) newArticle.preferredEdgeVoice = matchedVoice.value;
  }

  return newArticle;
}
