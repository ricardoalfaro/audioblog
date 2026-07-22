// Códigos de error estables devueltos por las API routes en vez de texto — el cliente los
// traduce con t() (ver apiError.ts). Las API routes corren fuera de React y no tienen acceso
// a los diccionarios de src/lib/i18n/*.ts, así que el código es la única fuente de verdad
// compartida entre servidor y cliente.
export const ERROR_CODES = [
  'RATE_LIMITED',
  'URL_REQUIRED',
  'URL_INVALID',
  'SCRAPE_TIMEOUT',
  'FETCH_FAILED',
  'CONTENT_TOO_LARGE',
  'ANTI_BOT_BLOCKED',
  'EXTRACT_FAILED',
  'MEDIUM_BLOCKED',
  'NO_PARAGRAPHS',
  'SCRAPE_INTERNAL',
  'TEXT_REQUIRED',
  'TEXT_TOO_LONG',
  'INVALID_VOICE',
  'TTS_INTERNAL',
  'TTS_TIMEOUT',
  'SHORTEN_ORIGIN_ONLY',
  'SHORTEN_FAILED',
  'TRANSLATE_LANG_INVALID',
  'TRANSLATE_INTERNAL',
] as const;

export type ErrorCode = typeof ERROR_CODES[number];
