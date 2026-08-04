import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { translateConcurrent, translateText, VALID_TRANSLATE_LANGS } from '@/lib/translation';

export const maxDuration = 30;

const MAX_TEXT_CHARS = 120_000;
const MAX_PARAGRAPHS = 500;

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 10, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
    const paragraphs = Array.isArray(body.paragraphs)
      ? body.paragraphs.filter((p: unknown): p is string => typeof p === 'string').map((p: string) => p.trim()).filter(Boolean)
      : [];

    if (!VALID_TRANSLATE_LANGS.has(targetLang)) {
      return NextResponse.json({ error: 'TRANSLATE_LANG_INVALID' }, { status: 400 });
    }
    if (!title && paragraphs.length === 0) {
      return NextResponse.json({ error: 'TEXT_REQUIRED' }, { status: 400 });
    }
    if (paragraphs.length > MAX_PARAGRAPHS || title.length + excerpt.length + paragraphs.join('\n\n').length > MAX_TEXT_CHARS) {
      return NextResponse.json({ error: 'TEXT_TOO_LONG' }, { status: 400 });
    }

    const [titleResult, excerptResult, paragraphsResult] = await Promise.all([
      translateText(title, targetLang),
      translateText(excerpt, targetLang),
      translateConcurrent(paragraphs, targetLang, 5),
    ]);

    return NextResponse.json({
      title: titleResult.text,
      excerpt: excerptResult.text,
      paragraphs: paragraphsResult.texts,
      // R6: mismo flag que /api/scrape — ver translation.ts
      translationFailed: titleResult.failed || excerptResult.failed || paragraphsResult.failed,
    });
  } catch (error: unknown) {
    console.error('Error in translate endpoint:', error);
    return NextResponse.json({ error: 'TRANSLATE_INTERNAL' }, { status: 500 });
  }
}
