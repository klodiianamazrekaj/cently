import { catColor } from "@/lib/categoryStyle";
import { CategoryIcon } from "./CategoryIcon";

// Rounded square in the category's colour with its icon.
export function CatTile({ icon, size = 40 }: { icon?: string; size?: number }) {
  const { bg, fg } = catColor(icon);
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, flex: "none", borderRadius: Math.round(size * 0.32),
        background: bg, color: fg, display: "grid", placeItems: "center",
      }}
    >
      <CategoryIcon name={icon ?? "circle"} size={Math.round(size * 0.48)} />
    </span>
  );
}
