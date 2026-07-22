// P5: caché genérico en memoria, acotado por tamaño y TTL. Vive en memoria de la instancia
// serverless — no persiste entre lambdas distintas ni sobrevive un cold start (mismo límite
// que ya tiene rate-limit.ts), pero sí evita recomputar dentro de la misma instancia tibia,
// el caso común de reabrir/re-escuchar algo ya procesado hace poco en la sesión. Un store
// compartido de verdad (Vercel KV/Blob, Upstash) requiere provisionar el servicio — ver P7
// en BACKLOG.md.
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class MemoryCache<V> {
  private store = new Map<string, CacheEntry<V>>();

  constructor(private maxEntries: number, private ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Reinsertar mueve la key al final de la Map (orden de inserción) — sirve como
    // recencia barata para el descarte FIFO/LRU-ish de `set` sin estructuras extra.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
