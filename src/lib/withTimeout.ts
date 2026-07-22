// R7: algunas dependencias externas (Edge TTS, el fetch de traducción) no aceptan un
// AbortSignal propio — sin esto, si se cuelgan, la única salida es que Vercel mate la
// función entera al llegar a `maxDuration`, sin dar tiempo a devolver un error específico.
export class TimeoutError extends Error {}

export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'TIMEOUT'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
