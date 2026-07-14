import { NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts-universal';
import { rateLimit, getIP } from '@/lib/rate-limit';

export const maxDuration = 30;

const VALID_VOICE_RE = /^[a-zA-Z]{2,3}-[A-Z]{2,3}-[a-zA-Z]+Neural$/;
const MAX_TEXT_LENGTH = 5000;
// Hard cap para que un párrafo pegado sin puntuación (sin límite de troceo por
// oración) no genere un número desproporcionado de requests a Edge TTS.
const MAX_CHUNKS = 10;

// Trocea en oraciones para no cortar la prosodia a mitad de frase; si una
// oración sola supera el límite (texto sin puntuación), la parte en bloques duros.
function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < sentence.length; i += maxLen) {
        chunks.push(sentence.slice(i, i + maxLen));
      }
      continue;
    }
    if (current && (current.length + sentence.length) > maxLen) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function synthesizeChunk(text: string, voice: string): Promise<ArrayBuffer> {
  const tts = new EdgeTTS(text, voice);
  const result = await tts.synthesize();
  return result.audio.arrayBuffer();
}

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 60, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : 'es-MX-DaliaNeural';

    if (!text) {
      return NextResponse.json({ error: 'TEXT_REQUIRED' }, { status: 400 });
    }
    if (!VALID_VOICE_RE.test(voice)) {
      return NextResponse.json({ error: 'INVALID_VOICE' }, { status: 400 });
    }

    const chunks = chunkText(text, MAX_TEXT_LENGTH);
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json({ error: 'TEXT_TOO_LONG' }, { status: 400 });
    }

    const buffers = await Promise.all(chunks.map(chunk => synthesizeChunk(chunk, voice)));
    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    return new Response(combined, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Error in TTS endpoint:', error);
    return NextResponse.json(
      { error: 'TTS_INTERNAL' },
      { status: 500 }
    );
  }
}
