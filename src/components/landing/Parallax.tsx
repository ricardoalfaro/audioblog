'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * Parallax ligero y compartido: todos los <Parallax> se registran en un único bucle de
 * requestAnimationFrame que traslada cada elemento en función de su distancia al centro
 * del viewport. Da sensación de profundidad al entrar/salir las secciones estáticas.
 *
 * Respeta prefers-reduced-motion (no se registra). Un solo listener de scroll/resize
 * para todos los elementos.
 */
type Item = { el: HTMLElement; speed: number };

const items = new Set<Item>();
let listening = false;
let frame = 0;

function render() {
  frame = 0;
  const mid = window.innerHeight / 2;
  items.forEach(({ el, speed }) => {
    const rect = el.getBoundingClientRect();
    const fromCenter = rect.top + rect.height / 2 - mid;
    el.style.transform = `translate3d(0, ${(fromCenter * speed).toFixed(1)}px, 0)`;
  });
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(render);
}

function ensureListening() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

type ParallaxProps = {
  children: ReactNode;
  as?: ElementType;
  /** Fracción del desplazamiento respecto al centro del viewport (sutil ≈ 0.04–0.1). */
  speed?: number;
  className?: string;
};

export default function Parallax({ children, as, speed = 0.06, className }: ParallaxProps) {
  const Tag = as ?? 'div';
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const item: Item = { el, speed };
    items.add(item);
    ensureListening();
    schedule();
    return () => {
      items.delete(item);
      el.style.transform = '';
    };
  }, [speed]);

  return (
    <Tag ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </Tag>
  );
}
