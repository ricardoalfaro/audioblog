'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('audiodocs_onboarded')) {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    setExiting(true);
    localStorage.setItem('audiodocs_onboarded', 'true');
    setTimeout(() => setShow(false), 400);
  };

  if (!show) return null;

  return (
    <div className={`splash-overlay${exiting ? ' splash-exiting' : ''}`}>
      <div className="hero-bg-circle-1" />
      <div className="hero-bg-circle-2" />
      <div className="splash-inner">
        <img
          src="/main_logo_audiodocs_dark.png"
          alt="Audiodocs"
          className="splash-logo"
        />
        <h1 className="splash-title">Escucha cualquier texto como si fuera un podcast</h1>
        <p className="hero-subtitle">
          Importa un artículo, columna o noticia y escúchalos cuando quieras en su idioma original o traducido con voces ultra realistas.
        </p>
        <button className="splash-start-btn" onClick={dismiss}>
          Empezar <i className="fa-solid fa-arrow-right" />
        </button>
      </div>
    </div>
  );
}
