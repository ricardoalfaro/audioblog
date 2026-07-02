import type { Metadata } from 'next';
import AppClient from './AppClient';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Metadata dinámica para links de artículos compartidos (?url=...&ogTitle=...&ogImage=...).
// ogTitle/ogImage vienen ya resueltos desde el reader (handleShare) para que la vista previa
// de WhatsApp/iMessage/Telegram muestre el artículo en vez de la marca genérica de Audiodocs.
// Nombres distintos de "title" a propósito: esa key ya la usa el auto-import de Web Share Target
// como fallback del texto compartido.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const ogTitle = typeof sp.ogTitle === 'string' ? sp.ogTitle : undefined;
  const ogImage = typeof sp.ogImage === 'string' && sp.ogImage ? sp.ogImage : undefined;

  if (!ogTitle) return {};

  const description = 'Escucha este artículo como podcast en Audiodocs.';

  return {
    title: ogTitle,
    description,
    openGraph: {
      title: ogTitle,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default function Page() {
  return <AppClient />;
}
