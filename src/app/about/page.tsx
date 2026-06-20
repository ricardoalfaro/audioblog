import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Qué es Audiodocs',
  description: 'Audiodocs convierte cualquier artículo en audio con voces neurales. Sin suscripción, sin restricciones.',
};

export default function AboutPage() {
  return (
    <>
      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '48px', paddingBottom: '80px', maxWidth: '720px' }}>

        {/* Hero */}
        <section style={{ marginBottom: '64px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Qué es Audiodocs
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', marginBottom: '20px', fontFamily: 'var(--font-sans)' }}>
            Tus lecturas, en audio.<br />Sin suscripción.
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '580px' }}>
            Audiodocs convierte cualquier artículo en un mini podcast que podés escuchar donde quieras, con voces neurales de alta calidad.
          </p>
        </section>

        {/* Origin */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Por qué existe
          </h2>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>
              Todos acumulamos artículos para leer. En pestañas abiertas, en apps de lectura, en favoritos que nunca volvemos a abrir. La lista crece y el tiempo no alcanza.
            </p>
            <p>
              Plataformas como Substack o Medium ofrecen escucha en audio, pero solo para sus propios contenidos y, en muchos casos, detrás de un pago. El resto del internet —blogs, newsletters, medios— queda fuera.
            </p>
            <p>
              Audiodocs nació de esa fricción. La idea es simple: pegás la URL de cualquier artículo y la app se encarga del resto. Sin cuentas, sin planes, sin límites por plataforma.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '28px' }}>
            Cómo funciona
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              { icon: 'fa-link', step: '1', title: 'Pegás la URL', desc: 'Cualquier artículo público. Substack, Medium, blogs, newsletters, medios.' },
              { icon: 'fa-waveform-lines', step: '2', title: 'Generamos el audio', desc: 'Extraemos el texto, lo limpiamos y lo convertimos en audio con voces neurales en español e inglés.' },
              { icon: 'fa-headphones', step: '3', title: 'Escuchás donde quieras', desc: 'El reproductor funciona en segundo plano, con CarPlay y Bluetooth.' },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--color-primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${icon}`} style={{ color: 'var(--color-primary)', fontSize: '18px' }}></i>
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Paso {step}</p>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
            Para cuándo
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {[
              { icon: 'fa-car', label: 'En el auto' },
              { icon: 'fa-dog', label: 'Paseando al perro' },
              { icon: 'fa-dumbbell', label: 'En el gimnasio' },
              { icon: 'fa-person-walking', label: 'Caminando' },
            ].map(({ icon, label }) => (
              <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className={`fa-solid ${icon}`} style={{ color: 'var(--color-primary)', fontSize: '20px', width: '24px', textAlign: 'center' }}></i>
                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--color-primary)', color: '#000', fontWeight: 700, fontSize: '15px', padding: '12px 24px', borderRadius: 'var(--border-radius-md)', textDecoration: 'none', transition: 'opacity 0.15s' }}>
            <i className="fa-solid fa-headphones"></i>
            Ir a mi biblioteca
          </Link>
        </section>

      </main>
      <Footer />
    </>
  );
}
