'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../landing.module.css';

const LEAD_KEY = 'audiodocs_lead_registered';

const SOURCES = [
  { value: 'recomendacion', label: 'Me lo recomendó alguien' },
  { value: 'redes', label: 'Redes sociales' },
  { value: 'buscador', label: 'Buscando en Google u otro buscador' },
  { value: 'prensa', label: 'Un artículo o newsletter' },
  { value: 'otro', label: 'Otro' },
];

export default function RegistroForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quien ya se registró en este dispositivo pasa directo a la app
  useEffect(() => {
    try {
      if (localStorage.getItem(LEAD_KEY)) {
        router.replace('/app');
      }
    } catch {}
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError('Cuéntanos tu nombre para darte la bienvenida.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError('Ese correo no parece válido. Revísalo e intenta de nuevo.');
      return;
    }
    if (!source) {
      setError('Elige cómo llegaste a Audiodocs.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, source, website }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 429) {
          setError('Demasiados intentos seguidos. Espera un momento e intenta de nuevo.');
        } else if (data?.error === 'INVALID_INPUT') {
          setError('Revisa los datos ingresados e intenta de nuevo.');
        } else {
          setError('No pudimos guardar tu registro. Intenta de nuevo en unos segundos.');
        }
        setSubmitting(false);
        return;
      }

      try {
        localStorage.setItem(LEAD_KEY, JSON.stringify({ at: Date.now() }));
      } catch {}
      router.push('/app');
    } catch {
      setError('No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.lp} ${styles.registerPage}`}>
      <Link href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/main_logo_audiodocs_light.svg" alt="Audiodocs" className={styles.registerLogo} />
      </Link>

      <div className={styles.registerCard}>
        <h1 className={styles.registerTitle}>Casi listo.</h1>
        <p className={styles.registerSub}>
          Cuéntanos quién eres y entra a la beta. Veinte segundos, sin contraseñas.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="lead-name">Nombre</label>
            <input
              id="lead-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              autoComplete="name"
              maxLength={80}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="lead-email">Correo</label>
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              maxLength={120}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="lead-source">¿Cómo llegaste a Audiodocs?</label>
            <select
              id="lead-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
            >
              <option value="" disabled>
                Elige una opción
              </option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.trap} aria-hidden="true">
            <label htmlFor="lead-website">Sitio web</label>
            <input
              id="lead-website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className={styles.registerError} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={`${styles.btnPrimary} ${styles.registerSubmit}`} disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar a Audiodocs'}
            {!submitting && <i className="fa-solid fa-arrow-right" aria-hidden="true" />}
          </button>

          <p className={styles.registerHint}>
            Usaremos tu correo solo para contarte novedades de la beta. Nada de spam.
          </p>
        </form>
      </div>

      <p className={styles.registerBack}>
        <Link href="/">← Volver a la página principal</Link>
      </p>
    </div>
  );
}
