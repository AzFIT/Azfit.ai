// ═══════════════════════════════════════════════════════════════
// TrainerAvatar (Phase 90b) — the trainer's public avatar.
// Render priority: uploaded photo ('photo' | 'blur' variant) →
// initials tile. Blur variant shows the photo softly blurred (public
// marketing use). Initials use the brand primary token on a circle,
// matching the rounded-full avatars elsewhere in the app.
// ═══════════════════════════════════════════════════════════════

import { deriveInitials, type TrainerProfile } from "@/lib/trainerProfile";
import { trainerAssetUrl } from "@/hooks/useTrainerProfile";

interface TrainerAvatarProps {
  profile: TrainerProfile | null;
  /** Name used for initials when there is no usable photo. */
  nameFallback: string;
  /** Size in px (default 48). */
  size?: number;
}

export default function TrainerAvatar({ profile, nameFallback, size = 48 }: TrainerAvatarProps) {
  const initials = deriveInitials((profile?.display_name || nameFallback || "").trim());
  const usePhoto =
    profile !== null &&
    profile.photo_path !== null &&
    (profile.photo_variant === "photo" || profile.photo_variant === "blur");

  if (usePhoto && profile !== null && profile.photo_path !== null) {
    const blurred = profile.photo_variant === "blur";
    return (
      <img
        src={trainerAssetUrl(profile.photo_path)}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${blurred ? "blur-sm scale-110" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: "var(--azfit-primary)", fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
