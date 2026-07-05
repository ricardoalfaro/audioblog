import type { Metadata } from 'next';
import Link from 'next/link';
import { existsSync } from 'fs';
import path from 'path';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'Audiodocs — Escucha cualquier artículo como podcast',
  description:
    'Convierte cualquier artículo web en audio con voces neurales que suenan a persona. Pega un link y escúchalo en el trayecto, entrenando o descansando la vista. Gratis en beta.',
};

/* Alturas deterministas (mismo HTML en server y cliente) para la waveform del hero */
const WAVE_BARS = Array.from({ length: 56 }, (_, i) => {
  const h = 26 + Math.abs(Math.sin(i * 0.83)) * 118 + Math.abs(Math.sin(i * 0.29)) * 42;
  return Math.round(h);
});

const STEPS = [
  {
    number: '01',
    title: 'Pega el link',
    text: 'Copia la URL de casi cualquier artículo — blogs, Medium, prensa — y pégala en Audiodocs. Extraemos solo el texto, sin avisos ni distracciones.',
  },
  {
    number: '02',
    title: 'Elige la voz',
    text: 'Voces neurales que suenan a persona, no a robot. Y si el artículo está en otro idioma, puedes traducirlo antes de que empiece a sonar.',
  },
  {
    number: '03',
    title: 'Escucha donde sea',
    text: 'Con la pantalla bloqueada, desde los audífonos o en la pantalla del auto con CarPlay. Tu progreso queda guardado para retomar justo donde ibas.',
  },
];

const TRANSLATION_FLAGS = [
  { src: '/landing/flags/es.svg', alt: 'Español' },
  { src: '/landing/flags/en.svg', alt: 'English' },
  { src: '/landing/flags/pt.svg', alt: 'Português' },
  { src: '/landing/flags/fr.svg', alt: 'Français' },
  { src: '/landing/flags/de.svg', alt: 'Deutsch' },
];

const FEATURES = [
  {
    icon: 'fa-microphone-lines',
    title: 'Voces que no suenan a robot',
    text: 'Síntesis neural de última generación, con voces masculinas y femeninas y acentos por región. Audiodocs incluso sugiere la voz según quién escribió el artículo.',
    wide: true,
    chips: ['Español (MX)', 'Español (ES)', 'English', 'Português', 'Français', 'Deutsch'],
  },
  {
    icon: 'fa-language',
    title: 'Traducción al importar',
    text: 'El artículo llega en inglés y se escucha en español. Cinco idiomas disponibles al momento de importar.',
    wide: true,
    flags: true,
  },
  {
    icon: 'fa-layer-group',
    title: 'Biblioteca que se ordena sola',
    text: 'Cada artículo se clasifica por tema automáticamente. Tu lista de pendientes deja de ser un cajón desordenado.',
  },
  {
    icon: 'fa-forward',
    title: 'Cola y velocidad',
    text: 'Encadena artículos como una playlist y ajusta la velocidad de reproducción a tu ritmo.',
  },
  {
    icon: 'fa-share-nodes',
    title: 'Comparte el audio',
    text: 'Un link y la otra persona lo escucha en su navegador. Sin cuentas y sin instalar nada.',
  },
];

/* Deja tus fotos en public/landing/momentos/ con estos nombres; mientras falten se muestra un placeholder */
const MOMENTS = [
  {
    number: '01',
    title: 'En el trayecto',
    text: 'El viaje al trabajo rinde el doble: los artículos que guardaste en la semana se escuchan solos entre estación y estación.',
    photo: 'trayecto.jpg',
  },
  {
    number: '02',
    title: 'Entrenando',
    text: 'Las piernas en la trotadora, la cabeza en ese ensayo largo que nunca encontraba su momento.',
    photo: 'entrenando.jpg',
  },
  {
    number: '03',
    title: 'Con las manos ocupadas',
    text: 'Cocinando, ordenando, manejando. Los momentos en que no puedes mirar una pantalla son perfectos para escucharla.',
    photo: 'manos-ocupadas.jpg',
  },
  {
    number: '04',
    title: 'Descansando la vista',
    text: 'Después de ocho horas frente al computador, tus ojos merecen que la lectura pendiente llegue por los oídos.',
    photo: 'descanso-visual.jpg',
  },
  {
    number: '05',
    title: 'Paseando a tu perro',
    text: 'La vuelta de cada tarde dura justo lo que dura un buen artículo. Tu perro huele el barrio, tú te pones al día.',
    photo: 'perro.jpg',
  },
];

const FAQS = [
  {
    icon: 'fa-tag',
    q: '¿Cuánto cuesta?',
    a: 'Nada. Audiodocs está en beta abierta y es gratis mientras la construimos junto a los primeros usuarios.',
  },
  {
    icon: 'fa-mobile-screen-button',
    q: '¿Tengo que instalar algo?',
    a: 'No. Funciona directo en el navegador del teléfono o del computador. Si quieres, puedes instalarla como app desde el mismo navegador.',
  },
  {
    icon: 'fa-newspaper',
    q: '¿Qué artículos puedo importar?',
    a: 'Casi cualquier página con texto: blogs, Medium, prensa, newsletters públicas. Pegas el link y Audiodocs hace el resto.',
  },
  {
    icon: 'fa-language',
    q: '¿Puedo escucharlos en otro idioma?',
    a: 'Sí. Al importar puedes traducir el artículo a español, inglés, portugués, francés o alemán, con voces naturales para cada idioma.',
  },
  {
    icon: 'fa-lock',
    q: '¿Funciona con la pantalla bloqueada?',
    a: 'Sí. Controlas la reproducción desde la pantalla de bloqueo o los audífonos, igual que en cualquier app de podcasts.',
  },
  {
    icon: 'fa-shield-halved',
    q: '¿Dónde quedan mis datos?',
    a: 'Tu biblioteca vive en tu propio dispositivo. No creamos perfiles de lectura ni compartimos tus datos con nadie.',
  },
];

function momentPhotoExists(file: string): boolean {
  return existsSync(path.join(process.cwd(), 'public', 'landing', 'momentos', file));
}

export default function LandingPage() {
  return (
    <div className={styles.lp}>
      <LandingHeader variant="transparent" />

      <header className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.heroTitle}>
            Deja de acumular artículos. Empieza a <em>escucharlos</em>.
          </h1>
          <p className={styles.heroSub}>
            Audiodocs reproduce cualquier publicación para que la escuches como si fuera un
            episodio de podcast con voces que suenan reales. Aprovecha tus tiempos muertos en el
            transporte, en el auto, o deja de caminar leyendo.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/registro" className={styles.btnPrimary}>
              Probar Audiodocs
              <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </Link>
            <a href="#como-funciona" className={styles.btnGhost}>
              Ver cómo funciona
            </a>
          </div>
        </div>

        <div className={styles.heroStage}>
          <div className={styles.wave} aria-hidden="true">
            {WAVE_BARS.map((height, i) => (
              <span
                key={i}
                className={styles.waveBar}
                style={{
                  height,
                  animationDelay: `${(i % 9) * -0.21}s`,
                  animationDuration: `${1.5 + (i % 5) * 0.22}s`,
                }}
              />
            ))}
          </div>
          <div className={styles.playerCard} aria-hidden="true">
            <span className={styles.playerChip}>Tecnología</span>
            <p className={styles.playerTitle}>Por qué el audio está cambiando cómo leemos</p>
            <p className={styles.playerMeta}>María Fernanda Rojas · 12 min</p>
            <div className={styles.playerProgress}>
              <i />
            </div>
            <div className={styles.playerControls}>
              <i className="fa-solid fa-backward-step" />
              <span className={styles.playButton}>
                <i className="fa-solid fa-play" />
              </span>
              <i className="fa-solid fa-forward-step" />
            </div>
          </div>
        </div>
      </header>

      <section id="como-funciona" className={styles.section}>
        <div className={styles.container}>
          <p className={styles.sectionEyebrow}>Cómo funciona</p>
          <h2 className={styles.sectionTitle}>Convierte tus links en audio como si fuera un podcast.</h2>
          <div className={styles.steps}>
            {STEPS.map((step) => (
              <div key={step.number} className={styles.step}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.darkPanel}>
        <div className={styles.container}>
          <p className={styles.sectionEyebrow}>Lo que hay adentro</p>
          <h2 className={styles.sectionTitle}>Hecho para escuchar en serio.</h2>
          <p className={styles.darkPanelSub}>
            No es un lector de pantalla con play. Es un reproductor pensado desde cero para
            artículos: voces, biblioteca, cola y traducción trabajando juntas.
          </p>
          <div className={styles.bento}>
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`${styles.bentoCard}${feature.wide ? ` ${styles.bentoWide}` : ''}`}
              >
                <div className={styles.bentoIcon}>
                  <i className={`fa-solid ${feature.icon}`} aria-hidden="true" />
                </div>
                <h3 className={styles.bentoTitle}>{feature.title}</h3>
                <p className={styles.bentoText}>{feature.text}</p>
                {feature.chips && (
                  <div className={styles.voiceChips}>
                    {feature.chips.map((chip) => (
                      <span key={chip}>{chip}</span>
                    ))}
                  </div>
                )}
                {feature.flags && (
                  <div className={styles.flagRow}>
                    {TRANSLATION_FLAGS.map((flag) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={flag.src} src={flag.src} alt={flag.alt} title={flag.alt} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="momentos" className={styles.section}>
        <div className={styles.container}>
          <p className={styles.sectionEyebrow}>Momentos</p>
          <h2 className={styles.sectionTitle}>Los ratos muertos son la nueva sala de lectura.</h2>
          <div className={styles.moments}>
            {MOMENTS.map((moment, index) => (
              <div
                key={moment.number}
                className={`${styles.moment}${index % 2 === 1 ? ` ${styles.momentAlt}` : ''}`}
              >
                <div>
                  <span className={styles.momentNumber}>{moment.number}</span>
                  <h3 className={styles.momentTitle}>{moment.title}</h3>
                  <p className={styles.momentText}>{moment.text}</p>
                </div>
                <div className={styles.momentPhoto}>
                  {momentPhotoExists(moment.photo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/landing/momentos/${moment.photo}`} alt={moment.title} loading="lazy" />
                  ) : (
                    <span className={styles.momentPhotoPlaceholder} aria-hidden="true">
                      <i className="fa-regular fa-image" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="preguntas" className={styles.section}>
        <div className={styles.container}>
          <p className={styles.sectionEyebrow}>Preguntas frecuentes</p>
          <h2 className={styles.sectionTitle}>Lo que todos se preguntan antes de probar Audiodocs.</h2>
          <div className={styles.faqGrid}>
            {FAQS.map((faq) => (
              <div key={faq.q} className={styles.faqItem}>
                <span className={styles.faqIcon}>
                  <i className={`fa-solid ${faq.icon}`} aria-hidden="true" />
                </span>
                <div>
                  <h3>{faq.q}</h3>
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Tus artículos pendientes encontraron su lugar.</h2>
        <p className={styles.finalCtaSub}>
          Prueba Audiodocs ahora. Es gratis, no requiere nada más que un par de datos que me sirven
          para saber quién lo está usando.
        </p>
        <Link href="/registro" className={styles.btnDark}>
          Probar ahora
        </Link>
      </section>

      <LandingFooter />
    </div>
  );
}
