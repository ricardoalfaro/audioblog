'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ThemeSwitcher from './ThemeSwitcher';
import { useLocale, LOCALES } from '@/contexts/LocaleContext';
import { User, HalfMoon, Import, Check, ShareIos } from 'iconoir-react';

export default function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

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
      setIsDropdownOpen(false);
    } else {
      // U19: feedback inline (icono + texto del propio item) en vez de alert() bloqueante —
      // mismo patrón que el botón de compartir del reader/GlobalPlayer
      try {
        await navigator.clipboard.writeText(shareData.url);
        setLinkCopied(true);
        setTimeout(() => { setLinkCopied(false); setIsDropdownOpen(false); }, 1500);
      } catch (err) {
        console.error('Error copying to clipboard:', err);
        setIsDropdownOpen(false);
      }
    }
  };

  return (
    <div className="header-right">
      <div className="avatar-dropdown" ref={langDropdownRef}>
        <button
          className="locale-btn"
          onClick={() => setIsLangOpen(!isLangOpen)}
          title={t('header.language')}
          aria-label={t('header.language')}
        >
          {locale}
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
          <User />
        </button>

        {isDropdownOpen && (
          <div className="dropdown-menu">
            <div className="dropdown-section-label">{t('header.preferences')}</div>
            <div className="theme-switcher-dropdown">
              <span className="icon-badge"><HalfMoon /></span>
              <span>{t('header.theme')}</span>
              <ThemeSwitcher />
            </div>

            <div className="dropdown-section-label">{t('header.actions')}</div>
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
              <span className="icon-badge"><Import /></span>
              {t('header.importArticle')}
            </button>
            <button className="dropdown-item" onClick={handleShare}>
              <span className="icon-badge">{linkCopied ? <Check /> : <ShareIos />}</span>
              {linkCopied ? t('header.linkCopied') : t('header.shareApp')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
