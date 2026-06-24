'use client';

import { useState, useEffect } from 'react';

const AUTO_DISMISS_MS = 1800;
const EXIT_ANIMATION_MS = 400;

export default function SplashScreen() {
  // Shown by default on first paint (server + client match) so it covers the
  // page immediately; the head script sets data-skip-splash before paint for
  // desktop visitors who've already been onboarded, hiding it via CSS.
  const [show, setShow] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    const alreadyOnboarded = !!localStorage.getItem('audiodocs_onboarded');
    const shownThisSession = !!sessionStorage.getItem('audiodocs_splash_shown');

    if (shownThisSession || (!isMobile && !isPWA && alreadyOnboarded)) {
      setShow(false);
      return;
    }

    const timer = setTimeout(() => {
      setExiting(true);
      localStorage.setItem('audiodocs_onboarded', 'true');
      sessionStorage.setItem('audiodocs_splash_shown', 'true');
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
        <img
          src="/main_logo_audiodocs_dark.png"
          alt="Audiodocs"
          className="splash-logo"
        />
      </div>
    </div>
  );
}
