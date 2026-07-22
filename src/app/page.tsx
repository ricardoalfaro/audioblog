import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import HeroReveal from '@/components/landing/HeroReveal';
import MomentsPinned from '@/components/landing/MomentsPinned';
import Reveal from '@/components/landing/Reveal';
import Parallax from '@/components/landing/Parallax';
import styles from './landing.module.css';
import { Microphone, Language, Folder, Forward, Car, Label, SmartphoneDevice, Page, Lock, Shield } from 'iconoir-react';

export const metadata: Metadata = {
  title: 'Audiodocs — Escucha cualquier artículo como podcast',
  description:
    'Convierte cualquier artículo web en audio con voces neurales que suenan a persona. Pega un link y escúchalo en el trayecto, entrenando o descansando la vista. Gratis en beta.',
};

const STEPS = [
  {
    number: '01',
    title: 'Pega el link',
    text: 'Copia la URL de cualquier artículo — Medium, Substack, blogs, prensa — y pégala en Audiodocs. La aplicación solo extrae el texto, sin avisos ni distracciones.',
  },
  {
    number: '02',
    title: 'Traduce y etiqueta',
    text: 'Si el texto está en otro idioma, escoge el que prefieras escuchar, dale una categoría para que aparezca clasificado en tu biblioteca.',
  },
  {
    number: '03',
    title: 'Dale play',
    text: 'Escucha donde sea. En tu teléfono, en tu computador, en tu auto con CarPlay. Tu progreso queda guardado para retomar.',
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
    icon: Microphone,
    title: 'Voces que no suenan a robot',
    text: 'Síntesis neural de última generación, con voces masculinas y femeninas y acentos por región. Audiodocs incluso sugiere la voz según quién escribió el artículo.',
    wide: true,
    chips: ['Español (MX)', 'Español (ES)', 'English', 'Português', 'Français', 'Deutsch'],
  },
  {
    icon: Language,
    title: 'Traducción al importar',
    text: 'El artículo llega en inglés y se escucha en español. Cinco idiomas disponibles al momento de importar.',
    wide: true,
    flags: true,
  },
  {
    icon: Folder,
    title: 'Biblioteca que se ordena sola',
    text: 'Cada artículo se clasifica por tema automáticamente. Tu lista de pendientes deja de ser un cajón desordenado.',
  },
  {
    icon: Forward,
    title: 'Cola y velocidad',
    text: 'Encadena artículos como una playlist y ajusta la velocidad de reproducción a tu ritmo.',
  },
  {
    icon: Car,
    title: 'Compatible con CarPlay y Android Auto',
    text: 'Lleva tus artículos a la pantalla del auto y controla la reproducción desde el volante. Tus trayectos se convierten en tiempo de lectura.',
  },
];

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
    icon: Label,
    q: '¿Cuánto cuesta?',
    a: 'Nada. Audiodocs está en beta abierta y es gratis mientras la construimos junto a los primeros usuarios.',
  },
  {
    icon: SmartphoneDevice,
    q: '¿Tengo que instalar algo?',
    a: 'No. Funciona directo en el navegador del teléfono o del computador. Si quieres, puedes instalarla como app desde el mismo navegador.',
  },
  {
    icon: Page,
    q: '¿Qué artículos puedo importar?',
    a: 'Casi cualquier página con texto: blogs, Medium, prensa, newsletters públicas. Pegas el link y Audiodocs hace el resto.',
  },
  {
    icon: Language,
    q: '¿Puedo escucharlos en otro idioma?',
    a: 'Sí. Al importar puedes traducir el artículo a español, inglés, portugués, francés o alemán, con voces naturales para cada idioma.',
  },
  {
    icon: Lock,
    q: '¿Funciona con la pantalla bloqueada?',
    a: 'Sí. Controlas la reproducción desde la pantalla de bloqueo o los audífonos, igual que en cualquier app de podcasts.',
  },
  {
    icon: Shield,
    q: '¿Dónde quedan mis datos?',
    a: 'Tu biblioteca vive en tu propio dispositivo. No creamos perfiles de lectura ni compartimos tus datos con nadie.',
  },
];

export default function LandingPage() {
  return (
    <div className={styles.lp}>
      <LandingHeader variant="transparent" />

      <HeroReveal />

      <div className={styles.content}>
        <section id="como-funciona" className={styles.section}>
          <div className={styles.container}>
            <Parallax speed={0.05}>
              <p className={styles.sectionEyebrow}>Cómo funciona</p>
              <h2 className={styles.sectionTitle}>
                Convierte tus links en audio como si fuera un podcast.
              </h2>
            </Parallax>
            <div className={styles.steps}>
              {STEPS.map((step, i) => (
                <Reveal key={step.number} delay={i * 0.1} className={styles.step}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.darkPanel}>
          <div className={styles.container}>
            <Parallax speed={0.05}>
              <p className={styles.sectionEyebrow}>Lo que hay adentro</p>
              <h2 className={styles.sectionTitle}>Hecho para escuchar en serio.</h2>
              <p className={styles.darkPanelSub}>
                No es un lector de pantalla con play. Es un reproductor pensado desde cero para
                artículos: voces, biblioteca, cola y traducción trabajando juntas.
              </p>
            </Parallax>
            <div className={styles.bento}>
              {FEATURES.map((feature, i) => (
                <Reveal
                  key={feature.title}
                  delay={(i % 3) * 0.08}
                  className={`${styles.bentoCard}${feature.wide ? ` ${styles.bentoWide}` : ''}`}
                >
                  <div className={styles.bentoIcon}>
                    <feature.icon aria-hidden="true" />
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
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <MomentsPinned
          eyebrow="Momentos"
          title="Los ratos muertos son la nueva sala de lectura."
          moments={MOMENTS}
        />

        <section id="preguntas" className={styles.section}>
          <div className={styles.container}>
            <Parallax speed={0.05}>
              <p className={styles.sectionEyebrow}>Preguntas frecuentes</p>
              <h2 className={styles.sectionTitle}>
                Lo que todos se preguntan antes de probar Audiodocs.
              </h2>
            </Parallax>
            <div className={styles.faqGrid}>
              {FAQS.map((faq, i) => (
                <Reveal key={faq.q} delay={(i % 2) * 0.08} className={styles.faqItem}>
                  <span className={styles.faqIcon}>
                    <faq.icon aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{faq.q}</h3>
                    <p>{faq.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Reveal as="section" className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>
            Tus artículos pendientes<br />encontraron su lugar.
          </h2>
          <p className={styles.finalCtaSub}>
            Prueba Audiodocs ahora. Es gratis, no requiere nada más que un par de datos que me
            sirven para saber quién lo está usando.
          </p>
          <Link href="/registro" className={styles.btnDark}>
            Probar ahora
          </Link>
        </Reveal>
      </div>

      <LandingFooter />
    </div>
  );
}
