interface Window {
  count: number;
  start: number;
}

const store = new Map<string, Window>();

function prune(windowMs: number) {
  const cutoff = Date.now() - windowMs;
  for (const [key, win] of store) {
    if (win.start < cutoff) store.delete(key);
  }
}

let lastPrune = 0;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (now - lastPrune > windowMs) {
    prune(windowMs);
    lastPrune = now;
  }

  const win = store.get(key);
  if (!win || now - win.start > windowMs) {
    store.set(key, { count: 1, start: now });
    return true;
  }
  if (win.count >= limit) return false;
  win.count++;
  return true;
}

export function getIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
