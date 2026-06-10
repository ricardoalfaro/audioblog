import { NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts-universal';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text');
    const voice = searchParams.get('voice') || 'es-ES-AlvaroNeural';

    if (!text) {
      return NextResponse.json({ error: 'El texto es requerido' }, { status: 400 });
    }

    // Initialize EdgeTTS
    const tts = new EdgeTTS(text, voice);
    const result = await tts.synthesize();
    
    // Get arrayBuffer from the blob
    const arrayBuffer = await result.audio.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // Cache the synthesized audio chunks since the text + voice combination is immutable
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Error in TTS endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al generar el habla.' },
      { status: 500 }
    );
  }
}
