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

/* ── 8 skill icons orbiting the logo ── */
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

/**
 * AIShowcase — one self-contained orb unit.
 * Everything (logo, caption, glow ring, pulse waves, orbiting icons) is sized
 * from a single CSS variable --orb-size, so the whole unit scales uniformly
 * at any viewport or browser zoom. No viewport-absolute positioning, no JS
 * radius math — pure CSS.
 */
export default function AIShowcase() {
  return (
    <div className="orb-unit">
      {/* Expanding pulse waves (behind everything) */}
      <div className="orb-pulse-waves">
        <div className="orb-pulse-wave" />
        <div className="orb-pulse-wave" style={{ animationDelay: '1s' }} />
        <div className="orb-pulse-wave" style={{ animationDelay: '2s' }} />
      </div>

      {/* Thin glow ring hugging the logo (slow rotating arc) */}
      <div className="orb-ring" />

      {/* Logo + caption */}
      <div className="orb-logo">
        <img
          src={`${import.meta.env.BASE_URL}azfit-logo-text.png`}
          alt="AzFIT"
          draggable={false}
        />
        <p className="orb-caption">TRAIN SMARTER. AZFIT.</p>
      </div>

      {/* Orbiting feature icons (outside the ring, stay upright) */}
      <div className="orb-icon-orbit">
        {skillIcons.map(({ Icon, label }, i) => (
          <div
            key={label}
            className="orb-icon"
            style={{ '--i': i } as React.CSSProperties}
            title={label}
          >
            <Icon size={18} strokeWidth={1.8} />
          </div>
        ))}
      </div>
    </div>
  );
}
