import { NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import { Agent } from 'undici';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { translateConcurrent, translateText, detectLanguage, VALID_TRANSLATE_LANGS } from '@/lib/translation';
import { withTimeout, TimeoutError } from '@/lib/withTimeout';
import { MemoryCache } from '@/lib/memoryCache';

export const maxDuration = 30;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// P5: reimportar/re-previsualizar la misma URL (con la misma traducción) repetía fetch +
// Readability + traducción completa desde cero. Cachea el resultado final ya procesado por
// (url, translateTo) dentro de la misma instancia serverless. TTL más corto que el de TTS
// (15 min, no 30) porque acá sí importa la frescura — el artículo fuente puede cambiar.
const scrapeCache = new MemoryCache<Record<string, unknown>>(60, 15 * 60_000);

function scrapeCacheKey(url: string, translateTo: unknown, preferredLang: unknown): string {
  const translatePart = typeof translateTo === 'string' ? translateTo : 'none';
  // El import masivo (translateTo:'auto') traduce a un idioma distinto según quién pida la
  // request — sin esto, dos usuarios/pestañas con preferredLang distinto compartirían la misma
  // key y uno se llevaría la traducción calculada para el otro.
  const preferredPart = translatePart === 'auto' && typeof preferredLang === 'string' ? preferredLang : '';
  return crypto.createHash('sha256').update(`${url}|${translatePart}|${preferredPart}`).digest('hex');
}

// S4: dns.lookup() puede devolver una IPv4 disfrazada de IPv6 — mapeada (::ffff:a.b.c.d o su
// forma hex ::ffff:XXXX:YYYY) o NAT64 (64:ff9b::/96, RFC 6052) — que isPrivateIP no reconocería
// como privada si se comparara tal cual contra los rangos v4. Se extrae la v4 embebida antes de
// clasificar.
function extractEmbeddedIPv4(ip: string): string | null {
  const v6 = ip.toLowerCase();
  let m = v6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (m) return m[1];
  m = v6.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (m) {
    const hi = parseInt(m[1], 16);
    const lo = parseInt(m[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

function isPrivateIP(ip: string): boolean {
  const v4 = (extractEmbeddedIPv4(ip) ?? ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
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

interface PinnedIP { address: string; family: number }

// S4: resuelve y valida el hostname UNA sola vez, devolviendo la IP concreta a usar. safeFetch
// obliga a undici a conectar exactamente a esa IP (ver dispatcher más abajo) en vez de dejar que
// fetch() vuelva a resolver el hostname por su cuenta — sin esto, un DNS malicioso podría
// responder una IP pública a esta validación y una privada al fetch real (DNS rebinding, TOCTOU).
async function resolveSafeIP(host: string): Promise<PinnedIP> {
  let records: PinnedIP[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('DNS_FAIL');
  }
  if (records.length === 0 || records.some(r => isPrivateIP(r.address))) {
    throw new Error('SSRF_BLOCKED');
  }
  return records[0];
}

async function assertSafeURL(rawUrl: string): Promise<PinnedIP> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SSRF_BLOCKED');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1') {
    throw new Error('SSRF_BLOCKED');
  }
  return resolveSafeIP(host);
}

const MAX_REDIRECTS = 5;

async function safeFetch(url: string, options: RequestInit): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const pinned = await assertSafeURL(current);
    // Pinning: el dispatcher intercepta la resolución DNS que undici haría internamente y le
    // impone la IP ya validada — el Host header y el SNI de TLS siguen viniendo de `current`
    // (la URL original), así que sitios con virtual hosting/TLS SNI siguen funcionando normal.
    const dispatcher = new Agent({
      connect: {
        // Node 20+ habilita Happy Eyeballs (RFC 8305) por default y pide la resolución con
        // { all: true }, esperando el callback en forma de array — sin esta rama, el intento
        // fallaba con "Invalid IP address: undefined" porque solo se cubría la firma legacy
        // (err, address, family) de un único resultado.
        lookup: (_hostname, opts, callback) => {
          if (opts && (opts as { all?: boolean }).all) {
            callback(null, [{ address: pinned.address, family: pinned.family }]);
          } else {
            callback(null, pinned.address, pinned.family);
          }
        },
      },
    });
    const init: RequestInit & { dispatcher?: Agent } = { ...options, redirect: 'manual', dispatcher };
    const res = await fetch(current, init);
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
    if (!res.ok) {
      console.warn(`[scrape] genderize.io respondió ${res.status} para "${firstName}"`);
      return null;
    }
    const json = await res.json();
    return json?.gender === 'male' || json?.gender === 'female' ? json.gender : null;
  } catch (err) {
    // R6: sin log, un fallo sistémico de genderize.io (ej. rate limit, caído) era indistinguible
    // de "este nombre puntual no se pudo clasificar" — no bloquea el import (F12 cae a voz por
    // defecto), pero antes no había ninguna forma de notarlo en los logs.
    console.warn('[scrape] genderize.io falló:', err instanceof Error ? err.message : err);
    return null;
  }
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
// o con muro de pago silencioso (200 OK pero contenido truncado — ej. dominios propios de
// publicaciones, como uxdesign.cc, que el usuario puede ver completo estando logueado en el
// navegador pero el scraper no). Orden: RSS del autor/publicación → archive.org.

function isMediumHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'medium.com' || h === 'www.medium.com' || h.endsWith('.medium.com');
}

// Medium inyecta estos meta tags en TODAS sus páginas, incluidos dominios propios de
// publicaciones (uxdesign.cc, blog.something.com, etc.) donde el hostname por sí solo no lo
// delata — así detectamos "esto es Medium" sin depender del dominio.
function isMediumPoweredHtml(html: string): boolean {
  return html.includes('al:ios:app_name" content="Medium"') || html.includes('al:android:app_name" content="Medium"');
}

// Medium marca en JSON-LD los artículos con muro de pago: `"isAccessibleForFree":false`. La
// página igual devuelve 200 OK con Readability parseando "algo" (el preview truncado), así que
// sin este chequeo el artículo se importaría cortado en silencio en vez de fallar o usar el fallback.
function isMediumPaywalledHtml(html: string): boolean {
  return html.includes('"isAccessibleForFree":false');
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
    // Dominio propio de una publicación (uxdesign.cc, etc.) — Medium suele exponer su
    // propio feed en <dominio>/feed sin necesidad de saber el slug de la publicación.
    return `${u.origin}/feed`;
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
async function tryMediumRSS(targetUrl: string, timeoutMs: number): Promise<ScrapedRaw | null> {
  const feedUrl = getMediumFeedUrl(targetUrl);
  const targetHash = getMediumHash(targetUrl);
  if (!feedUrl || !targetHash) return null;

  try {
    const res = await safeFetch(feedUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) {
      console.warn(`[scrape] RSS de Medium (${feedUrl}) respondió ${res.status}`);
      return null;
    }
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
    // R6: el feed respondió bien pero ningún <item> matcheó el hash del artículo pedido —
    // sin log esto era indistinguible de "el feed venía vacío" o "regex desactualizado".
    console.warn(`[scrape] RSS de Medium (${feedUrl}) no tenía ningún item con hash ${targetHash}`);
    return null;
  } catch (err) {
    console.warn('[scrape] RSS de Medium falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Última opción: la snapshot más reciente de archive.org puede tener el artículo cacheado
// desde antes de que el muro de pago se aplicara (o crawleado con acceso completo).
async function tryMediumArchive(targetUrl: string, timeoutMs: number): Promise<ScrapedRaw | null> {
  try {
    const res = await safeFetch(`https://web.archive.org/web/2/${targetUrl}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      console.warn(`[scrape] archive.org respondió ${res.status} para ${targetUrl}`);
      return null;
    }
    const html = await res.text();
    return extractFromHtml(html);
  } catch (err) {
    console.warn('[scrape] archive.org falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

// F22: x.com/twitter.com es una SPA — un fetch sin sesión recibe el shell vacío o un muro de
// login, Readability no encuentra texto real. Se resuelve vía APIs no oficiales de terceros
// (fxtwitter/vxtwitter, que reexponen la API interna de X como JSON estructurado) con
// fallback al oEmbed oficial de X (publish.twitter.com) si ambas fallan. Decisión consciente
// (confirmada con el usuario): fxtwitter/vxtwitter son estables en la práctica y ampliamente
// usados, pero no son un producto oficial de X — pueden bloquearse o desaparecer sin aviso;
// el fallback a oEmbed cubre ese caso con el tweet suelto (sin hilo/imágenes) en vez de fallar
// del todo.
function isTwitterHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'x.com' || h === 'www.x.com' || h === 'mobile.x.com' ||
    h === 'twitter.com' || h === 'www.twitter.com' || h === 'mobile.twitter.com';
}

// Extrae el ID numérico del tweet de cualquier variante de URL: /usuario/status/123,
// /usuario/statuses/123, /i/status/123, con o sin querystring.
function extractTweetId(rawUrl: string): string | null {
  try {
    const path = new URL(rawUrl).pathname;
    const m = path.match(/\/status(?:es)?\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

interface FxTwitterStatus {
  text?: string;
  author?: { name?: string; screen_name?: string };
  media?: {
    photos?: { url?: string }[];
    external?: { thumbnail_url?: string };
  };
}

interface FxTwitterThreadResponse {
  code?: number;
  status?: FxTwitterStatus | null;
  thread?: FxTwitterStatus[] | null;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '...' : text;
}

// El endpoint /2/thread de fxtwitter ("unrolled thread") ya devuelve los tweets del hilo en
// orden cuando el tweet pedido es parte de uno — no hace falta reconstruirlo a mano acá.
function mapFxTwitterThreadToScrapedRaw(data: FxTwitterThreadResponse): ScrapedRaw | null {
  const tweets = (data.thread && data.thread.length > 0) ? data.thread : (data.status ? [data.status] : []);
  if (tweets.length === 0) return null;

  const paragraphs = tweets.map(t => (t.text || '').trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;

  const firstAuthor = tweets[0].author;
  const author = firstAuthor?.screen_name
    ? `${firstAuthor.name || firstAuthor.screen_name} (@${firstAuthor.screen_name})`
    : 'X (Twitter)';

  // Primera imagen que aparezca en cualquier tweet del hilo — foto antes que thumbnail de video.
  let imageUrl = '';
  for (const t of tweets) {
    const photo = t.media?.photos?.[0]?.url;
    if (photo) { imageUrl = photo; break; }
    if (!imageUrl && t.media?.external?.thumbnail_url) imageUrl = t.media.external.thumbnail_url;
  }

  return {
    title: truncate(paragraphs[0], 80),
    author,
    excerpt: truncate(paragraphs[0], 160),
    paragraphs,
    imageUrl,
  };
}

async function tryFxTwitter(tweetId: string, timeoutMs: number): Promise<ScrapedRaw | null> {
  try {
    const res = await safeFetch(`https://api.fxtwitter.com/2/thread/${tweetId}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[scrape] fxtwitter respondió ${res.status} para tweet ${tweetId}`);
      return null;
    }
    const data = await res.json() as FxTwitterThreadResponse;
    return mapFxTwitterThreadToScrapedRaw(data);
  } catch (err) {
    console.warn('[scrape] fxtwitter falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

interface VxTwitterResponse {
  text?: string;
  user_name?: string;
  user_screen_name?: string;
  mediaURLs?: string[];
}

// vxtwitter no tiene un endpoint de "hilo" propio — solo devuelve el tweet suelto pedido.
// Segundo fallback (después de fxtwitter), no primero: fxtwitter reconstruye el hilo, esto no.
async function tryVxTwitter(tweetId: string, timeoutMs: number): Promise<ScrapedRaw | null> {
  try {
    const res = await safeFetch(`https://api.vxtwitter.com/i/status/${tweetId}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[scrape] vxtwitter respondió ${res.status} para tweet ${tweetId}`);
      return null;
    }
    const data = await res.json() as VxTwitterResponse;
    const text = (data.text || '').trim();
    if (!text) return null;
    const author = data.user_screen_name
      ? `${data.user_name || data.user_screen_name} (@${data.user_screen_name})`
      : 'X (Twitter)';
    return {
      title: truncate(text, 80),
      author,
      excerpt: truncate(text, 160),
      paragraphs: [text],
      imageUrl: data.mediaURLs?.[0] || '',
    };
  } catch (err) {
    console.warn('[scrape] vxtwitter falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Última opción: oEmbed oficial de X. Estable (es de X mismo, no un proxy no oficial) pero
// limitado — solo el tweet suelto (sin hilo), y el texto viene embebido en un <blockquote> de
// HTML en vez de JSON estructurado, así que no expone imágenes utilizables.
async function tryTwitterOEmbed(targetUrl: string, timeoutMs: number): Promise<ScrapedRaw | null> {
  try {
    const res = await safeFetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[scrape] oEmbed de X respondió ${res.status} para ${targetUrl}`);
      return null;
    }
    const data = await res.json() as { html?: string; author_name?: string };
    if (!data.html) return null;
    const { document } = parseHTML(data.html);
    const text = document.querySelector('p')?.textContent?.trim() || '';
    if (!text) return null;
    return {
      title: truncate(text, 80),
      author: data.author_name || 'X (Twitter)',
      excerpt: truncate(text, 160),
      paragraphs: [text],
      imageUrl: '',
    };
  } catch (err) {
    console.warn('[scrape] oEmbed de X falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

// R7: fxtwitter → vxtwitter → oEmbed son 3 intentos secuenciales — sin repartir el
// presupuesto entre ellos, el peor caso (los 3 lentos/colgados) podría sumar mucho más que
// el timeout individual de cada uno. `remaining` es el mismo reloj compartido de R7 (ver POST).
const MIN_TWITTER_STAGE_BUDGET_MS = 1500;

async function tryTwitter(targetUrl: string, remaining: () => number): Promise<ScrapedRaw | null> {
  const tweetId = extractTweetId(targetUrl);
  if (tweetId) {
    if (remaining() >= MIN_TWITTER_STAGE_BUDGET_MS) {
      const fx = await tryFxTwitter(tweetId, Math.min(8000, remaining()));
      if (fx) return fx;
    }
    if (remaining() >= MIN_TWITTER_STAGE_BUDGET_MS) {
      const vx = await tryVxTwitter(tweetId, Math.min(8000, remaining()));
      if (vx) return vx;
    }
  }
  if (remaining() >= MIN_TWITTER_STAGE_BUDGET_MS) {
    return tryTwitterOEmbed(targetUrl, Math.min(8000, remaining()));
  }
  return null;
}

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 10, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  // R7: la cascada de fallbacks (fetch 10s + RSS 8s + archive.org 15s) más la traducción
  // encima podían sumar bastante más que maxDuration=30 en el peor caso — Vercel mataba la
  // función a mitad de camino con un 504 sin cuerpo, en vez de un SCRAPE_TIMEOUT legible. Se
  // reparte un presupuesto de tiempo compartido: cada etapa usa el mínimo entre su timeout
  // original y lo que quede del presupuesto, dejando ~3s de margen bajo maxDuration para
  // parsear/serializar la respuesta.
  const deadline = Date.now() + 27_000;
  const remaining = () => deadline - Date.now();

  try {
    const { url, translateTo, preferredLang } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL_REQUIRED' }, { status: 400 });
    }
    if (translateTo === 'auto' && !VALID_TRANSLATE_LANGS.has(preferredLang)) {
      return NextResponse.json({ error: 'TRANSLATE_LANG_INVALID' }, { status: 400 });
    }

    const cacheKey = scrapeCacheKey(url, translateTo, preferredLang);
    const cachedResult = scrapeCache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // URL format validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL_INVALID' }, { status: 400 });
    }

    let scraped: ScrapedRaw | null = null;

    if (isTwitterHost(parsedUrl.hostname)) {
      // F22: x.com/twitter.com es una SPA — un fetch sin sesión nunca tiene texto real que
      // extraer con Readability (login wall / shell vacío), así que se salta directo a la
      // rama dedicada en vez de gastar el timeout del fetch normal en un intento condenado
      // a fallar.
      scraped = await tryTwitter(url, remaining);
    } else {
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
          // No solo Medium: sitios con bot-mitigation tipo Akamai (ej. mckinsey.com, confirmado
          // con curl — TLS handshake ok, cero bytes de respuesta, cuelga indefinidamente en vez
          // de devolver un 403/challenge) no dan ninguna señal salvo el timeout. archive.org
          // (tryMediumArchive pese al nombre no tiene nada específico de Medium — solo pide
          // `web.archive.org/web/2/<url>`) es un intento razonable antes de rendirse.
          fetchBlocked = true;
        } else if ((fetchErr as Error).message === 'SSRF_BLOCKED' || (fetchErr as Error).message === 'DNS_FAIL') {
          return NextResponse.json({ error: 'URL_INVALID' }, { status: 400 });
        } else {
          throw fetchErr;
        }
      }
      clearTimeout(fetchTimeout);

      if (!fetchBlocked && response) {
        if (!response.ok) {
          // 403/429/503 son los status típicos de bot-mitigation (Akamai, Cloudflare, etc. —
          // ej. mckinsey.com responde 403 acá aunque el mismo sitio cuelga la conexión sin
          // responder nada si se prueba con curl, el bloqueo no siempre se manifiesta igual).
          // Vale la pena intentar la cascada RSS/archive.org antes de rendirse, no solo para
          // Medium. Otros códigos (404, 500...) no son señal de bloqueo — ahí el fallback no
          // tiene sentido, se falla directo.
          if (isMediumHost(parsedUrl.hostname) || response.status === 403 || response.status === 429 || response.status === 503) {
            fetchBlocked = true;
          } else {
            return NextResponse.json({ error: 'FETCH_FAILED', httpStatus: response.status }, { status: 500 });
          }
        } else {
          // Reject responses that are too large to avoid OOM (R4)
          const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > MAX_HTML_BYTES) {
            return NextResponse.json({ error: 'CONTENT_TOO_LARGE' }, { status: 413 });
          }

          const html = await response.text();
          if (html.length > MAX_HTML_BYTES) {
            return NextResponse.json({ error: 'CONTENT_TOO_LARGE' }, { status: 413 });
          }

          // isMediumHost cubre medium.com/*.medium.com; isMediumPoweredHtml detecta además
          // dominios propios de publicaciones (uxdesign.cc, etc.) vía los meta tags que Medium
          // inyecta en toda página, sin depender del hostname.
          const isMediumPage = isMediumHost(parsedUrl.hostname) || isMediumPoweredHtml(html);

          // Detect Cloudflare bot challenge (common on Medium and similar sites)
          const isChallenge = html.includes('id="challenge-running"') || html.includes('cf-browser-verification') || (html.includes('Just a moment') && html.includes('cloudflare'));
          if (isChallenge && isMediumPage) {
            fetchBlocked = true;
          } else if (isChallenge) {
            return NextResponse.json({ error: 'ANTI_BOT_BLOCKED' }, { status: 422 });
          } else if (isMediumPage && isMediumPaywalledHtml(html)) {
            // 200 OK y Readability podría "parsear algo", pero es el preview truncado del muro
            // de pago — el usuario puede verlo completo en el navegador si está logueado en
            // Medium, pero el scraper (sin sesión) solo recibe el recorte. No usar ese contenido
            // parcial en silencio: directo a la cascada RSS → archive.org.
            fetchBlocked = true;
          } else {
            scraped = extractFromHtml(html);
            if (!scraped && isMediumPage) {
              fetchBlocked = true;
            } else if (!scraped) {
              return NextResponse.json({ error: 'EXTRACT_FAILED' }, { status: 422 });
            }
          }
        }
      }

      // F13: fetch directo bloqueado (Medium o cualquier otro sitio con bot-mitigation que
      // cuelga la conexión, ver comentario en el catch del AbortError más arriba) — cascada
      // RSS de Medium (no-op rápido si la URL no es de Medium, ver getMediumHash) → archive.org
      // (genérico, cualquier dominio).
      if (fetchBlocked && !scraped) {
        const MIN_STAGE_BUDGET_MS = 1500;
        if (remaining() < MIN_STAGE_BUDGET_MS) {
          return NextResponse.json({ error: 'SCRAPE_TIMEOUT' }, { status: 504 });
        }
        scraped = await tryMediumRSS(url, Math.min(8000, remaining()));
        if (!scraped && remaining() >= MIN_STAGE_BUDGET_MS) {
          scraped = await tryMediumArchive(url, Math.min(15_000, remaining()));
        }

        if (!scraped) {
          if (remaining() < MIN_STAGE_BUDGET_MS) {
            return NextResponse.json({ error: 'SCRAPE_TIMEOUT' }, { status: 504 });
          }
          // MEDIUM_BLOCKED trae texto específico de Medium (RSS del autor, "friend link") que
          // no aplica a otros sitios — ANTI_BOT_BLOCKED es el genérico que ya existía para el
          // caso de challenge de Cloudflare detectado en un sitio no-Medium (más arriba).
          return NextResponse.json(
            { error: isMediumHost(parsedUrl.hostname) ? 'MEDIUM_BLOCKED' : 'ANTI_BOT_BLOCKED' },
            { status: 422 },
          );
        }
      }
    }

    if (!scraped) {
      return NextResponse.json({ error: 'EXTRACT_FAILED' }, { status: 422 });
    }

    if (scraped.paragraphs.length === 0) {
      return NextResponse.json({ error: 'NO_PARAGRAPHS' }, { status: 422 });
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

    // translateTo:'auto' (import masivo, F-bulk): a diferencia del flujo manual, donde el
    // usuario ya eligió explícitamente traducir, acá hay que decidir SI corresponde traducir —
    // se detecta el idioma del artículo y solo se traduce si no coincide con preferredLang.
    // Detección conservadora: si falla, no se traduce (decisión confirmada con el usuario) en
    // vez de arriesgar traducir un artículo que ya estaba en su idioma.
    let detectedLang: string | null = null;
    let effectiveTranslateTo = translateTo;
    if (translateTo === 'auto') {
      if (remaining() < 1500) {
        console.warn('[scrape] Sin presupuesto de tiempo para detectar idioma, se conserva el idioma original');
        effectiveTranslateTo = 'none';
      } else {
        const sample = `${title} ${paragraphs[0] ?? ''}`.slice(0, 500);
        try {
          detectedLang = await withTimeout(detectLanguage(sample), remaining(), 'DETECT_TIMEOUT');
        } catch (detectErr) {
          console.warn('[scrape] Detección de idioma excedió el presupuesto de tiempo:', detectErr instanceof Error ? detectErr.message : detectErr);
          detectedLang = null;
        }
        effectiveTranslateTo = detectedLang && detectedLang !== preferredLang ? preferredLang : 'none';
      }
    }

    // Apply translation if chosen and not 'original'
    let translationFailed = false;
    if (effectiveTranslateTo && effectiveTranslateTo !== 'original' && effectiveTranslateTo !== 'none') {
      if (remaining() < 1500) {
        // R7: sin presupuesto para traducir sin arriesgar exceder maxDuration — se prioriza
        // devolver el artículo en el idioma original antes que colgar la request entera.
        console.warn('[scrape] Sin presupuesto de tiempo para traducir, se conserva el idioma original');
        translationFailed = true;
      } else {
        try {
          // Promise.all en vez de secuencial: además de más rápido, permite acotar las tres
          // traducciones a un único timeout compartido (remaining()) con withTimeout.
          const [titleResult, excerptResult, paragraphsResult] = await withTimeout(
            Promise.all([
              translateText(title, effectiveTranslateTo),
              translateText(excerpt, effectiveTranslateTo),
              // Translate paragraphs with capped concurrency to avoid hammering the translate API
              translateConcurrent(paragraphs, effectiveTranslateTo, 5),
            ]),
            remaining(),
            'TRANSLATE_TIMEOUT',
          );

          title = titleResult.text;
          excerpt = excerptResult.text;
          paragraphs = paragraphsResult.texts;
          // R6: antes esto se perdía en silencio para el cliente — el artículo se guardaba sin
          // traducir y el usuario no tenía forma de saber que no era lo que había pedido.
          translationFailed = titleResult.failed || excerptResult.failed || paragraphsResult.failed;
        } catch (transErr) {
          if (transErr instanceof TimeoutError) {
            console.error('[scrape] Traducción excedió el presupuesto de tiempo restante');
          } else {
            console.error('Failed to translate content:', transErr);
          }
          // Fall back to original language on translation crash or timeout
          translationFailed = true;
        }
      }
    }

    const authorGender = await authorGenderPromise;

    const translatedTo = effectiveTranslateTo !== 'original' && effectiveTranslateTo !== 'none' ? effectiveTranslateTo : null;

    const responseBody = {
      title,
      author,
      authorGender,
      url,
      excerpt,
      paragraphs,
      category,
      imageUrl,
      translationFailed,
      detectedLang,
      translatedTo,
    };
    // Solo se cachea el camino feliz completo — nunca las ramas de error (podrían ser
    // transitorias, ej. ANTI_BOT_BLOCKED puntual) ni resultados con la traducción degradada
    // por timeout, para no servir "sin traducir" en frío a la próxima request idéntica.
    if (!translationFailed) {
      scrapeCache.set(cacheKey, responseBody);
    }
    return NextResponse.json(responseBody);
  } catch (error: unknown) {
    console.error('Error in scrape endpoint:', error);
    return NextResponse.json(
      { error: 'SCRAPE_INTERNAL' },
      { status: 500 }
    );
  }
}
