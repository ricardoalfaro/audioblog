'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ThemeSwitcher from './ThemeSwitcher';

export default function HeaderActions() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initialSearch = searchParams.get('q') || '';
  const [searchValue, setSearchValue] = useState(initialSearch);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/?q=${encodeURIComponent(searchValue.trim())}`);
    } else {
      router.push(`/`);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Audioblog | Minimalist',
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
      <form className="header-search" onSubmit={handleSearchSubmit}>
        <i className="fa-solid fa-magnifying-glass"></i>
        <input 
          type="text" 
          placeholder="Buscar..." 
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </form>

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
              <span>Tema:</span>
              <ThemeSwitcher />
            </div>
            <button 
              onClick={handleShare}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%', 
                padding: '8px 12px', marginTop: '4px', background: 'none', border: 'none', 
                borderTop: '1px solid var(--border-color)', color: 'var(--text-primary)', 
                cursor: 'pointer', fontSize: '14px', textAlign: 'left'
              }}
            >
              <i className="fa-solid fa-share-nodes" style={{ color: 'var(--color-primary)' }}></i> Compartir Audioblog
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
