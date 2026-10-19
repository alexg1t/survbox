// DOM overlays: menu, lobby, HUD, game over and toasts. No game logic here.

export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

const SCREENS = ['menu', 'lobby', 'hud', 'gameover'] as const;
export type Screen = (typeof SCREENS)[number];

export function show(...visible: Screen[]): void {
  for (const s of SCREENS) $(`#${s}`).hidden = !visible.includes(s);
}

let toastTimer = 0;
export function toast(text: string, ms = 2000): void {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), ms);
}
