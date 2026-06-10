import { useEffect, useState } from 'react';

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  percentage: number;
  color: string;
  label: string;
  value: string;
  glowClass?: string;
}

export default function ProgressRing({
  size = 120,
  strokeWidth = 8,
  percentage,
  color,
  label,
  value,
  glowClass = 'glow-teal',
}: ProgressRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="opacity-30"
            style={{ color: 'var(--light-border)' }}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={glowClass}
            style={{
              transition: 'stroke-dashoffset 1000ms ease-out',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-lg font-medium leading-tight lg:text-[22px]"
            style={{ color }}
          >
            {value}
          </span>
          <span
            className="mt-0.5 text-[11px] font-medium leading-tight tracking-wide lg:text-xs"
            style={{ color: 'var(--light-text-muted)' }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
