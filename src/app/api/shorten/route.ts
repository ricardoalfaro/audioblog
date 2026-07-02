import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rate-limit';

export const maxDuration = 10;

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 20, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url : '';
    if (!url) {
      return NextResponse.json({ error: 'url es requerida' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'url inválida' }, { status: 400 });
    }

    // Solo acortamos deep links propios (/app?...) — no exponer esto como shortener abierto para cualquier URL
    if (parsed.origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Solo se pueden acortar links de Audiodocs.' }, { status: 400 });
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const shortUrl = (await res.text()).trim();
    if (!shortUrl.startsWith('https://tinyurl.com/')) throw new Error('respuesta inesperada del acortador');

    return NextResponse.json({ shortUrl });
  } catch (error: unknown) {
    console.error('Error in shorten endpoint:', error);
    return NextResponse.json({ error: 'No se pudo acortar el link.' }, { status: 500 });
  }
}
