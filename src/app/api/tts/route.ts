import { NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts-universal';
import { rateLimit, getIP } from '@/lib/rate-limit';

const VALID_VOICE_RE = /^[a-zA-Z]{2,3}-[A-Z]{2,3}-[a-zA-Z]+Neural$/;
const MAX_TEXT_LENGTH = 5000;

export async function POST(request: Request) {
  if (!rateLimit(getIP(request), 60, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : 'es-ES-AlvaroNeural';

    if (!text) {
      return NextResponse.json({ error: 'El texto es requerido' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'El texto es demasiado largo.' }, { status: 400 });
    }
    if (!VALID_VOICE_RE.test(voice)) {
      return NextResponse.json({ error: 'Voz no válida.' }, { status: 400 });
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
  } catch (error: any) {
    console.error('Error in TTS endpoint:', error);
    return NextResponse.json(
      { error: 'Error interno al generar el habla.' },
      { status: 500 }
    );
  }
}
