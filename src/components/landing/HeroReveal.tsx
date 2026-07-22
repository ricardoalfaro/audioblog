'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import styles from '@/app/landing.module.css';
import { useSectionProgress } from './useSectionProgress';
import { ArrowRight, SkipPrev, Play, SkipNext } from 'iconoir-react';

/* Alturas deterministas (mismo HTML en server y cliente) para la waveform del hero.
   Muchas columnas finas para cubrir todo el ancho del viewport con puntitos. */
const WAVE_BARS = Array.from({ length: 130 }, (_, i) => {
  const h = 20 + Math.abs(Math.sin(i * 0.5)) * 90 + Math.abs(Math.sin(i * 0.17)) * 34;
  return Math.round(h);
});

/**
 * Hero con "reveal" al estilo withnovu.com, adaptado:
 *   - La foto se muestra completa desde el inicio (full-bleed).
 *   - Al scrollear, hace un zoom-in sutil (tipo Ken Burns) mientras el copy y el
 *     reproductor al pie se desvanecen y suben.
 *   - El panel de contenido (crema, esquinas redondeadas) sube por encima de la foto.
 *
 * En móvil o con prefers-reduced-motion cae a un hero estático (foto full + copy +
 * reproductor). Se renderiza el estático en SSR y primer paint para evitar hydration
 * mismatch; luego se activa el efecto solo si corresponde.
 */
export default function HeroReveal() {
  const [enabled, setEnabled] = useState(false);
  const sceneRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);

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

  const applyProgress = useCallback((p: number) => {
    const root = stickyRef.current;
    if (!root) return;
    // Zoom-in sutil a partir de la imagen completa.
    root.style.setProperty('--zoom', (1 + p * 0.12).toFixed(4));
    // El primer plano (copy + reproductor) se desvanece y sube mientras sube el panel.
    const fg = Math.min(1, Math.max(0, (p - 0.28) / 0.3));
    root.style.setProperty('--fg-op', (1 - fg).toFixed(3));
    root.style.setProperty('--fg-y', (fg * -40).toFixed(1) + 'px');
  }, []);

  useSectionProgress(sceneRef, applyProgress, enabled);

  const copy = (
    <div className={styles.container}>
      <h1 className={styles.heroTitle}>
        No acumules más artículos, empieza a <em>escucharlos</em>.
      </h1>
      <p className={styles.heroSub}>
        Convierte cualquier documento en algo que puedes escuchar. Importa artículos, PDFs,
        documentos o páginas web y escúchalos con voces naturales mientras conduces, caminas, haces
        ejercicio o simplemente descansas.
      </p>
      <div className={styles.ctaRow}>
        <Link href="/registro" className={styles.btnPrimary}>
          Empezar ahora
          <ArrowRight aria-hidden="true" />
        </Link>
        <a href="#como-funciona" className={styles.btnGhost}>
          Ver cómo funciona
        </a>
      </div>
    </div>
  );

  const stage = (
    <div className={styles.heroStage} aria-hidden="true">
      <div className={`${styles.wave} ${styles.waveDots}`}>
        {WAVE_BARS.map((height, i) => (
          <span
            key={i}
            className={styles.waveBar}
            style={{
              ['--h' as string]: `${height}px`,
              animationDelay: `${(i % 7) * -0.19}s`,
              animationDuration: `${0.8 + (i % 6) * 0.16}s`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className={styles.playerCard}>
        <span className={styles.playerChip}>Tecnología</span>
        <p className={styles.playerTitle}>Por qué el audio está cambiando cómo leemos</p>
        <p className={styles.playerMeta}>María Fernanda Rojas · 12 min</p>
        <div className={styles.playerProgress}>
          <i />
        </div>
        <div className={styles.playerControls}>
          <SkipPrev />
          <span className={styles.playButton}>
            <Play />
          </span>
          <SkipNext />
        </div>
      </div>
    </div>
  );

  if (!enabled) {
    return (
      <header className={styles.hero}>
        <div className={styles.heroStatic}>{copy}</div>
        {stage}
      </header>
    );
  }

  return (
    <header ref={sceneRef} className={styles.heroScene}>
      <div ref={stickyRef} className={styles.heroSticky}>
        <div className={styles.heroMedia} aria-hidden="true">
          <div className={styles.heroPhoto} />
          <div className={styles.heroVeil} />
        </div>
        <div className={styles.heroForeground}>
          <div className={styles.heroCopy}>{copy}</div>
          {stage}
        </div>
      </div>
    </header>
  );
}
