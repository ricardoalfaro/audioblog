import { NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import dns from 'node:dns/promises';
import { rateLimit, getIP } from '@/lib/rate-limit';

export const maxDuration = 30;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function isPrivateIP(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 240
    );
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertSafeURL(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SSRF_BLOCKED');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1') {
    throw new Error('SSRF_BLOCKED');
  }
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('DNS_FAIL');
  }
  if (records.some(r => isPrivateIP(r.address))) {
    throw new Error('SSRF_BLOCKED');
  }
}

const MAX_REDIRECTS = 5;

async function safeFetch(url: string, options: RequestInit): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafeURL(current);
    const res = await fetch(current, { ...options, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Redirect sin Location header.');
      current = new URL(loc, current).toString();
    } else {
      return res;
    }
  }
  throw new Error('Demasiados redirects.');
}

// Helper function to translate text using Google Translate free endpoint
async function translateWithGoogle(text: string, targetLang: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Google returns: [[[translatedSegment, originalSegment, ...], ...], ...]
    return (json[0] as [string, ...unknown[]][])?.map((part) => part[0]).join('') || null;
  } catch {
    return null;
  }
}

async function translateWithMyMemory(text: string, targetLang: string): Promise<string | null> {
  try {
    const key = process.env.MYMEMORY_API_KEY;
    const qs = new URLSearchParams({ q: text, langpair: `en|${targetLang}` });
    if (key) qs.set('key', key);
    const res = await fetch(`https://api.mymemory.translated.net/get?${qs}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.responseStatus === 200 ? (json.responseData?.translatedText ?? null) : null;
  } catch {
    return null;
  }
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !targetLang || targetLang === 'original' || targetLang === 'none') return text;
  return (await translateWithGoogle(text, targetLang))
    ?? (await translateWithMyMemory(text, targetLang))
    ?? text;
}

// Detecta el género del primer nombre del autor con genderize.io, para autoseleccionar
// voz masculina/femenina en el cliente. Si el "autor" es en realidad un dominio (fallback
// cuando el artículo no tiene byline, ej. "paulgraham.com"), el nombre no pasa el filtro
// de caracteres válidos y se omite la llamada.
async function detectAuthorGender(author: string): Promise<'male' | 'female' | null> {
  try {
    const firstName = author.trim().split(/\s+/)[0];
    if (!firstName || firstName.length < 2 || !/^[a-zA-ZÀ-ÿ'-]+$/.test(firstName)) return null;
    const res = await fetch(`https://api.genderize.io/?name=${encodeURIComponent(firstName)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.gender === 'male' || json?.gender === 'female' ? json.gender : null;
  } catch {
    return null;
  }
}

async function translateConcurrent(items: string[], targetLang: string, concurrency: number): Promise<string[]> {
  const results = new Array<string>(items.length);
  const queue = items.map((item, i) => ({ item, i }));
  async function worker() {
    while (queue.length > 0) {
      const { item, i } = queue.shift()!;
      results[i] = await translateText(item, targetLang);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// Tags whose subtree we skip entirely (decorative / metadata)
const SKIP_TAGS = new Set([
  'FIGURE', 'FIGCAPTION', 'IMG', 'PICTURE', 'SUP', 'SUB',
  'STYLE', 'SCRIPT', 'NOSCRIPT', 'LABEL', 'CITE',
  'BUTTON', 'NAV', 'FORM', 'INPUT', 'FOOTER', 'ASIDE',
]);

// Block-level elements that act as paragraph boundaries
const BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'DIV', 'ARTICLE', 'SECTION', 'UL', 'OL', 'BLOCKQUOTE', 'TD', 'TH',
]);

const HEADER_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

// Patterns that identify junk paragraphs (image credits, read-time, bylines…)
const JUNK_RE = [
  /^\d+\s*min(ute)?\s*(read|de lectura)/i,
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d/i,
  /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+\d/i,
  /^press enter or (space|click)/i,
  /^imagen generada/i,
  /^image generated/i,
  /^(photo|foto)\s*(by|por|credit|:)/i,
  /^(fuente|source|credit|crédito)\s*:/i,
  /^--+$/,
  /^·+$/,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNoise(node: any): boolean {
  if (!node.getAttribute) return false;
  // Medium metadata elements only — matched by specific testId values
  const testId = node.getAttribute('data-testid') || '';
  if (testId && ['authorName','storyReadTime','storyPublishDate','publicationName',
                 'post-footer','overflow-button'].some(id => testId.includes(id))) return true;
  // NOTE: deliberately NOT checking aria-hidden — some CMSes (HubSpot) set
  // aria-hidden="true" on the main article container, which would skip all content.
  return false;
}

// Convierte HTML de contenido (el de Readability, o el de <content:encoded> de un RSS) en
// una lista de párrafos planos. Se extrajo a función standalone para poder reusarla tanto en
// el flujo normal como en los fallbacks de Medium (F13) sin duplicar la lógica de traversal.
function extractParagraphs(contentHtml: string, fallbackTextContent: string): string[] {
  const { document: doc } = parseHTML(contentHtml || '');

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  function flushParagraph(tagName: string) {
    if (currentParagraph.length === 0) return;
    const joined = currentParagraph.join(' ').replace(/\s+/g, ' ').trim();
    currentParagraph = [];
    if (!joined) return;
    // Keep headers even if short; body paragraphs need ≥ 15 chars
    const isHeader = HEADER_TAGS.has(tagName);
    if (!isHeader && joined.length < 15) return;
    if (JUNK_RE.some(rx => rx.test(joined))) return;
    paragraphs.push(joined);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function traverse(node: any) {
    if (!node) return;

    // TEXT_NODE (nodeType 3)
    if (node.nodeType === 3) {
      const text = (node.nodeValue || '').trim();
      if (text) currentParagraph.push(text);
      return;
    }

    // DOCUMENT_NODE (nodeType 9) — linkedom wraps parsed HTML in a document;
    // descend into its children directly
    if (node.nodeType === 9) {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
      return;
    }

    // ELEMENT_NODE (nodeType 1)
    if (node.nodeType !== 1) return;

    const tagName = (node.tagName || '').toUpperCase();

    if (SKIP_TAGS.has(tagName)) return;
    if (isNoise(node)) return;

    // <br> is a hard paragraph break (common in HubSpot / CMS editors)
    if (tagName === 'BR') {
      flushParagraph('BR');
      return;
    }

    const isBlock = BLOCK_TAGS.has(tagName);

    if (isBlock) flushParagraph(tagName);

    for (let i = 0; i < node.childNodes.length; i++) {
      traverse(node.childNodes[i]);
    }

    if (isBlock) flushParagraph(tagName);
  }

  traverse(doc);
  flushParagraph('DIV'); // final flush

  // Fallback if DOM traversal yielded nothing
  if (paragraphs.length === 0 && fallbackTextContent) {
    const rawLines = fallbackTextContent
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 15 && !JUNK_RE.some(rx => rx.test(line)));
    paragraphs.push(...rawLines);
  }

  return paragraphs;
}

interface ScrapedRaw {
  title: string;
  author: string;
  excerpt: string;
  paragraphs: string[];
  imageUrl: string;
}

// Pipeline completo de Readability + extracción de párrafos + og:image, a partir de HTML crudo.
// Se usa tanto para el fetch directo como para el HTML que devuelve el fallback de archive.org (F13).
function extractFromHtml(html: string): ScrapedRaw | null {
  // Algunos CMS (ej. df.cl) entregan el cuerpo real del artículo oculto con
  // display:none/visibility:hidden inline y lo revelan vía JS en el cliente
  // (paywalls suaves, contenido medido). Readability descarta esos nodos como
  // "no visibles" y elige un contenedor equivocado, así que los des-ocultamos
  // antes de parsear.
  const visibleHtml = html
    .replace(/display\s*:\s*none\s*;?/gi, '')
    .replace(/visibility\s*:\s*hidden\s*;?/gi, '');

  const { document } = parseHTML(visibleHtml);
  const reader = new Readability(document);
  const article = reader.parse();
  if (!article) return null;

  // Try to extract an og:image
  let imageUrl = '';
  const metaImages = [
    document.querySelector('meta[property="og:image:secure_url"]'),
    document.querySelector('meta[property="og:image"]'),
    document.querySelector('meta[name="twitter:image"]'),
    document.querySelector('meta[property="twitter:image"]'),
    document.querySelector('link[rel="image_src"]')
  ];

  for (const meta of metaImages) {
    if (meta) {
      const content = meta.getAttribute('content') || meta.getAttribute('href');
      if (content && content.startsWith('http')) {
        imageUrl = content;
        break;
      }
    }
  }

  if (!imageUrl && article.content) {
    const { document: articleDoc } = parseHTML(article.content);
    const firstImg = articleDoc.querySelector('img');
    if (firstImg) {
      const src = firstImg.getAttribute('src');
      if (src && src.startsWith('http')) {
        imageUrl = src;
      }
    }
  }

  const paragraphs = extractParagraphs(article.content || '', article.textContent || '');
  if (paragraphs.length === 0) return null;

  return {
    title: article.title || 'Artículo sin título',
    author: article.byline || '',
    excerpt: article.excerpt || paragraphs[0].slice(0, 160) + '...',
    paragraphs,
    imageUrl,
  };
}

// --- F13: cascada de fallbacks para artículos de Medium bloqueados por su protección anti-bots
// (Cloudflare challenge en el fetch directo, medium.com/*.medium.com únicamente — no se intenta
// derivar el usuario de dominios propios/custom). Orden: RSS del autor/publicación → archive.org.

function isMediumHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'medium.com' || h === 'www.medium.com' || h.endsWith('.medium.com');
}

function getMediumFeedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host === 'medium.com' || host === 'www.medium.com') {
      const first = u.pathname.split('/').filter(Boolean)[0];
      return first ? `https://medium.com/feed/${first}` : null;
    }
    if (host.endsWith('.medium.com')) {
      const sub = host.replace('.medium.com', '');
      return sub && sub !== 'www' ? `https://medium.com/feed/@${sub}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

// El identificador estable de un post de Medium es el hash hex al final de la URL/guid
// (ej. ".../software-2-0-a64152b37c35" o "medium.com/p/a64152b37c35") — el slug de texto
// puede variar entre el link del artículo y el del RSS, el hash no.
function getMediumHash(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    const m = last.match(/([0-9a-f]{8,})$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

// El feed RSS de Medium entrega el contenido completo del artículo sin muro de pago (a
// diferencia de la página del artículo, que sí lo aplica). Se parsea con regex en vez de
// DOM porque un parser HTML interpreta mal las secciones CDATA de XML (las convierte en
// comentarios) y el tag <link> como elemento vacío/void.
async function tryMediumRSS(targetUrl: string): Promise<ScrapedRaw | null> {
  const feedUrl = getMediumFeedUrl(targetUrl);
  const targetHash = getMediumHash(targetUrl);
  if (!feedUrl || !targetHash) return null;

  try {
    const res = await safeFetch(feedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) return null;
    const xml = await res.text();

    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(xml)) !== null) {
      const block = match[1];
      const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim();
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
      const hash = (guid && getMediumHash(guid)) || (link && getMediumHash(link));
      if (hash !== targetHash) continue;

      const contentEncoded = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1];
      if (!contentEncoded) return null;

      const paragraphs = extractParagraphs(contentEncoded, '');
      if (paragraphs.length === 0) return null;

      const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim();
      const author = block.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/)?.[1]?.trim();
      const { document: contentDoc } = parseHTML(contentEncoded);
      const firstImg = contentDoc.querySelector('img');
      const imageUrl = firstImg?.getAttribute('src') || '';

      return {
        title: title || 'Artículo sin título',
        author: author || 'Medium',
        excerpt: paragraphs[0]?.slice(0, 160) + '...',
        paragraphs,
        imageUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Última opción: la snapshot más reciente de archive.org puede tener el artículo cacheado
// desde antes de que el muro de pago se aplicara (o crawleado con acceso completo).
async function tryMediumArchive(targetUrl: string): Promise<ScrapedRaw | null> {
  try {
    const res = await safeFetch(`https://web.archive.org/web/2/${targetUrl}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractFromHtml(html);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 10, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }, { status: 429 });
  }

  try {
    const { url, translateTo } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'La URL es requerida' }, { status: 400 });
    }

    // URL format validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'La URL no es válida. Asegúrate de incluir http:// o https://' }, { status: 400 });
    }

    // Fetch — 10s timeout; safeFetch blocks private IPs and validates every redirect (SSRF, R1)
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response | null = null;
    let fetchBlocked = false;
    try {
      response = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });
    } catch (fetchErr: unknown) {
      clearTimeout(fetchTimeout);
      if ((fetchErr as Error).name === 'AbortError') {
        if (!isMediumHost(parsedUrl.hostname)) {
          return NextResponse.json({ error: 'El sitio no respondió a tiempo (timeout de 10 segundos).' }, { status: 504 });
        }
        fetchBlocked = true;
      } else if ((fetchErr as Error).message === 'SSRF_BLOCKED' || (fetchErr as Error).message === 'DNS_FAIL') {
        return NextResponse.json({ error: 'La URL no es válida. Asegúrate de incluir http:// o https://' }, { status: 400 });
      } else {
        throw fetchErr;
      }
    }
    clearTimeout(fetchTimeout);

    let scraped: ScrapedRaw | null = null;

    if (!fetchBlocked && response) {
      if (!response.ok) {
        if (isMediumHost(parsedUrl.hostname)) {
          fetchBlocked = true;
        } else {
          return NextResponse.json({ error: `No se pudo obtener el artículo: ${response.status} ${response.statusText}` }, { status: 500 });
        }
      } else {
        // Reject responses that are too large to avoid OOM (R4)
        const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_HTML_BYTES) {
          return NextResponse.json({ error: 'El artículo es demasiado grande para procesarlo.' }, { status: 413 });
        }

        const html = await response.text();
        if (html.length > MAX_HTML_BYTES) {
          return NextResponse.json({ error: 'El artículo es demasiado grande para procesarlo.' }, { status: 413 });
        }

        // Detect Cloudflare bot challenge (common on Medium and similar sites)
        const isChallenge = html.includes('id="challenge-running"') || html.includes('cf-browser-verification') || (html.includes('Just a moment') && html.includes('cloudflare'));
        if (isChallenge && isMediumHost(parsedUrl.hostname)) {
          fetchBlocked = true;
        } else if (isChallenge) {
          return NextResponse.json({
            error: 'Este sitio bloquea el acceso automático (protección anti-bots). Puedes copiar el texto del artículo y agregarlo usando la pestaña "Manual".'
          }, { status: 422 });
        } else {
          scraped = extractFromHtml(html);
          if (!scraped && isMediumHost(parsedUrl.hostname)) {
            fetchBlocked = true;
          } else if (!scraped) {
            return NextResponse.json({ error: 'No se pudo extraer contenido legible de este sitio web. Intenta copiarlo manualmente.' }, { status: 422 });
          }
        }
      }
    }

    // F13: fetch directo bloqueado en un artículo de Medium — cascada RSS → archive.org
    if (fetchBlocked && !scraped) {
      scraped = await tryMediumRSS(url);
      if (!scraped) scraped = await tryMediumArchive(url);

      if (!scraped) {
        return NextResponse.json({
          error: 'No se pudo importar este artículo de Medium (bloqueado por su protección anti-bots, ni el RSS del autor ni el archivo lo tienen disponible). Si es un artículo "member-only", pídele a quien te lo compartió el "friend link" de Medium y probá con esa URL, o copiá el texto manualmente.'
        }, { status: 422 });
      }
    }

    if (!scraped) {
      return NextResponse.json({ error: 'No se pudo extraer contenido legible de este sitio web. Intenta copiarlo manualmente.' }, { status: 422 });
    }

    if (scraped.paragraphs.length === 0) {
      return NextResponse.json({ error: 'No se encontraron párrafos de texto legibles.' }, { status: 422 });
    }

    // Clean up title, author and excerpt
    let title = scraped.title;
    const domain = parsedUrl.hostname.replace('www.', '');
    const author = scraped.author || domain;
    let excerpt = scraped.excerpt;
    let paragraphs = scraped.paragraphs;
    const imageUrl = scraped.imageUrl;
    // Se dispara ya para que corra en paralelo con la detección de categoría y la traducción
    const authorGenderPromise = detectAuthorGender(author);

    // Detect category based on original text (fixed list: General, Tecnología, Diseño, Negocios, Pagos, Seguros, Fintech, Política, Historia, Economía, Noticias)
    let category = 'General';
    const combinedText = (title + ' ' + excerpt + ' ' + paragraphs.join(' ')).toLowerCase();

    if (combinedText.includes('fintech') || combinedText.includes('banca digital')) {
      category = 'Fintech';
    } else if (combinedText.includes('pagos') || combinedText.includes('payment') || combinedText.includes('stripe')) {
      category = 'Pagos';
    } else if (combinedText.includes('seguros') || combinedText.includes('insurtech') || combinedText.includes('insurance')) {
      category = 'Seguros';
    } else if (combinedText.includes('economía') || combinedText.includes('economy') || combinedText.includes('mercado') || combinedText.includes('inflación')) {
      category = 'Economía';
    } else if (combinedText.includes('negocios') || combinedText.includes('business') || combinedText.includes('startup') || combinedText.includes('empresa')) {
      category = 'Negocios';
    } else if (combinedText.includes('tecnología') || combinedText.includes('tech') || combinedText.includes('software') || combinedText.includes('ia') || combinedText.includes('ai')) {
      category = 'Tecnología';
    } else if (combinedText.includes('diseño') || combinedText.includes('design') || combinedText.includes('ux') || combinedText.includes('ui')) {
      category = 'Diseño';
    } else if (combinedText.includes('política') || combinedText.includes('politics') || combinedText.includes('gobierno') || combinedText.includes('elecciones')) {
      category = 'Política';
    } else if (combinedText.includes('historia') || combinedText.includes('history') || combinedText.includes('pasado')) {
      category = 'Historia';
    } else if (combinedText.includes('noticias') || combinedText.includes('news') || combinedText.includes('última hora') || combinedText.includes('reporte')) {
      category = 'Noticias';
    }

    // Apply translation if chosen and not 'original'
    if (translateTo && translateTo !== 'original' && translateTo !== 'none') {
      try {
        title = await translateText(title, translateTo);
        excerpt = await translateText(excerpt, translateTo);

        // Translate paragraphs with capped concurrency to avoid hammering the translate API
        paragraphs = await translateConcurrent(paragraphs, translateTo, 5);
      } catch (transErr) {
        console.error('Failed to translate content:', transErr);
        // Fall back to original language on translation crash
      }
    }

    const authorGender = await authorGenderPromise;

    return NextResponse.json({
      title,
      author,
      authorGender,
      url,
      excerpt,
      paragraphs,
      category,
      imageUrl,
    });
  } catch (error: unknown) {
    console.error('Error in scrape endpoint:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar el artículo.' },
      { status: 500 }
    );
  }
}
