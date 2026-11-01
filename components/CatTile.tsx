import { catColor } from "@/lib/categoryStyle";
import { CategoryIcon } from "./CategoryIcon";

// Quiet neutral square with the icon drawn in the category's colour.
// filled = the soft category colour as background (used for a selected category).
export function CatTile({ icon, color, size = 36, filled = false }: { icon?: string; color?: string | null; size?: number; filled?: boolean }) {
  const { bg, fg } = catColor(icon, color);
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, flex: "none", borderRadius: Math.round(size * 0.3),
        background: filled ? bg : "var(--surface-sunken)", color: fg, display: "grid", placeItems: "center",
        transition: "background 0.2s",
      }}
    >
      <CategoryIcon name={icon ?? "other"} size={Math.round(size * 0.5)} />
    </span>
  );
}
