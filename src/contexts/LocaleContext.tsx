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

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
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

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  tCategory: (category: string) => string;
}

// Exportado (no solo el hook useLocale) para que ErrorBoundary, un class component, pueda
// consumirlo vía `static contextType` — los hooks no están disponibles en class components.
export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: MessageKey) => MESSAGES[DEFAULT_LOCALE][key],
  tCategory: makeTCategory(DEFAULT_LOCALE),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // 'es' es el valor seguro para SSR; el efecto sincroniza con localStorage tras la
  // hidratación (mismo patrón que ThemeSwitcher, evita mismatch de hidratación).
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && saved in MESSAGES) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(saved);
      }
    } catch { /* storage no disponible */ }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage no disponible */ }
  }, []);

  const t = useCallback((key: MessageKey) => MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key], [locale]);
  const tCategory = useCallback((category: string) => makeTCategory(locale)(category), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, tCategory }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
