/* PHASE FIX-3 Item 1b — spreadsheet error-token phones must never render.
 * The legacy Sheets import left literal "#ERROR!" strings in
 * clients.phone (data cleaned live 2026-09-24); this guard makes the UI
 * robust against any re-import: a value that is ONLY a spreadsheet error
 * token is omitted (honest omission — never a sanitized fake number). */

const ERROR_TOKEN = /^#(?:ERROR|N\/A|REF|VALUE|DIV\/0|NULL|NAME\?|NUM|SPILL|CALC)!?$/i;

/** True when the value is exactly a spreadsheet error token (e.g. "#ERROR!"). */
export function isErrorTokenPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return ERROR_TOKEN.test(phone.trim());
}

/** Phone to display, or null when it should be omitted entirely. */
export function displayPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed || isErrorTokenPhone(trimmed)) return null;
  return trimmed;
}
