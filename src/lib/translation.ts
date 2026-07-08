const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function translateWithGoogle(text: string, targetLang: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json[0] as [string, ...unknown[]][])?.map((part) => part[0]).join('') || null;
  } catch {
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
    if (!res.ok) return null;
    const json = await res.json();
    return json?.responseStatus === 200 ? (json.responseData?.translatedText ?? null) : null;
  } catch {
    return null;
  }
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !targetLang || targetLang === 'original' || targetLang === 'none') return text;
  return (await translateWithGoogle(text, targetLang))
    ?? (await translateWithMyMemory(text, targetLang))
    ?? text;
}

export async function translateConcurrent(items: string[], targetLang: string, concurrency: number): Promise<string[]> {
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
