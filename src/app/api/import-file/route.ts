import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import mammoth from 'mammoth';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { detectCategory } from '@/lib/categories';
import { extractParagraphs } from '@/lib/extractParagraphs';
import { detectLanguage, translateConcurrent, translateText, VALID_TRANSLATE_LANGS } from '@/lib/translation';

export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = new Set(['pdf', 'docx', 'html', 'htm', 'txt', 'md', 'markdown']);

function extensionOf(name: string) {
  return name.toLowerCase().split('.').pop() ?? '';
}

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Documento importado';
}

function textParagraphs(text: string) {
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map((item) => item.replace(/\s+/g, ' ').trim()).filter((item) => item.length > 0);
  return paragraphs.length > 1 ? paragraphs : text.split(/\r?\n/).map((item) => item.trim()).filter((item) => item.length > 15);
}

async function extractFile(file: File, bytes: Uint8Array) {
  const extension = extensionOf(file.name);
  const fallbackTitle = titleFromFilename(file.name);

  if (extension === 'pdf') {
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('FILE_INVALID');
    // pdf-parse usa pdf.js, que necesita CanvasFactory/worker en Node serverless. Cargarlos
    // recién para PDF evita que su runtime nativo afecte los imports HTML/DOCX/TXT.
    const { CanvasFactory } = await import('pdf-parse/worker');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes, CanvasFactory });
    try {
      // Ambos métodos cargan el documento internamente. Ejecutarlos en paralelo intenta
      // transferir el mismo buffer dos veces al worker de pdf.js en Vercel.
      const info = await parser.getInfo();
      const text = await parser.getText();
      return { title: info.info?.Title?.trim() || fallbackTitle, author: info.info?.Author?.trim() || 'Documento importado', paragraphs: textParagraphs(text.text) };
    } finally {
      await parser.destroy();
    }
  }

  if (extension === 'docx') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('FILE_INVALID');
    const converted = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
    const { document } = parseHTML(converted.value);
    const title = document.querySelector('h1')?.textContent?.trim() || fallbackTitle;
    return { title, author: 'Documento importado', paragraphs: extractParagraphs(converted.value, document.body?.textContent || '') };
  }

  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  if (extension === 'html' || extension === 'htm') {
    const { document } = parseHTML(text);
    const readable = new Readability(document).parse();
    return {
      title: readable?.title?.trim() || document.title?.trim() || fallbackTitle,
      author: readable?.byline?.trim() || 'Documento importado',
      paragraphs: extractParagraphs(readable?.content || text, readable?.textContent || document.body?.textContent || ''),
    };
  }
  return { title: fallbackTitle, author: 'Documento importado', paragraphs: textParagraphs(text) };
}

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 10, 60_000)) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  try {
    const data = await request.formData();
    const file = data.get('file');
    const translateTo = data.get('translateTo');
    const preferredLang = data.get('preferredLang');
    if (!(file instanceof File)) return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
    const extension = extensionOf(file.name);
    if (!EXTENSIONS.has(extension)) return NextResponse.json({ error: 'FILE_UNSUPPORTED' }, { status: 415 });
    if (file.size === 0) return NextResponse.json({ error: 'FILE_EMPTY' }, { status: 422 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
    if (translateTo === 'auto' && (typeof preferredLang !== 'string' || !VALID_TRANSLATE_LANGS.has(preferredLang))) return NextResponse.json({ error: 'TRANSLATE_LANG_INVALID' }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractFile(file, bytes);
    let { title, paragraphs } = extracted;
    const { author } = extracted;
    if (paragraphs.length === 0) return NextResponse.json({ error: extension === 'pdf' ? 'PDF_NO_TEXT' : 'FILE_EMPTY' }, { status: 422 });

    let effectiveTranslateTo = typeof translateTo === 'string' ? translateTo : 'auto';
    let detectedLang: string | null = null;
    if (effectiveTranslateTo === 'auto') {
      detectedLang = await detectLanguage(`${title} ${paragraphs[0] ?? ''}`.slice(0, 500));
      effectiveTranslateTo = detectedLang && detectedLang !== preferredLang ? String(preferredLang) : 'none';
    }
    let translationFailed = false;
    if (effectiveTranslateTo !== 'none' && effectiveTranslateTo !== 'original') {
      const [translatedTitle, translatedParagraphs] = await Promise.all([
        translateText(title, effectiveTranslateTo),
        translateConcurrent(paragraphs, effectiveTranslateTo, 5),
      ]);
      title = translatedTitle.text;
      paragraphs = translatedParagraphs.texts;
      translationFailed = translatedTitle.failed || translatedParagraphs.failed;
    }

    const content = paragraphs.join(' ');
    return NextResponse.json({
      title,
      author,
      url: `file:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
      excerpt: paragraphs[0].slice(0, 160) + '...',
      paragraphs,
      category: detectCategory(`${title} ${content}`),
      imageUrl: '',
      authorGender: null,
      translationFailed,
      detectedLang,
      translatedTo: effectiveTranslateTo !== 'none' && effectiveTranslateTo !== 'original' ? effectiveTranslateTo : null,
    });
  } catch (error) {
    console.error('[import-file] Error al extraer archivo:', error);
    return NextResponse.json({ error: error instanceof Error && error.message === 'FILE_INVALID' ? 'FILE_INVALID' : 'FILE_EXTRACT_FAILED' }, { status: 422 });
  }
}
