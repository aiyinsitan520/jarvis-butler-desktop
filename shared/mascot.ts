// Original Jarvis white kitten, approved 2026-11-13. AGPL-3.0-only.
// Independent vector adaptation of our generated candidate; see docs/branding.md.
// Compatibility names preserve upstream APIs; no upstream artwork is included.
export type CatMood = "normal" | "ring" | "worry" | "sleep" | "happy" | "stretch" | "yawn" | "wave";
export type HeadState = "normal" | "focus" | "remind" | "bad";
function kitten(state: HeadState, small = false, dark = false): string {
  const outline = small ? (dark ? "#b8d1e8" : "#59738b") : "#bac5ce";
  const eyes = state === "focus"
    ? '<path d="M21 35q3-3 6 0M37 35q3-3 6 0" fill="none" stroke="#59473d" stroke-width="2.4" stroke-linecap="round"/>'
    : '<g fill="#59473d"><ellipse cx="24" cy="35" rx="2.1" ry="2.9"/><ellipse cx="40" cy="35" rx="2.1" ry="2.9"/></g>';
  const badge = state === "bad"
    ? '<circle cx="52" cy="51" r="9" fill="#cd615a"/><path d="M52 45v7m0 4v.1" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
    : state === "remind" ? '<circle cx="52" cy="51" r="7" fill="#ed9a54" stroke="#fff" stroke-width="2"/>' : '';
  return `<path d="M11 26Q9 12 14 10Q18 8 25 16Q32 13 39 16Q47 8 50 10Q55 12 53 26Q61 36 56 46Q51 56 32 57Q13 56 8 46Q3 36 11 26Z" fill="#fffdfc" stroke="${outline}" stroke-width="${small ? 2.5 : 1.4}" stroke-linejoin="round"/><path d="M46 15q2 6 6 7v-7q-3 1-6 0" fill="#e0e2e4"/><g class="jarvis-face">${eyes}<path d="M30 39q2-1 4 0q0 2-2 3q-2-1-2-3" fill="#eea4ad"/><path d="M28 43q2 3 4 0q2 3 4 0" fill="none" stroke="#a8a6a4" stroke-width="1.8" stroke-linecap="round"/>${small ? '' : '<path d="M14 40h4m28 0h4" stroke="#c2c4c6" stroke-width="1.8" stroke-linecap="round"/>'}</g>${badge}`;
}
export function appIcon(px = 64, state: HeadState = "normal"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="16" fill="#add3f6"/>${kitten(state)}</svg>`;
}
/** Fewer details and a stronger outline remain readable at 16–32px. */
export function trayIcon(px = 32, state: HeadState = "normal", dark = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64">${kitten(state, true, dark)}</svg>`;
}
export function head(state: HeadState = "normal", px = 24, _dark = false): string { return appIcon(px, state); }
export function cat(mood: CatMood): string {
  const state = mood === "worry" ? "bad" : mood === "sleep" || mood === "yawn" ? "focus" : mood === "ring" ? "remind" : "normal";
  return appIcon(120, state).replace('aria-hidden="true"', `class="jarvis-orbit ${mood}" aria-hidden="true"`);
}
