// Phase 91 — privacy reveal store. When privacy mode is enabled, sensitive
// dashboard cards render blurred; the app-bar eye toggle flips `revealed`
// (temporary un-blur). A tiny module-level store (useSyncExternalStore) so
// BOTH the Navbar toggle and every blurred card stay in sync without prop
// drilling. Reveal is ephemeral by design — it never persists, and
// useAutoReblur re-engages the blur after a configurable idle period.

let revealed = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function isPrivacyRevealed(): boolean {
  return revealed;
}

export function setPrivacyRevealed(next: boolean): void {
  if (revealed === next) return;
  revealed = next;
  emit();
}

export function subscribePrivacyReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPrivacyRevealForTests(): void {
  revealed = false;
}
