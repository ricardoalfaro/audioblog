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

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

// Exportado (no solo el hook useLocale) para que ErrorBoundary, un class component, pueda
// consumirlo vía `static contextType` — los hooks no están disponibles en class components.
export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: MessageKey) => MESSAGES[DEFAULT_LOCALE][key],
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

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
