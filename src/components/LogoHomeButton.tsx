/* ═══════════════════════════════════════════════════════════════
   LogoHomeButton (Phase 96a) — THE shared AzFIT logo home button.

   Extracted from the Phase 90d app-bar button (Navbar.tsx) so every
   authenticated page gets the same one-tap "Go to dashboard" affordance:
   44px hit target, aria-label "Go to dashboard", current-route safe no-op
   (no double history entry).

   Asset: azfit-logo-header.png — the owner's real logo (metallic AzFIT
   glyph), box-downsampled from the 456KB original to 21.6KB at 233x192
   (rendered at 28px; DPR 2x+ still crisp). Theme treatment: the light
   theme darkens the silver faces via the --logo-filter token (defined in
   src/index.css); the dark theme renders it natively. The `transparent`
   variant keeps the Phase 90d behavior for image-backed (public-page)
   bars: azfit-logo-text.png over the hero, no filter.
   ═══════════════════════════════════════════════════════════════ */
import { useLocation, useNavigate } from 'react-router';

interface LogoHomeButtonProps {
  /** Phase 90d variant: image-backed bar (public hero) uses the dark
      text-lockup asset with no filter. App headers stay default. */
  transparent?: boolean;
  className?: string;
}

export default function LogoHomeButton({ transparent = false, className = '' }: LogoHomeButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  /* Current-route safe — a no-op when already there (90d contract). */
  const goDashboard = () => {
    if (location.pathname !== '/dashboard' && location.pathname !== '/') {
      navigate('/dashboard');
    }
  };

  return (
    <button
      type="button"
      onClick={goDashboard}
      aria-label="Go to dashboard"
      className={`flex h-11 items-center justify-center rounded-lg px-2 transition-transform duration-100 active:scale-[0.92] ${className}`}
    >
      <img
        src={transparent ? './azfit-logo-text.png' : `${import.meta.env.BASE_URL}azfit-logo-header.png`}
        alt="AzFIT"
        className="h-7 object-contain"
        style={{ filter: transparent ? 'none' : 'var(--logo-filter, none)' }}
      />
    </button>
  );
}
