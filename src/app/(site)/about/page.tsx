import type { Metadata } from 'next';
import AboutContent from './AboutContent';

export const metadata: Metadata = {
  title: 'Qué es Audiodocs',
  description: 'Audiodocs nació de la frustración de acumular artículos sin tiempo para leerlos. Un proyecto personal y open source.',
};

export default function AboutPage() {
  return <AboutContent />;
}
