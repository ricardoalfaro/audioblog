'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ThemeSwitcher from './ThemeSwitcher';
import { useLocale, LOCALES } from '@/contexts/LocaleContext';

export default function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const currentFlag = LOCALES.find(l => l.value === locale)?.flag ?? '🌐';

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShare = async () => {
    const shareData = {
      title: 'Audiodocs Player',
      text: t('header.shareAppText'),
      url: window.location.origin,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert(t('header.linkCopied'));
      } catch (err) {
        console.error('Error copying to clipboard:', err);
      }
    }
    setIsDropdownOpen(false);
  };

  return (
    <div className="header-right">
      <div className="avatar-dropdown" ref={langDropdownRef}>
        <button
          className="avatar-btn"
          onClick={() => setIsLangOpen(!isLangOpen)}
          title={t('header.language')}
          aria-label={t('header.language')}
          style={{ fontSize: '17px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          {currentFlag}
        </button>

        {isLangOpen && (
          <div className="dropdown-menu">
            {LOCALES.map(l => (
              <button
                key={l.value}
                className="dropdown-item"
                onClick={() => { setLocale(l.value); setIsLangOpen(false); }}
                aria-current={l.value === locale}
                style={l.value === locale ? { color: 'var(--color-primary)', fontWeight: 600 } : undefined}
              >
                <span style={{ fontSize: '16px' }}>{l.flag}</span> {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="avatar-dropdown" ref={dropdownRef}>
        <button
          className="avatar-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          title={t('header.userOptions')}
          aria-label={t('header.userOptions')}
        >
          <i className="fa-solid fa-user"></i>
        </button>

        {isDropdownOpen && (
          <div className="dropdown-menu">
            <div className="theme-switcher-dropdown">
              <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--color-primary)', fontSize: '13px' }}></i>
              <span>{t('header.theme')}</span>
              <ThemeSwitcher />
            </div>
            <button
              className="dropdown-item"
              onClick={() => {
                setIsDropdownOpen(false);
                if (pathname === '/app') {
                  window.dispatchEvent(new CustomEvent('audiodocs:open-import'));
                } else {
                  router.push('/app?open=import');
                }
              }}
            >
              <i className="fa-solid fa-file-import"></i> {t('header.importArticle')}
            </button>
            <button className="dropdown-item" onClick={handleShare}>
              <i className="fa-solid fa-arrow-up-from-bracket"></i> {t('header.shareApp')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
