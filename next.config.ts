import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite probar el dev server desde otros dispositivos en la red local (ej. el teléfono
  // entrando por la IP de la Mac). Sin esto, Next bloquea los recursos internos de dev
  // (HMR, chunks de JS) por seguridad y la app carga el HTML pero no hidrata: los botones
  // no responden. Solo afecta a `next dev`; no tiene efecto en producción.
  // Si la IP local cambia, actualiza este valor (o usa el comodín de la subred).
  allowedDevOrigins: ['192.168.1.100', '192.168.1.*'],
};

export default nextConfig;
