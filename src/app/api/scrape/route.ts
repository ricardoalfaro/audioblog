import { NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import dns from 'node:dns/promises';
import { rateLimit, getIP } from '@/lib/rate-limit';

export const maxDuration = 30;

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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'La URL no es válida. Asegúrate de incluir http:// o https://' }, { status: 400 });
    }

    // Fetch — 10s timeout; safeFetch blocks private IPs and validates every redirect (SSRF, R1)
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });
    } catch (fetchErr: unknown) {
      clearTimeout(fetchTimeout);
      if ((fetchErr as Error).name === 'AbortError') {
        return NextResponse.json({ error: 'El sitio no respondió a tiempo (timeout de 10 segundos).' }, { status: 504 });
      }
      if ((fetchErr as Error).message === 'SSRF_BLOCKED' || (fetchErr as Error).message === 'DNS_FAIL') {
        return NextResponse.json({ error: 'La URL no es válida. Asegúrate de incluir http:// o https://' }, { status: 400 });
      }
      throw fetchErr;
    }
    clearTimeout(fetchTimeout);

    if (!response.ok) {
      return NextResponse.json({ error: `No se pudo obtener el artículo: ${response.status} ${response.statusText}` }, { status: 500 });
    }

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
    if (html.includes('id="challenge-running"') || html.includes('cf-browser-verification') || (html.includes('Just a moment') && html.includes('cloudflare'))) {
      return NextResponse.json({
        error: 'Este sitio bloquea el acceso automático (protección anti-bots). Puedes copiar el texto del artículo y agregarlo usando la pestaña "Manual".'
      }, { status: 422 });
    }

    // Algunos CMS (ej. df.cl) entregan el cuerpo real del artículo oculto con
    // display:none/visibility:hidden inline y lo revelan vía JS en el cliente
    // (paywalls suaves, contenido medido). Readability descarta esos nodos como
    // "no visibles" y elige un contenedor equivocado, así que los des-ocultamos
    // antes de parsear.
    const visibleHtml = html
      .replace(/display\s*:\s*none\s*;?/gi, '')
      .replace(/visibility\s*:\s*hidden\s*;?/gi, '');

    // Parse with linkedom
    const { document } = parseHTML(visibleHtml);
    
    // Check if Readability can parse it
    const reader = new Readability(document);
    const article = reader.parse();

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

    if (!imageUrl && article?.content) {
      const { document: articleDoc } = parseHTML(article.content);
      const firstImg = articleDoc.querySelector('img');
      if (firstImg) {
        const src = firstImg.getAttribute('src');
        if (src && src.startsWith('http')) {
          imageUrl = src;
        }
      }
    }

    if (!article) {
      return NextResponse.json({ error: 'No se pudo extraer contenido legible de este sitio web. Intenta copiarlo manualmente.' }, { status: 422 });
    }

    // Parse readability's clean HTML content using linkedom to split it into structural paragraphs/headers
    const { document: doc } = parseHTML(article.content || '');

    let paragraphs: string[] = [];
    let currentParagraph: string[] = [];

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
    if (paragraphs.length === 0 && article.textContent) {
      const rawLines = article.textContent
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 15 && !JUNK_RE.some(rx => rx.test(line)));
      paragraphs.push(...rawLines);
    }

    if (paragraphs.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron párrafos de texto legibles.',
        _debug: {
          readabilityContentLength: article.content?.length ?? 0,
          readabilityTextSnippet: article.textContent?.slice(0, 500) ?? '',
        }
      }, { status: 422 });
    }

    // Clean up title, author and excerpt
    let title = article.title || 'Artículo sin título';
    const domain = new URL(url).hostname.replace('www.', '');
    const author = article.byline || domain;
    let excerpt = article.excerpt || paragraphs[0].slice(0, 160) + '...';
    // Se dispara ya para que corra en paralelo con la detección de categoría y la traducción
    const authorGenderPromise = detectAuthorGender(author);

    // Detect category based on original text (fixed list: General, Tecnología, Diseño, Negocios, Pagos, Seguros, Fintech, Política, Historia, Economía, Noticias)
    let category = 'General';
    const combinedText = (title + ' ' + excerpt + ' ' + (article.textContent || '')).toLowerCase();
    
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
