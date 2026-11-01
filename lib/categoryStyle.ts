// Each top-level category gets one colour, chosen by its icon.
const BY_ICON: Record<string, string> = {
  "shopping-basket": "green",
  home: "sky",
  car: "amber",
  sparkles: "pink",
  ticket: "violet",
  wallet: "lime",
};

export function catColor(icon?: string) {
  const c = (icon && BY_ICON[icon]) || "gray";
  return { bg: `var(--cat-${c}-bg)`, fg: `var(--cat-${c})` };
}
