import type { MessageKey } from '@/contexts/LocaleContext';
import type { ErrorCode } from './errorCodes';

const ERROR_CODE_TO_KEY: Record<ErrorCode, MessageKey> = {
  RATE_LIMITED: 'errors.rateLimit',
  URL_REQUIRED: 'errors.urlRequired',
  URL_INVALID: 'errors.urlInvalid',
  SCRAPE_TIMEOUT: 'errors.scrapeTimeout',
  FETCH_FAILED: 'errors.fetchFailed',
  CONTENT_TOO_LARGE: 'errors.contentTooLarge',
  ANTI_BOT_BLOCKED: 'errors.antiBotBlocked',
  EXTRACT_FAILED: 'errors.extractFailed',
  MEDIUM_BLOCKED: 'errors.mediumBlocked',
  NO_PARAGRAPHS: 'errors.noParagraphs',
  SCRAPE_INTERNAL: 'errors.scrapeInternal',
  TEXT_REQUIRED: 'errors.textRequired',
  TEXT_TOO_LONG: 'errors.textTooLong',
  INVALID_VOICE: 'errors.invalidVoice',
  TTS_INTERNAL: 'errors.ttsInternal',
  TTS_TIMEOUT: 'errors.ttsTimeout',
  SHORTEN_ORIGIN_ONLY: 'errors.shortenOriginOnly',
  SHORTEN_FAILED: 'errors.shortenFailed',
  TRANSLATE_LANG_INVALID: 'errors.translateLangInvalid',
  TRANSLATE_INTERNAL: 'errors.translateInternal',
};

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

// Marca los Error que YA traen un mensaje traducido (vía t()), para que un catch-all más
// arriba en la pila no lo reemplace por un mensaje genérico ni deje pasar sin traducir un
// err.message nativo del browser (p. ej. "TypeError: Failed to fetch").
export class DisplayError extends Error {}

export function translateApiError(
  t: TFn,
  body: unknown,
  fallbackKey: MessageKey,
  extraParams?: Record<string, string | number>,
): string {
  const code = (body as { error?: string } | null)?.error;
  const httpStatus = (body as { httpStatus?: number } | null)?.httpStatus;
  if (code && code in ERROR_CODE_TO_KEY) {
    return t(ERROR_CODE_TO_KEY[code as ErrorCode], {
      ...(httpStatus != null ? { status: httpStatus } : {}),
      ...extraParams,
    });
  }
  return t(fallbackKey);
}
