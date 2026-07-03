import { NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts-universal';
import { rateLimit, getIP } from '@/lib/rate-limit';

export const maxDuration = 30;

const VALID_VOICE_RE = /^[a-zA-Z]{2,3}-[A-Z]{2,3}-[a-zA-Z]+Neural$/;
const MAX_TEXT_LENGTH = 5000;

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
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'TEXT_TOO_LONG' }, { status: 400 });
    }
    if (!VALID_VOICE_RE.test(voice)) {
      return NextResponse.json({ error: 'INVALID_VOICE' }, { status: 400 });
    }

    const tts = new EdgeTTS(text, voice);
    const result = await tts.synthesize();
    const arrayBuffer = await result.audio.arrayBuffer();

    return new Response(arrayBuffer, {
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
