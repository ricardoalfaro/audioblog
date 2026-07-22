import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import styles from '../landing.module.css';
import { Github } from 'iconoir-react';

export const metadata: Metadata = {
  title: 'Acerca de — Audiodocs',
  description:
    'Audiodocs convierte cualquier artículo en audio con voces neurales de alta calidad. Conoce por qué existe y cómo contribuir.',
};

export default function AboutPage() {
  return (
    <div className={styles.lp}>
      <LandingHeader />

      <main className={styles.aboutMain}>
        <p className={styles.sectionEyebrow}>Qué es Audiodocs</p>
        <h1 className={styles.aboutTitle}>
          Tus lecturas, en audio. Sin suscripción.
        </h1>
        <p className={styles.aboutSub}>
          Audiodocs convierte cualquier artículo en audio con voces neurales de alta calidad. Pegas
          la URL y puedes escucharlo donde quieras.
        </p>

        <section className={styles.aboutSection}>
          <h2>Por qué existe</h2>
          <p>
            Como muchos, acumulo artículos para leer. Newsletters, blogs, medios, threads largos.
            La lista siempre crece más rápido de lo que la vacío.
          </p>
          <p>
            Plataformas como Substack o Medium tienen audio, pero está restringido a sus propios
            contenidos y en muchos casos detrás de un pago. El resto del internet queda fuera.
          </p>
          <p>
            Audiodocs nació de esa frustración. La premisa es simple: si puedo leerlo, debería
            poder escucharlo. En el auto, paseando al perro, en el gimnasio.
          </p>
          <p>
            Es un proyecto personal que construí para uso propio y que decidí compartir porque la
            necesidad no es solo mía.
          </p>
        </section>

        <section className={styles.aboutSection}>
          <h2>Open source</h2>
          <p>
            Audiodocs es código abierto. Puedes ver cómo funciona, reportar problemas o contribuir
            directamente desde el repositorio.
          </p>
          <a
            href="https://github.com/ricardoalfaro/audioblog"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.aboutGithub}
          >
            <Github aria-hidden="true" />
            github.com/ricardoalfaro/audioblog
          </a>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
