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
          </div>
        )}
      </div>
    </div>
  );
}
