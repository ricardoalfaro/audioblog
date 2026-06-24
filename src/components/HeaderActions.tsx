'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from './ThemeSwitcher';

export default function HeaderActions() {
  const router = useRouter();
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
      text: '¡Mira esta increíble plataforma para escuchar artículos y newsletters como podcasts!',
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
        alert('Enlace copiado al portapapeles');
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
          title="Opciones de usuario"
        >
          R
        </button>

        {isDropdownOpen && (
          <div className="dropdown-menu">
            <div className="theme-switcher-dropdown">
              <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--color-primary)', fontSize: '13px' }}></i>
              <span>Tema</span>
              <ThemeSwitcher />
            </div>
            <button
              className="dropdown-item"
              onClick={() => {
                setIsDropdownOpen(false);
                router.push('/app?open=import');
              }}
            >
              <i className="fa-solid fa-file-import"></i> Importar artículo
            </button>
            <button className="dropdown-item" onClick={handleShare}>
              <i className="fa-solid fa-arrow-up-from-bracket"></i> Compartir app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
