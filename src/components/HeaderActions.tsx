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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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
            <div className="theme-switcher-dropdown">
              <i className="fa-solid fa-language" style={{ color: 'var(--color-primary)', fontSize: '13px' }}></i>
              <span>{t('header.language')}</span>
              <select
                className="form-control"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
                value={locale}
                onChange={e => setLocale(e.target.value as typeof locale)}
              >
                {LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
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
