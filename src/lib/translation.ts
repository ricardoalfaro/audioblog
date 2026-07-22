const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function translateWithGoogle(text: string, targetLang: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      console.warn(`[translation] Google Translate respondió ${res.status} (targetLang=${targetLang})`);
      return null;
    }
    const json = await res.json();
    return (json[0] as [string, ...unknown[]][])?.map((part) => part[0]).join('') || null;
  } catch (err) {
    // R6: antes esto se tragaba en silencio — sin log no había forma de distinguir "Google
    // Translate está caído para todos" de "este texto puntual falló" al revisar los logs.
    console.warn('[translation] Google Translate falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function translateWithMyMemory(text: string, targetLang: string): Promise<string | null> {
  try {
    const key = process.env.MYMEMORY_API_KEY;
    const qs = new URLSearchParams({ q: text, langpair: `autodetect|${targetLang}` });
    if (key) qs.set('key', key);
    const res = await fetch(`https://api.mymemory.translated.net/get?${qs}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[translation] MyMemory respondió ${res.status} (targetLang=${targetLang})`);
      return null;
    }
    const json = await res.json();
    if (json?.responseStatus !== 200) {
      console.warn('[translation] MyMemory responseStatus no OK:', json?.responseStatus, json?.responseDetails);
      return null;
    }
    return json.responseData?.translatedText ?? null;
  } catch (err) {
    console.warn('[translation] MyMemory falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface TranslationResult {
  text: string;
  // R6: antes, si Google Translate Y MyMemory fallaban, translateText devolvía el texto
  // original sin avisar a nadie — el usuario recibía el artículo sin traducir pensando que
  // sí se había traducido. Este flag deja que el caller (scrape/translate routes) se lo
  // comunique al cliente.
  failed: boolean;
}

export async function translateText(text: string, targetLang: string): Promise<TranslationResult> {
  if (!text || !targetLang || targetLang === 'original' || targetLang === 'none') {
    return { text, failed: false };
  }
  const google = await translateWithGoogle(text, targetLang);
  if (google !== null) return { text: google, failed: false };
  const myMemory = await translateWithMyMemory(text, targetLang);
  if (myMemory !== null) return { text: myMemory, failed: false };
  console.error(`[translation] Ambos proveedores fallaron (targetLang=${targetLang}), se conserva el texto original`);
  return { text, failed: true };
}

export interface TranslateConcurrentResult {
  texts: string[];
  failed: boolean;
}

export async function translateConcurrent(items: string[], targetLang: string, concurrency: number): Promise<TranslateConcurrentResult> {
  const texts = new Array<string>(items.length);
  let failed = false;
  const queue = items.map((item, i) => ({ item, i }));
  async function worker() {
    while (queue.length > 0) {
      const { item, i } = queue.shift()!;
      const result = await translateText(item, targetLang);
      texts[i] = result.text;
      if (result.failed) failed = true;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { texts, failed };
}
