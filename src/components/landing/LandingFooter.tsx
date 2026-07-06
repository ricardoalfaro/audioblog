import Link from 'next/link';
import styles from '@/app/landing.module.css';

/* Proyectos y redes sin vínculo todavía: se agregan cuando existan */
const PROJECTS = ['Emergency Wallet', 'Image Editor Pro', 'Image Vision Pro'];

export default function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/main_logo_audiodocs_light.svg" alt="Audiodocs" />
            <p>
              Convierte cualquier artículo web en audio con voces que suenan reales. Gratis, en tu
              navegador.
            </p>
          </div>

          <div className={styles.footerCol}>
            <h4>Audiodocs</h4>
            <ul>
              <li><Link href="/#como-funciona">Cómo funciona</Link></li>
              <li><Link href="/#momentos">Momentos</Link></li>
              <li><Link href="/#preguntas">Preguntas</Link></li>
              <li><Link href="/about">Acerca de</Link></li>
              <li><Link href="/registro">Probar gratis</Link></li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h4>Proyectos</h4>
            <ul>
              {PROJECTS.map((project) => (
                <li key={project}>
                  <span>
                    {project}
                    <span className={styles.footerSoon}>Pronto</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h4>Social</h4>
            <ul>
              <li><span>Instagram</span></li>
              <li><span>LinkedIn</span></li>
              <li>
                <a
                  href="https://github.com/ricardoalfaro/audioblog"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span className={styles.footerCopy}>© {new Date().getFullYear()} Audiodocs</span>
          <span className={styles.footerCopy}>
            Hecho con amor por los detalles y la experiencia de usuario.
          </span>
        </div>
      </div>
    </footer>
  );
}
