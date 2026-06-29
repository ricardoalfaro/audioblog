'use client';

import { useState, useEffect } from 'react';

const AUTO_DISMISS_MS = 1800;
const EXIT_ANIMATION_MS = 400;

export default function SplashScreen() {
  // true es el valor seguro para SSR; el efecto lo oculta en cliente si no procede.
  // Arrancar en true garantiza que servidor y cliente coinciden en el primer render.
  const [show, setShow] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    let alreadyOnboarded = false;
    let shownThisSession = false;
    try {
      alreadyOnboarded = !!localStorage.getItem('audiodocs_onboarded');
      shownThisSession = !!sessionStorage.getItem('audiodocs_splash_shown');
    } catch {
      // storage bloqueado (Private Browsing, iframe restrictivo, etc.) — mostrar splash normalmente
    }

    if (shownThisSession || (!isMobile && !isPWA && alreadyOnboarded)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(false);
      return;
    }

    const timer = setTimeout(() => {
      setExiting(true);
      try {
        localStorage.setItem('audiodocs_onboarded', 'true');
        sessionStorage.setItem('audiodocs_splash_shown', 'true');
      } catch {
        // storage bloqueado — el splash se descarta igual, solo que volverá a mostrarse la próxima vez
      }
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => setShow(false), EXIT_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [exiting]);

  if (!show) return null;

  return (
    <div className={`splash-overlay${exiting ? ' splash-exiting' : ''}`}>
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
