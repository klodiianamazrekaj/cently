import { Car, Circle, Home, ShoppingBasket, Sparkles, Ticket, Wallet, type LucideProps } from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  "shopping-basket": ShoppingBasket,
  home: Home,
  car: Car,
  sparkles: Sparkles,
  ticket: Ticket,
  wallet: Wallet,
};

export function CategoryIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
