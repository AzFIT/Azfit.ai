import { useEffect, useRef } from 'react';
import {
  Dumbbell,
  Activity,
  Brain,
  HeartPulse,
  TrendingUp,
  MessageCircle,
  Calendar,
  BarChart3,
} from 'lucide-react';

/* ── 8 skill icons with their Lucide components ── */
const skillIcons = [
  { Icon: Dumbbell, label: 'Strength' },
  { Icon: Activity, label: 'Activity' },
  { Icon: Brain, label: 'AI Coach' },
  { Icon: HeartPulse, label: 'Health' },
  { Icon: TrendingUp, label: 'Progress' },
  { Icon: MessageCircle, label: 'Messages' },
  { Icon: Calendar, label: 'Schedule' },
  { Icon: BarChart3, label: 'Analytics' },
];

/* ── Pre-calculate icon positions around the ring ──
   8 icons evenly spaced at radius 130px from center
   on a 280px diameter ring                                 */
const RING_RADIUS = 130;
const iconPositions = skillIcons.map((_, i) => {
  const angle = (i * 360) / skillIcons.length;
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.cos(rad) * RING_RADIUS,
    y: Math.sin(rad) * RING_RADIUS,
  };
});

export default function AIShowcase() {
  const ringRef = useRef<HTMLDivElement>(null);

  /* ── Position icons around the ring on mount ── */
  useEffect(() => {
    if (!ringRef.current) return;
    const icons = ringRef.current.querySelectorAll<HTMLDivElement>('.ai-skill-icon');
    icons.forEach((icon, i) => {
      const { x, y } = iconPositions[i];
      icon.style.left = `calc(50% + ${x}px - 20px)`;
      icon.style.top = `calc(50% + ${y}px - 20px)`;
    });
  }, []);

  return (
    <div className="ai-showcase-wrap">
      {/* ── Inner container ── */}
      <div className="ai-visual-inner">
        {/* Pedestal shadow */}
        <div className="ai-pedestal" />

        {/* 3 expanding pulse wave rings */}
        <div className="ai-pulse-waves">
          <div className="ai-pulse-wave" />
          <div className="ai-pulse-wave" style={{ animationDelay: '1s' } as React.CSSProperties} />
          <div className="ai-pulse-wave" style={{ animationDelay: '2s' } as React.CSSProperties} />
        </div>

        {/* Outer rotating ring with orbiting skill icons */}
        <div className="ai-outer-ring" ref={ringRef}>
          {skillIcons.map(({ Icon, label }) => (
            <div key={label} className="ai-skill-icon" title={label}>
              <Icon size={20} strokeWidth={1.8} />
            </div>
          ))}
        </div>

        {/* Central breathing orb with AzFIT logo */}
        <div className="ai-central-orb">
          <div className="ai-central-glow" />
          <img
            src="/azfit-logo.png"
            alt="AzFIT AI"
            className="ai-orb-logo"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
