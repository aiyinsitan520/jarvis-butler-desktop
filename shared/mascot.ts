// Original Jarvis bookmark-sprout robot, 2026. AGPL-3.0-only.
// Vector adaptation of our built-in imagegen design; provenance: docs/branding.md.
// Compatibility names preserve the upstream component API; no Dingmi cat artwork is included.
export type CatMood = "normal" | "ring" | "worry" | "sleep" | "happy" | "stretch" | "yawn" | "wave";
export type HeadState = "normal" | "focus" | "remind" | "bad";
function mark(state: HeadState): string {
  const line = "#254b36", accent = state === "bad" ? "#db6454" : "#ee8a46";
  const eyes = state === "focus"
    ? '<path d="M21 35q3-3 6 0M37 35q3-3 6 0" fill="none" stroke="#263729" stroke-width="2.8" stroke-linecap="round"/>'
    : '<g fill="#263729"><ellipse cx="24" cy="35" rx="3.4" ry="4.7"/><ellipse cx="40" cy="35" rx="3.4" ry="4.7"/></g><g fill="#fff9e9"><circle cx="23" cy="33" r="1.1"/><circle cx="39" cy="33" r="1.1"/></g>';
  const mouth = state === "bad" ? 'M29 44q3-3 6 0' : 'M29 42q3 4 6 0';
  return `<g stroke="${line}" stroke-width="2.5" stroke-linejoin="round"><rect x="5" y="30" width="10" height="17" rx="5" fill="#8cb997"/><rect x="49" y="30" width="10" height="17" rx="5" fill="#8cb997"/><rect x="11" y="17" width="42" height="39" rx="16" fill="#8ab792"/><rect x="16" y="25" width="32" height="25" rx="11" fill="#c3e6cb" stroke="none"/><path d="M41 18v-6q0-5 5-5h1q6 0 6 6v13l-6-4-6 4z" fill="${accent}"/></g><g class="jarvis-face">${eyes}<g fill="#f1ab85"><ellipse cx="20" cy="42" rx="2.5" ry="1.5"/><ellipse cx="44" cy="42" rx="2.5" ry="1.5"/></g><path d="${mouth}" fill="none" stroke="${line}" stroke-width="2.3" stroke-linecap="round"/></g>${state === "remind" ? '<circle cx="53" cy="52" r="5" fill="#ed8c42" stroke="#fff9ed" stroke-width="2"/>' : ''}`;
}
export function appIcon(px = 64, state: HeadState = "normal"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="16" fill="#fff4e4"/>${mark(state)}</svg>`;
}
/** Fewer details, higher contrast at 16–32px; all states have distinct shapes. */
export function trayIcon(px=32,state:HeadState="normal",dark=false):string {
  const line=dark?"#f1f6ed":"#254b36",fill=dark?"#90c29a":"#abd1b2";
  const eyes=state==="focus"?'<path d="M20 33h6M38 33h6" stroke="#243a2d" stroke-width="4" stroke-linecap="round"/>':'<ellipse cx="23" cy="33" rx="3.8" ry="5" fill="#243a2d"/><ellipse cx="41" cy="33" rx="3.8" ry="5" fill="#243a2d"/>';
  const badge=state==="bad"?'<circle cx="50" cy="49" r="10" fill="#dc6558"/><path d="M50 42v8m0 5v1" stroke="#fff" stroke-width="3" stroke-linecap="round"/>':state==="remind"?'<circle cx="50" cy="49" r="9" fill="#eb8c42" stroke="#fff4e4" stroke-width="2"/>':'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64"><rect x="6" y="14" width="52" height="43" rx="17" fill="${fill}" stroke="${line}" stroke-width="3"/><path d="M40 17V7h14v17l-7-4-7 4z" fill="#ed8c42" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>${eyes}<path d="M28 44q4 5 8 0" fill="none" stroke="#243a2d" stroke-width="3" stroke-linecap="round"/>${badge}</svg>`;
}
export function head(state: HeadState = "normal", px = 24, _dark = false): string { return appIcon(px, state); }
export function cat(mood: CatMood): string {
  const state = mood === "worry" ? "bad" : mood === "sleep" || mood === "yawn" ? "focus" : mood === "ring" ? "remind" : "normal";
  return appIcon(120, state).replace('aria-hidden="true"', `class="jarvis-orbit ${mood}" aria-hidden="true"`);
}
