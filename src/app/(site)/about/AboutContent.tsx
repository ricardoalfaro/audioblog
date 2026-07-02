'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

export default function AboutContent() {
  const { t } = useLocale();
  return (
    <>
      <div className="reader-topbar" style={{ top: 64 }}>
        <div className="reader-topbar-inner" style={{ paddingTop: '14px', paddingBottom: '14px' }}>
          <Link href="/app" className="back-link">
            <i className="fa-solid fa-arrow-left"></i> {t('about.backToLibrary')}
          </Link>
        </div>
      </div>

      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '100px', paddingBottom: '80px', maxWidth: '680px' }}>

        {/* Hero */}
        <section style={{ marginBottom: '56px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
            {t('about.eyebrow')}
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', marginBottom: '20px', fontFamily: 'var(--font-sans)' }}>
            {t('about.title.line1')}<br />{t('about.title.line2')}
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {t('about.subtitle')}
          </p>
        </section>

        {/* Por qué existe */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            {t('about.whyTitle')}
          </h2>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.85, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>{t('about.why.p1')}</p>
            <p>{t('about.why.p2')}</p>
            <p>{t('about.why.p3')}</p>
            <p>{t('about.why.p4')}</p>
          </div>
        </section>

        {/* Open source */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            {t('about.openSourceTitle')}
          </h2>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.85, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>{t('about.openSource.p1')}</p>
            <a
              href="https://github.com/ricardoalfaro/audioblog"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px', textDecoration: 'none', borderBottom: '2px solid var(--color-primary)', paddingBottom: '2px', width: 'fit-content' }}
            >
              <i className="fa-brands fa-github" style={{ fontSize: '18px' }}></i>
              github.com/ricardoalfaro/audioblog
            </a>
          </div>
        </section>

      </main>
    </>
  );
}
