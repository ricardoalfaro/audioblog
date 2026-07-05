import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rate-limit';

export const maxDuration = 15;

const VALID_SOURCES = new Set(['recomendacion', 'redes', 'buscador', 'prensa', 'otro']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBHOOK_TIMEOUT_MS = 8000;

export async function POST(request: Request) {
  const ip = getIP(request);
  if (!rateLimit(`leads:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const { name, email, source, website } = (body ?? {}) as Record<string, unknown>;

  // Honeypot: los bots lo llenan, las personas no. Respondemos OK sin guardar.
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  if (
    typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 ||
    typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.trim().length > 120 ||
    typeof source !== 'string' || !VALID_SOURCES.has(source)
  ) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  if (!webhookUrl) {
    // Sin webhook configurado (dev): no bloqueamos el flujo, pero queda rastro en logs
    console.warn('[leads] LEADS_WEBHOOK_URL no configurada; lead no persistido:', email.trim());
    return NextResponse.json({ ok: true });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source,
        createdAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[leads] webhook respondió', res.status);
      return NextResponse.json({ error: 'LEAD_INTERNAL' }, { status: 502 });
    }
  } catch (err) {
    console.error('[leads] fallo al llamar al webhook:', err);
    return NextResponse.json({ error: 'LEAD_INTERNAL' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  return NextResponse.json({ ok: true });
}
