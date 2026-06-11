import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router';
import {
  LayoutDashboard,
  BarChart3,
  UserCircle,
  Settings,
  LogOut,
  X,
  Moon,
  Sun,
  Apple,
  Scale,
  Dumbbell,
  Sparkles,
} from 'lucide-react';
import Navbar from './Navbar';
import AzFitChat from './chat/AzFitChat';
import { useTheme } from '@/hooks/useTheme';

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  transparentNav?: boolean;
  mode?: 'dashboard' | 'sheets';
  onModeToggle?: (mode: 'dashboard' | 'sheets') => void;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Dumbbell, label: 'Workouts', path: '/sheets' },
  { icon: Sparkles, label: 'AI Builder', path: '/ai-program-builder' },
  { icon: Apple, label: 'Nutrition', path: '/nutrition' },
  { icon: Scale, label: 'Bio Print', path: '/bioprint' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: UserCircle, label: 'Coach', path: '/coach' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const tabItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Dumbbell, label: 'Workouts', path: '/sheets' },
  { icon: Apple, label: 'Nutrition', path: '/nutrition' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Layout({
  children,
  showNav = true,
  transparentNav = false,
  mode = 'dashboard',
  onModeToggle,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = useCallback(
    (path: string) => {
      if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
      return location.pathname === path;
    },
    [location.pathname]
  );

  const handleNav = (path: string) => {
    if (path !== '#') {
      navigate(path);
    }
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Navbar */}
      {showNav && (
        <Navbar
          onMenuOpen={() => setSidebarOpen(true)}
          mode={mode}
          onModeToggle={onModeToggle}
          transparent={transparentNav}
        />
      )}

      {/* Desktop persistent sidebar */}
      <aside
        className="fixed left-0 top-14 hidden h-[calc(100dvh-3.5rem)] w-[280px] flex-col border-r lg:flex"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {/* Logo */}
          <div className="mb-4 flex items-center gap-3 px-3">
            <img src="./azfit-logo.png" alt="AzFIT" className="h-8 object-contain" />
            <span className="text-lg font-bold" style={{ color: 'var(--page-text)' }}>
              AzFIT
            </span>
          </div>

          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              className="flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: isActive(item.path) ? 'var(--light-elevated)' : 'transparent',
                borderLeft: isActive(item.path) ? '3px solid var(--azfit-primary)' : '3px solid transparent',
                color: isActive(item.path) ? 'var(--azfit-primary)' : 'var(--light-text-muted)',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = 'var(--light-elevated)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Theme toggle at bottom */}
        <div
          className="border-t p-4"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <button
            onClick={toggleTheme}
            className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 hover:bg-[var(--light-elevated)] active:scale-[0.98]"
            style={{ color: 'var(--light-text-muted)' }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-sm font-medium">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
          <button
            className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 hover:bg-[var(--light-elevated)] active:scale-[0.98]"
            style={{ color: 'var(--light-text-muted)' }}
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60]"
              style={{ backgroundColor: 'var(--backdrop)' }}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
              className="fixed left-0 top-0 z-[70] h-full w-[280px] overflow-y-auto shadow-2xl lg:hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                boxShadow: theme === 'dark'
                  ? '0 0 40px rgba(0,0,0,0.4)'
                  : '0 0 40px rgba(0,0,0,0.15)',
              }}
            >
              {/* Close button */}
              <div className="flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <img src="./azfit-logo.png" alt="AzFIT" className="h-7 object-contain" />
                  <span className="text-base font-bold" style={{ color: 'var(--page-text)' }}>
                    AzFIT
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg active:scale-[0.92]"
                  style={{ color: 'var(--page-text)' }}
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-1 p-3">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleNav(item.path)}
                    className="flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
                    style={{
                      backgroundColor: isActive(item.path) ? 'var(--light-elevated)' : 'transparent',
                      borderLeft: isActive(item.path) ? '3px solid var(--azfit-primary)' : '3px solid transparent',
                      color: isActive(item.path) ? 'var(--azfit-primary)' : 'var(--light-text-muted)',
                    }}
                  >
                    <item.icon size={20} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>

              {/* Bottom section */}
              <div
                className="border-t p-3"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <button
                  onClick={toggleTheme}
                  className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left active:scale-[0.98]"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  <span className="text-sm font-medium">
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </button>
                <button
                  className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left active:scale-[0.98]"
                  style={{ color: 'var(--light-text-muted)' }}
                >
                  <LogOut size={20} />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main
        className={`min-h-[100dvh] pb-16 lg:ml-[280px] lg:pb-0 ${showNav ? 'pt-14' : ''}`}
        style={{ backgroundColor: 'var(--page-bg)' }}
      >
        {children}
      </main>

      {/* Bottom tab bar (mobile only) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t lg:hidden lg:left-[280px]"
        style={{
          backgroundColor: 'var(--card-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div className="flex h-full items-center justify-around">
          {tabItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-transform duration-100 active:scale-90"
            >
              <item.icon
                size={24}
                style={{
                  color: isActive(item.path) ? 'var(--azfit-primary)' : 'var(--light-text-muted)',
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isActive(item.path) ? 'var(--azfit-primary)' : 'var(--light-text-muted)',
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* AI Chat Bubble */}
      <AzFitChat />
    </div>
  );
}
