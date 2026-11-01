// Category colours. A category can have its own colour (set in Kategoritë);
// older categories without one fall back to a colour chosen by their icon.

// Colours offered in the colour picker. Each has a soft background and a strong foreground
// token in app/globals.css (--cat-<name>-bg and --cat-<name>), tuned for light and dark.
export const CAT_COLORS = ["green", "teal", "cyan", "lime", "yellow", "amber", "brown", "pink", "violet", "slate", "gray"] as const;
export type CatColor = (typeof CAT_COLORS)[number];

const BY_ICON: Record<string, CatColor> = {
  "shopping-basket": "green",
  home: "cyan",
  car: "amber",
  sparkles: "pink",
  ticket: "violet",
  wallet: "lime",
};

const KNOWN = new Set<string>([...CAT_COLORS, "sky"]);

export function colorName(icon?: string | null, color?: string | null): string {
  if (color && KNOWN.has(color)) return color;
  return (icon && BY_ICON[icon]) || "gray";
}

export function catColor(icon?: string | null, color?: string | null) {
  const c = colorName(icon, color);
  return { bg: `var(--cat-${c}-bg)`, fg: `var(--cat-${c})` };
}
