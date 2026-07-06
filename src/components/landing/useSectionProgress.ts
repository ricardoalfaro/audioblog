'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Liga el progreso de scroll de un contenedor alto (con hijo sticky) a un callback.
 *
 * progress = 0  → el contenedor recién toca el borde superior del viewport.
 * progress = 1  → el contenedor termina de salir (su base alcanza el borde inferior).
 *
 * El callback se invoca en cada frame (throttled con requestAnimationFrame) con el
 * progreso ya normalizado a [0, 1]. Escribe estilos directamente en el DOM desde el
 * callback para evitar re-renders de React por frame.
 *
 * `enabled` deja al consumidor decidir cuándo aplicar el efecto (p. ej. solo en desktop
 * y sin prefers-reduced-motion). Con enabled=false no engancha listeners.
 */
export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
  enabled: boolean,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? -rect.top / scrollable : 0;
      onProgress(Math.min(1, Math.max(0, progress)));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ref, onProgress, enabled]);
}
