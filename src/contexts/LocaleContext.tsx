'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import es from '@/lib/i18n/es';
import en from '@/lib/i18n/en';
import pt from '@/lib/i18n/pt';
import fr from '@/lib/i18n/fr';
import de from '@/lib/i18n/de';

export type Locale = 'es' | 'en' | 'pt' | 'fr' | 'de';
export type MessageKey = keyof typeof es;

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { es, en, pt, fr, de };

export const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'pt', label: 'Português', flag: '🇧🇷' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const STORAGE_KEY = 'audiodocs_locale';
const DEFAULT_LOCALE: Locale = 'es';

// Traduce solo la ETIQUETA de una categoría para mostrarla en pantalla — el valor real
// guardado en Article.category (y usado para filtrar/comparar) sigue siendo el string en
// español de STATIC_CATEGORIES. Si la categoría no tiene traducción conocida (p. ej. una
// categoría vieja o escrita a mano), se muestra tal cual llegó.
function makeTCategory(locale: Locale) {
  return (category: string) => {
    const key = `category.${category}` as MessageKey;
    return MESSAGES[locale][key] ?? category;
  };
}

type TParams = Record<string, string | number>;

// Sustituye placeholders `{nombre}` en el string ya resuelto. Sin params, devuelve el string
// tal cual (early-return) para no tocar las ~130 llamadas existentes a t(key) sin argumentos.
function interpolate(raw: string, params?: TParams): string {
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

interface LocaleContextValue {
  locale: Locale;
  isLocaleReady: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: TParams) => string;
  tCategory: (category: string) => string;
}

// Exportado (no solo el hook useLocale) para que ErrorBoundary, un class component, pueda
// consumirlo vía `static contextType` — los hooks no están disponibles en class components.
export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  isLocaleReady: false,
  setLocale: () => {},
  t: (key: MessageKey, params?: TParams) => interpolate(MESSAGES[DEFAULT_LOCALE][key], params),
  tCategory: makeTCategory(DEFAULT_LOCALE),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // 'es' es el valor seguro para SSR; el efecto sincroniza con localStorage tras la
  // hidratación (mismo patrón que ThemeSwitcher, evita mismatch de hidratación).
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLocaleReady, setIsLocaleReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && saved in MESSAGES) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(saved);
      }
    } catch { /* storage no disponible */ }
    // Los flujos que dependen del idioma (como el auto-import) deben esperar a que se lea
    // localStorage: de otro modo usarían el español del SSR aunque la interfaz real sea otra.
    setIsLocaleReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage no disponible */ }
  }, []);

  const t = useCallback((key: MessageKey, params?: TParams) => {
    const raw = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key];
    return interpolate(raw, params);
  }, [locale]);
  const tCategory = useCallback((category: string) => makeTCategory(locale)(category), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, isLocaleReady, setLocale, t, tCategory }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
