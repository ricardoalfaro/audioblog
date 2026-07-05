'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/landing.module.css';

/* Mismos idiomas que LOCALES (LocaleContext), deshabilitados: la landing es solo-ES por ahora (F21) */
const LANGS = [
  { code: 'ES', flag: '🇪🇸', label: 'Español', active: true },
  { code: 'EN', flag: '🇺🇸', label: 'English', active: false },
  { code: 'PT', flag: '🇧🇷', label: 'Português', active: false },
  { code: 'FR', flag: '🇫🇷', label: 'Français', active: false },
  { code: 'DE', flag: '🇩🇪', label: 'Deutsch', active: false },
];

export default function LandingHeader({
  variant = 'solid',
}: {
  variant?: 'solid' | 'transparent';
}) {
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const isTransparent = variant === 'transparent';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={`${styles.header}${isTransparent ? ` ${styles.headerTransparent}` : ''}`}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.headerLogo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isTransparent ? '/main_logo_audiodocs_dark.svg' : '/main_logo_audiodocs_light.svg'}
            alt="Audiodocs"
          />
        </Link>

        <div className={styles.headerRight}>
          <nav className={styles.headerLinks} aria-label="Navegación principal">
            <Link href="/#como-funciona">Cómo funciona</Link>
            <Link href="/#momentos">Momentos</Link>
            <Link href="/#preguntas">Preguntas</Link>
          </nav>

          <div className={styles.langWrap} ref={langRef}>
            <button
              className={styles.langBtn}
              onClick={() => setLangOpen(!langOpen)}
              aria-label="Idioma"
              aria-expanded={langOpen}
            >
              ES
            </button>
            {langOpen && (
              <div className={styles.langMenu}>
                {LANGS.map((lang) => (
                  <button
                    key={lang.code}
                    className={`${styles.langItem}${lang.active ? ` ${styles.langItemActive}` : ''}`}
                    disabled={!lang.active}
                    onClick={() => setLangOpen(false)}
                  >
                    <span style={{ fontSize: 16 }}>{lang.flag}</span> {lang.label}
                    {!lang.active && <span className={styles.langSoon}>Pronto</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href="/registro" className={styles.headerCta}>
            Quiero probar
          </Link>
        </div>
      </div>
    </header>
  );
}
