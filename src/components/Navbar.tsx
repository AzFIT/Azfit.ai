import { useState, useEffect, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Menu, Search } from 'lucide-react';
import ModeToggle from './ModeToggle';

interface NavbarProps {
  onMenuOpen: () => void;
  mode?: 'dashboard' | 'sheets';
  onModeToggle?: (mode: 'dashboard' | 'sheets') => void;
  transparent?: boolean;
  /** Phase 89: the nav drawer returns focus here on close. */
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
  /** Phase 90d: open the global search palette. */
  onSearchOpen?: () => void;
  /** Phase 90d: the palette returns focus here on close. */
  searchButtonRef?: RefObject<HTMLButtonElement | null>;
}

export default function Navbar({
  onMenuOpen,
  mode = 'dashboard',
  onModeToggle,
  transparent = false,
  menuButtonRef,
  onSearchOpen,
  searchButtonRef,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isTransparent = transparent && !scrolled;

  /* Phase 90d Item 2: the logo navigates to /dashboard. Current-route
     safe — a no-op when already there (no double history entry). */
  const goDashboard = () => {
    if (location.pathname !== '/dashboard' && location.pathname !== '/') {
      navigate('/dashboard');
    }
  };

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
      {/* Hamburger menu button — Phase 89: 44px tap target, ref for drawer focus return */}
      <button
        ref={menuButtonRef}
        onClick={onMenuOpen}
        className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-100 active:scale-[0.92]"
        aria-label="Open menu"
      >
        <Menu
          size={24}
          style={{
            color: isTransparent ? '#FFFFFF' : 'var(--page-text)',
          }}
        />
      </button>

      {/* AzFIT Logo (center) — Phase 90d: tap → /dashboard (both roles) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <button
          type="button"
          onClick={goDashboard}
          aria-label="Go to dashboard"
          className="flex h-11 items-center justify-center rounded-lg px-2 transition-transform duration-100 active:scale-[0.92]"
        >
          <img
            src={isTransparent ?  './azfit-logo-text.png' :  './azfit-logo.png'}
            alt="AzFIT"
            className="h-7 object-contain"
            style={{
              filter: isTransparent ? 'none' : 'var(--logo-filter, none)',
            }}
          />
        </button>
      </div>

      {/* Right cluster — Phase 90d: Search pill (both roles) + mode toggle */}
      <div className="ml-auto flex items-center gap-2">
        {onSearchOpen && (
          <button
            ref={searchButtonRef}
            type="button"
            onClick={onSearchOpen}
            aria-label="Search (Ctrl+K)"
            className="flex h-9 items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--page-bg)] px-3 text-[var(--light-text-muted)] transition-colors hover:border-[var(--azfit-primary)]/40 hover:text-[var(--page-text)] active:scale-[0.97] motion-reduce:transition-none"
          >
            <Search size={14} className="shrink-0" />
            <span className="hidden text-xs font-medium sm:inline">Search</span>
            <kbd className="hidden rounded border border-[var(--card-border)] px-1 text-[9px] font-semibold sm:inline">
              ⌘K
            </kbd>
          </button>
        )}
        {onModeToggle && (
          <ModeToggle mode={mode} onToggle={onModeToggle} />
        )}
      </div>
    </nav>
  );
}
