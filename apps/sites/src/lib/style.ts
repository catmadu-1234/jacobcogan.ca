import type { CSSProperties } from "react";
import type { ThemeConfig } from "@senka/core/types";

const HEX = /^#[0-9a-fA-F]{6}$/;
const NEUTRAL = "#ededea";
const DEFAULT_ACCENT = "#141414";
const DEFAULT_ROW_HEIGHT = 320;

/** CSS variables for one tile in the justified grid: its aspect ratio and the colour shown while the image loads. */
export function rowItemVars(m: { width: number; height: number; color: string | null }): { "--ar": string; "--bg": string } {
  const ratio = m.width > 0 && m.height > 0 ? m.width / m.height : 1;
  return { "--ar": ratio.toFixed(4), "--bg": m.color && HEX.test(m.color) ? m.color : NEUTRAL };
}

/** Lets components pass CSS custom properties through React's `style` prop. */
export function cssVars(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties;
}

/** CSS variables for a site's own settings. Values are re-checked so nothing odd can reach a style attribute. */
export function themeStyle(theme: Pick<ThemeConfig, "accent" | "rowHeight">): string {
  const accent = HEX.test(theme.accent) ? theme.accent : DEFAULT_ACCENT;
  const rowHeight = Number.isFinite(theme.rowHeight) && theme.rowHeight >= 160 && theme.rowHeight <= 560 ? Math.round(theme.rowHeight) : DEFAULT_ROW_HEIGHT;
  return `--accent:${accent};--row-h-md:${rowHeight}px`;
}
