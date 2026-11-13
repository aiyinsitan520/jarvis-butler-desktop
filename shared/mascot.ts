// Original Jarvis paper-orbit artwork, 2026. AGPL-3.0-only.
// Compatibility names preserve the upstream component API; no Dingmi cat artwork is included.
export type CatMood = "normal" | "ring" | "worry" | "sleep" | "happy" | "stretch" | "yawn" | "wave";
export type HeadState = "normal" | "focus" | "remind" | "bad";
function mark(state: HeadState): string {
  const accent = state === "bad" ? "#cb5a51" : "#bd744f";
  return `<rect x="13" y="11" width="38" height="43" rx="10" fill="#fffdf6" stroke="#5b6557" stroke-width="2.4"/><path d="M24 12v40M30 23h13M30 30h9M30 37h11" fill="none" stroke="#85917a" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="32" cy="33" rx="28" ry="11" transform="rotate(-32 32 33)" stroke="${accent}" stroke-width="3" fill="none"/><circle cx="51" cy="13" r="5" fill="${accent}"/><path d="M36 12v12l5-3 5 3V12" fill="#e9bb8e"/>${state === "focus" ? '<path d="M29 45h14" stroke="#5b6557" stroke-width="3" stroke-linecap="round"/>' : ''}`;
}
export function appIcon(px = 64, state: HeadState = "normal"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="16" fill="#f5ede0"/>${mark(state)}</svg>`;
}
export function head(state: HeadState = "normal", px = 24, _dark = false): string { return appIcon(px, state); }
export function cat(mood: CatMood): string {
  const state = mood === "worry" ? "bad" : mood === "sleep" || mood === "yawn" ? "focus" : mood === "ring" ? "remind" : "normal";
  return appIcon(120, state).replace('aria-hidden="true"', `class="jarvis-orbit ${mood}" aria-hidden="true"`);
}
