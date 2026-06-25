import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Qué es Audiodocs',
  description: 'Audiodocs nació de la frustración de acumular artículos sin tiempo para leerlos. Un proyecto personal y open source.',
};

export default function AboutPage() {
  return (
    <>
      <div className="reader-topbar" style={{ top: 64 }}>
        <div className="reader-topbar-inner">
          <Link href="/app" className="back-link">
            <i className="fa-solid fa-arrow-left"></i> Volver a la biblioteca
          </Link>
        </div>
      </div>

      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '100px', paddingBottom: '80px', maxWidth: '680px' }}>

        {/* Hero */}
        <section style={{ marginBottom: '56px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Qué es Audiodocs
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', marginBottom: '20px', fontFamily: 'var(--font-sans)' }}>
            Tus lecturas, en audio.<br />Sin suscripción.
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Audiodocs convierte cualquier artículo en audio con voces neurales de alta calidad. Pegas la URL y puedes escucharlo donde quieras.
          </p>
        </section>

        {/* Por qué existe */}
        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Por qué existe
          </h2>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.85, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>
              Como muchos, acumulo artículos para leer. Newsletters, blogs, medios, threads largos. La lista siempre crece más rápido de lo que la vacío.
            </p>
            <p>
              Plataformas como Substack o Medium tienen audio, pero está restringido a sus propios contenidos y en muchos casos detrás de un pago. El resto del internet queda fuera.
            </p>
            <p>
              Audiodocs nació de esa frustración. La premisa es simple: si puedo leerlo, debería poder escucharlo. En el auto, paseando al perro, en el gimnasio.
            </p>
            <p>
              Es un proyecto personal que construí para uso propio y que decidí compartir porque la necesidad no es solo mía.
            </p>
          </div>
        </section>

        {/* Open source */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Open source
          </h2>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.85, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>
              Audiodocs es código abierto. Puedes ver cómo funciona, reportar problemas o contribuir directamente desde el repositorio.
            </p>
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
