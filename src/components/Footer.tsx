import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/audiodocs_logo_vertical.svg" alt="Audiodocs" className="footer-logo-svg" />
          <p className="footer-copy">© 2026 Audiodocs</p>
        </div>
        <ul className="footer-links">
          <li><Link href="/about" className="footer-link">Qué es Audiodocs</Link></li>
          <li><span className="footer-link footer-link-soon" title="Próximamente">FAQ</span></li>
          <li><a href="https://github.com/ricardoalfaro/audioblog" target="_blank" rel="noopener noreferrer" className="footer-link">Github</a></li>
        </ul>
      </div>
    </footer>
  );
}
