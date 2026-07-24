import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

// S6: CSP estática vía next.config (sin nonce). Un CSP con nonce exige que *todas* las
// páginas se rendericen dinámicamente (así lo documenta Next: "all pages must be dynamically
// rendered" cuando se usa nonce) — hoy `/`, `/about`, `/registro` y `/app/archive` son
// estáticas (prerenderizadas), y perder eso solo para poder sacar 'unsafe-inline' de los 2
// <script> de arranque de layout.tsx (anti-flash de tema + skip de splash) no vale el
// trade-off de rendimiento/costo. 'unsafe-inline' en script-src/style-src es la concesión
// consciente de este approach — ver S9 en BACKLOG.md si más adelante se quiere migrar a
// nonce vía `proxy.ts` (el nuevo nombre de middleware.ts en esta versión de Next).
// FIX post-S6 (incidente en producción): el audio de TTS se reproduce vía data: URL
// (audioToDataUrl en audioUtils.ts, no blob:), y media-src no incluía 'data:' — el navegador
// bloqueaba la carga con "MEDIA_ELEMENT_ERROR: Media load rejected by URL safety check"
// (MediaError code 4), rompiendo la reproducción de todo artículo en producción. Confirmado
// en vivo: reproducir el mismo data: URL que genera audioToDataUrl() fallaba exactamente así
// antes de este fix.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' https: data: blob:;
  media-src 'self' blob: data:;
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? '' : 'upgrade-insecure-requests;'}
`;

const nextConfig: NextConfig = {
  // Permite probar el dev server desde otros dispositivos en la red local (ej. el teléfono
  // entrando por la IP de la Mac). Sin esto, Next bloquea los recursos internos de dev
  // (HMR, chunks de JS) por seguridad y la app carga el HTML pero no hidrata: los botones
  // no responden. Solo afecta a `next dev`; no tiene efecto en producción.
  // Si la IP local cambia, actualiza este valor (o usa el comodín de la subred).
  allowedDevOrigins: ['192.168.1.100', '192.168.1.*'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader.replace(/\s{2,}/g, ' ').trim() },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
