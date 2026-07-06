import type { Metadata } from 'next';
import AppClient from './AppClient';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// S7: sin validar, cualquier link /app?ogTitle=...&ogImage=... genera previews arbitrarias
// con la marca Audiodocs (spoofing — sin XSS, Next escapa el output). ogTitle se recorta a un
// largo razonable de título; ogImage se exige http(s) absoluta para evitar esquemas raros
// (data:, javascript:, etc.) o basura que rompa la preview.
const MAX_OG_TITLE_LENGTH = 200;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// Metadata dinámica para links de artículos compartidos (?url=...&ogTitle=...&ogImage=...).
// ogTitle/ogImage vienen ya resueltos desde el reader (handleShare) para que la vista previa
// de WhatsApp/iMessage/Telegram muestre el artículo en vez de la marca genérica de Audiodocs.
// Nombres distintos de "title" a propósito: esa key ya la usa el auto-import de Web Share Target
// como fallback del texto compartido.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const rawOgTitle = typeof sp.ogTitle === 'string' ? sp.ogTitle : undefined;
  const ogTitle = rawOgTitle?.slice(0, MAX_OG_TITLE_LENGTH) || undefined;
  const rawOgImage = typeof sp.ogImage === 'string' ? sp.ogImage : undefined;
  const ogImage = rawOgImage && isHttpUrl(rawOgImage) ? rawOgImage : undefined;

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
