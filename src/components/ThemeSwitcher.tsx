'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeSwitcher() {
  // 'system' es el valor seguro para SSR; el efecto sincroniza con localStorage
  // después de la hidratación (no hay mismatch porque ambos parten desde 'system').
  const [theme, setTheme] = useState<Theme>('system');

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (newTheme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const initial = saved ?? 'system';
    applyTheme(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <div className="theme-switcher">
      <button
        className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
        onClick={() => handleThemeChange('light')}
        title="Modo Claro"
        aria-label="Modo Claro"
      >
        <i className="fa-solid fa-sun"></i>
      </button>
      <button
        className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => handleThemeChange('dark')}
        title="Modo Oscuro"
        aria-label="Modo Oscuro"
      >
        <i className="fa-solid fa-moon"></i>
      </button>
      <button
        className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
        onClick={() => handleThemeChange('system')}
        title="Automático (Sistema)"
        aria-label="Automático (Sistema)"
      >
        <i className="fa-solid fa-desktop"></i>
      </button>
    </div>
  );
}
