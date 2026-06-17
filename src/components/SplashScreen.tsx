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
    setTimeout(() => setShow(false), 500);
  };

  if (!show) return null;

  return (
    <div className={`splash-overlay${exiting ? ' splash-exiting' : ''}`}>
      <div className="hero-bg-circle-1" />
      <div className="hero-bg-circle-2" />
      <div className="splash-inner">
        <h1 className="splash-title">Escucha tus documentos como un podcast</h1>
        <p className="hero-subtitle">
          Importa cualquier artículo, columna o blog y escúchalo en cualquier lugar, en idioma original o traducido con voces realistas.
        </p>
        <button className="splash-start-btn" onClick={dismiss}>
          Empezar <i className="fa-solid fa-arrow-right" />
        </button>
      </div>
    </div>
  );
}
