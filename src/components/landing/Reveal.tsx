'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import styles from '@/app/landing.module.css';

/**
 * IntersectionObserver único y compartido por todos los <Reveal>.
 * Al entrar en viewport añade la clase de "visible" una sola vez y deja de observar.
 */
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.isVisible);
            sharedObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
  }
  return sharedObserver;
}

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  /** Retraso en segundos para escalonar elementos hermanos. */
  delay?: number;
  className?: string;
};

export default function Reveal({ children, as, delay = 0, className }: RevealProps) {
  const Tag = as ?? 'div';
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = getObserver();
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!observer || reduce) {
      el.classList.add(styles.isVisible);
      return;
    }
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${styles.reveal}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  );
}
