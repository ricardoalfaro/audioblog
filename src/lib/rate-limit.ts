interface Window {
  count: number;
  start: number;
}

// Map en memoria por instancia serverless: el límite real es N × lambdas activas y se
// resetea en cada cold start. Migrar a un store compartido (Upstash/Vercel KV) requiere
// provisionar el servicio y sus credenciales — ver S8 en BACKLOG.md.
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
  // x-real-ip lo fija el borde de Vercel según la conexión TCP real y el cliente no puede
  // spoofearlo (a diferencia de x-forwarded-for, que si el cliente lo setea con un valor
  // falso antes del hop real, ese valor queda primero en la lista — tomar split(',')[0]
  // como hacía este código antes confiaba en un dato que el propio atacante controla).
  // x-forwarded-for queda solo de fallback para local/dev, donde no hay borde de Vercel
  // que fije x-real-ip.
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}
