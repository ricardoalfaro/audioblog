'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '@/app/landing.module.css';
import { useSectionProgress } from './useSectionProgress';

export type Moment = {
  number: string;
  title: string;
  text: string;
  photo: string;
};

type MomentsPinnedProps = {
  eyebrow: string;
  title: string;
  moments: Moment[];
};

/**
 * Sección "pinned": una imagen central (marco fijo) hace crossfade entre los casos de uso
 * mientras el texto de cada caso aparece alternando izquierda/derecha, ligado al scroll.
 *
 * En móvil o con prefers-reduced-motion cae a la lista estática con foto por caso (el
 * layout original). Renderiza el fallback en SSR y primer paint para evitar hydration
 * mismatch; luego activa el efecto solo si corresponde.
 */
export default function MomentsPinned({ eyebrow, title, moments }: MomentsPinnedProps) {
  const [enabled, setEnabled] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 901px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(wide.matches && !reduce.matches);
    update();
    wide.addEventListener('change', update);
    reduce.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      reduce.removeEventListener('change', update);
    };
  }, []);

  const applyProgress = useCallback(
    (p: number) => {
      const n = moments.length;
      // Índice activo según el tramo de scroll (con un pequeño margen inicial/final).
      const active = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
      for (let i = 0; i < n; i++) {
        const on = i === active;
        const img = imgRefs.current[i];
        if (img) img.style.opacity = on ? '1' : '0';
        const cap = capRefs.current[i];
        if (cap) {
          cap.style.opacity = on ? '1' : '0';
          cap.style.transform = on
            ? 'translateY(-50%) translateY(0)'
            : 'translateY(-50%) translateY(26px)';
        }
      }
    },
    [moments.length],
  );

  useSectionProgress(containerRef, applyProgress, enabled);

  if (!enabled) {
    return (
      <section id="momentos" className={styles.section}>
        <div className={styles.container}>
          <p className={styles.sectionEyebrow}>{eyebrow}</p>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <div className={styles.moments}>
            {moments.map((moment, index) => (
              <div
                key={moment.number}
                className={`${styles.moment}${index % 2 === 1 ? ` ${styles.momentAlt}` : ''}`}
              >
                <div>
                  <span className={styles.momentNumber}>{moment.number}</span>
                  <h3 className={styles.momentTitle}>{moment.title}</h3>
                  <p className={styles.momentText}>{moment.text}</p>
                </div>
                <div className={styles.momentPhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/landing/momentos/${moment.photo}`} alt={moment.title} loading="lazy" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="momentos"
      ref={containerRef}
      className={styles.pinned}
      style={{ height: `calc(${moments.length + 1} * 100svh)` }}
    >
      <div className={styles.pinnedSticky}>
        <div className={styles.pinnedHead}>
          <p className={styles.sectionEyebrow}>{eyebrow}</p>
          <h2 className={styles.pinnedTitle}>{title}</h2>
        </div>

        <div className={styles.pinnedFrame}>
          {moments.map((moment, i) => (
            <div
              key={moment.number}
              ref={(el) => {
                imgRefs.current[i] = el;
              }}
              className={styles.pinnedImg}
              style={{
                backgroundImage: `url(/landing/momentos/${moment.photo})`,
                opacity: i === 0 ? 1 : 0,
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        {moments.map((moment, i) => (
          <div
            key={moment.number}
            ref={(el) => {
              capRefs.current[i] = el;
            }}
            className={`${styles.pinnedCaption} ${i % 2 === 1 ? styles.pinnedRight : styles.pinnedLeft}`}
          >
            <span className={styles.momentNumber}>{moment.number}</span>
            <h3 className={styles.pinnedCaptionTitle}>{moment.title}</h3>
            <p className={styles.pinnedCaptionText}>{moment.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
