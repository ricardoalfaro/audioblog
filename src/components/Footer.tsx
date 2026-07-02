'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

export default function Footer() {
  const { t } = useLocale();
  return (
    <footer className="main-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/audiodocs_logo_vertical.svg" alt="Audiodocs" className="footer-logo-svg" />
          <p className="footer-copy">© 2026 Audiodocs</p>
        </div>
        <ul className="footer-links">
          <li><Link href="/about" className="footer-link">{t('footer.about')}</Link></li>
          <li><span className="footer-link footer-link-soon" title={t('footer.faqSoon')}>{t('footer.faq')}</span></li>
          <li><a href="https://github.com/ricardoalfaro/audioblog" target="_blank" rel="noopener noreferrer" className="footer-link">Github</a></li>
        </ul>
      </div>
    </footer>
  );
}
