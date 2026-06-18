import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/main_logo_audiodocs_light.png" className="logo-light footer-logo" alt="Audiodocs" />
          <img src="/main_logo_audiodocs_dark.png" className="logo-dark footer-logo" alt="Audiodocs" />
          <p className="footer-copy">© 2026 Audiodocs by Ricardo Alfaro + IA</p>
        </div>
        <ul className="footer-links">
          <li><Link href="/archive" className="footer-link">Archivo</Link></li>
          <li><a href="https://github.com/ricardoalfaro/audioblog" target="_blank" rel="noopener noreferrer" className="footer-link">Github</a></li>
          <li><span className="footer-link footer-link-soon" title="Próximamente">Qué es Audiodocs</span></li>
          <li><span className="footer-link footer-link-soon" title="Próximamente">Preguntas frecuentes</span></li>
        </ul>
      </div>
    </footer>
  );
}
