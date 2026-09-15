/**
 * Phase 92c — "Pulse Metal" opt-in card style.
 *
 * Activation is a `data-ui-variant="metal"` attribute on <html> (all metal
 * rules in src/index.css are scoped to it; absent = byte-identical classic).
 * Stored per user in profiles.ui_variant ('metal' | NULL) — applied on load
 * by App.tsx, toggled instantly from Settings (optimistic; reverts on save
 * failure so the UI never diverges from what persisted).
 */

export type UiVariant = 'default' | 'metal';

export function applyUiVariant(variant: UiVariant | null): void {
  if (typeof document === 'undefined') return;
  if (variant === 'metal') {
    document.documentElement.setAttribute('data-ui-variant', 'metal');
  } else {
    document.documentElement.removeAttribute('data-ui-variant');
  }
}

export function currentUiVariant(): UiVariant {
  if (typeof document === 'undefined') return 'default';
  return document.documentElement.getAttribute('data-ui-variant') === 'metal'
    ? 'metal'
    : 'default';
}
