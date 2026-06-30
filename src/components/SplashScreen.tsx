'use client';

import { useState, useEffect } from 'react';

const AUTO_DISMISS_MS = 1800;
const EXIT_ANIMATION_MS = 400; // > 0.2s de la animación CSS splashFadeOut

export default function SplashScreen() {
  const [phase, setPhase] = useState<'hidden' | 'show' | 'exit'>('hidden');

  useEffect(() => {
    let isMobile = false;
    let isPWA = false;
    let alreadyOnboarded = false;
    let shownThisSession = false;

    try {
      isMobile = window.matchMedia('(max-width: 900px)').matches;
      isPWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      alreadyOnboarded = !!localStorage.getItem('audiodocs_onboarded');
      shownThisSession = !!sessionStorage.getItem('audiodocs_splash_shown');
    } catch {
      // storage bloqueado (Private Browsing, iframe restrictivo) — omitir splash
      return;
    }

    if (shownThisSession || (!isMobile && !isPWA && alreadyOnboarded)) return;

    setPhase('show');

    const timer = setTimeout(() => {
      setPhase('exit');
      try {
        localStorage.setItem('audiodocs_onboarded', 'true');
        sessionStorage.setItem('audiodocs_splash_shown', 'true');
      } catch { /* storage no disponible */ }
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, []);

  // Desmontaje garantizado: no depender solo del animationend (no fiable en mobile —
  // Safari iOS pausa animaciones en background, "Reducir movimiento", quirks de webview/PWA).
  // onAnimationEnd queda como ruta rápida; este timer es la red de seguridad.
  useEffect(() => {
    if (phase !== 'exit') return;
    const timer = setTimeout(() => setPhase('hidden'), EXIT_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div
      className={`splash-overlay${phase === 'exit' ? ' splash-exiting' : ''}`}
      onAnimationEnd={(e) => {
        if (e.animationName === 'splashFadeOut') setPhase('hidden');
      }}
    >
      <div className="hero-bg-circle-1" />
      <div className="hero-bg-circle-2" />
      <div className="splash-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/main_logo_audiodocs_dark.svg"
          alt="Audiodocs"
          className="splash-logo"
        />
      </div>
    </div>
  );
}
