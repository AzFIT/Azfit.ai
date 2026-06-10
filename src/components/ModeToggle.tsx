import { useRef, useEffect } from 'react';

interface ModeToggleProps {
  mode: 'dashboard' | 'sheets';
  onToggle: (mode: 'dashboard' | 'sheets') => void;
}

export default function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLButtonElement>(null);
  const sheetsRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const activeRef = mode === 'dashboard' ? dashboardRef : sheetsRef;
    if (activeRef.current && indicatorRef.current) {
      indicatorRef.current.style.width = `${activeRef.current.offsetWidth}px`;
      indicatorRef.current.style.transform = `translateX(${activeRef.current.offsetLeft}px)`;
    }
  }, [mode]);

  return (
    <div
      className="relative flex h-9 items-center rounded-full p-1"
      style={{ backgroundColor: 'var(--light-elevated)' }}
    >
      {/* Sliding indicator */}
      <div
        ref={indicatorRef}
        className="absolute top-1 h-7 rounded-full"
        style={{
          backgroundColor: 'var(--azfit-primary)',
          transition: 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94), width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      />

      {/* Dashboard button */}
      <button
        ref={dashboardRef}
        onClick={() => onToggle('dashboard')}
        className="relative z-10 px-3 py-1 text-[13px] font-semibold transition-colors duration-200 lg:px-4"
        style={{
          color: mode === 'dashboard' ? '#FFFFFF' : 'var(--light-text-secondary)',
        }}
      >
        Dashboard
      </button>

      {/* Sheets button */}
      <button
        ref={sheetsRef}
        onClick={() => onToggle('sheets')}
        className="relative z-10 px-3 py-1 text-[13px] font-semibold transition-colors duration-200 lg:px-4"
        style={{
          color: mode === 'sheets' ? '#FFFFFF' : 'var(--light-text-secondary)',
        }}
      >
        Sheets
      </button>
    </div>
  );
}
