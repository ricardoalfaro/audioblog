import type { Metadata } from 'next';
import RegistroForm from './RegistroForm';

export const metadata: Metadata = {
  title: 'Únete a la beta — Audiodocs',
  description: 'Regístrate en veinte segundos y empieza a escuchar tus artículos como podcasts.',
  robots: { index: false },
};

export default function RegistroPage() {
  return <RegistroForm />;
}
