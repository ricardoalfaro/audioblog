'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    // Read from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      setTheme('system');
      applyTheme('system');
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (newTheme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme'); // Follows system prefers-color-scheme via media queries
    }
  };

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
