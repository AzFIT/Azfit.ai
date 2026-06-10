import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import ModeToggle from './ModeToggle';

interface NavbarProps {
  onMenuOpen: () => void;
  mode?: 'dashboard' | 'sheets';
  onModeToggle?: (mode: 'dashboard' | 'sheets') => void;
  transparent?: boolean;
}

export default function Navbar({
  onMenuOpen,
  mode = 'dashboard',
  onModeToggle,
  transparent = false,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isTransparent = transparent && !scrolled;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 transition-all duration-300 lg:px-6"
      style={{
        backgroundColor: isTransparent
          ? 'transparent'
          : scrolled
            ? 'rgba(15, 23, 42, 0.95)'
            : 'var(--card-bg)',
        backdropFilter: isTransparent ? 'none' : 'blur(20px)',
        WebkitBackdropFilter: isTransparent ? 'none' : 'blur(20px)',
        borderBottom: isTransparent
          ? 'none'
          : '1px solid var(--card-border)',
      }}
    >
      {/* Hamburger menu button */}
      <button
        onClick={onMenuOpen}
        className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-100 active:scale-[0.92]"
        aria-label="Open menu"
      >
        <Menu
          size={24}
          style={{
            color: isTransparent ? '#FFFFFF' : 'var(--page-text)',
          }}
        />
      </button>

      {/* AzFIT Logo (center) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <img
          src={isTransparent ?  './azfit-logo-text.png' :  './azfit-logo.png'}
          alt="AzFIT"
          className="h-7 object-contain"
          style={{
            filter: isTransparent ? 'none' : 'var(--logo-filter, none)',
          }}
        />
      </div>

      {/* Dashboard/Sheets toggle */}
      {onModeToggle && (
        <div className="ml-auto">
          <ModeToggle mode={mode} onToggle={onModeToggle} />
        </div>
      )}
    </nav>
  );
}
