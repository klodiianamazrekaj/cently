import {
  Baby, Banknote, BedDouble, Bike, BookOpen, Briefcase, Bus, Car, CarTaxiFront, Cigarette, Clapperboard, Coffee,
  Coins, CreditCard, Droplet, Dumbbell, Ellipsis, Fuel, Gamepad2, Gift, GraduationCap, Hammer, HandHeart, HeartPulse,
  Home, KeyRound, Landmark, Luggage, Music, PawPrint, PiggyBank, Pill, Plane, Repeat, Scissors, Shirt, ShoppingBasket,
  ShoppingCart, Smartphone, Sofa, Sparkles, SprayCan, SquareParking, Ticket, Utensils, UtensilsCrossed, Wallet, Wifi,
  Wine, Wrench, Zap, type LucideProps,
} from "lucide-react";

type IconDef = { key: string; label: string; Icon: React.ComponentType<LucideProps> };

// Curated icons for expense and income categories, in the order the picker shows them.
// Keys are stored in the database, so never rename one; add new keys instead.
export const CATEGORY_ICONS: IconDef[] = [
  { key: "utensils", label: "Ushqim", Icon: Utensils },
  { key: "shopping-basket", label: "Market", Icon: ShoppingBasket },
  { key: "shopping-cart", label: "Blerje", Icon: ShoppingCart },
  { key: "coffee", label: "Kafe", Icon: Coffee },
  { key: "restaurant", label: "Restorant", Icon: UtensilsCrossed },
  { key: "delivery", label: "Dërgesa", Icon: Bike },
  { key: "wine", label: "Alkool", Icon: Wine },
  { key: "cigarette", label: "Cigare", Icon: Cigarette },
  { key: "home", label: "Shtëpia", Icon: Home },
  { key: "rent", label: "Qira", Icon: KeyRound },
  { key: "electricity", label: "Rryma", Icon: Zap },
  { key: "water", label: "Uji", Icon: Droplet },
  { key: "internet", label: "Interneti", Icon: Wifi },
  { key: "phone", label: "Telefoni", Icon: Smartphone },
  { key: "furniture", label: "Mobilie", Icon: Sofa },
  { key: "cleaning", label: "Pastrim", Icon: SprayCan },
  { key: "tools", label: "Vegla", Icon: Wrench },
  { key: "repairs", label: "Riparime", Icon: Hammer },
  { key: "car", label: "Makina", Icon: Car },
  { key: "fuel", label: "Karburant", Icon: Fuel },
  { key: "bus", label: "Autobus", Icon: Bus },
  { key: "taxi", label: "Taksi", Icon: CarTaxiFront },
  { key: "parking", label: "Parking", Icon: SquareParking },
  { key: "plane", label: "Avion", Icon: Plane },
  { key: "travel", label: "Udhëtim", Icon: Luggage },
  { key: "hotel", label: "Hotel", Icon: BedDouble },
  { key: "health", label: "Shëndet", Icon: HeartPulse },
  { key: "pharmacy", label: "Barna", Icon: Pill },
  { key: "gym", label: "Palestër", Icon: Dumbbell },
  { key: "clothes", label: "Veshje", Icon: Shirt },
  { key: "sparkles", label: "Kozmetikë", Icon: Sparkles },
  { key: "haircut", label: "Flokë", Icon: Scissors },
  { key: "gift", label: "Dhurata", Icon: Gift },
  { key: "kids", label: "Fëmijë", Icon: Baby },
  { key: "pets", label: "Kafshë", Icon: PawPrint },
  { key: "ticket", label: "Argëtim", Icon: Ticket },
  { key: "cinema", label: "Kinema", Icon: Clapperboard },
  { key: "games", label: "Lojëra", Icon: Gamepad2 },
  { key: "music", label: "Muzikë", Icon: Music },
  { key: "subscriptions", label: "Abonime", Icon: Repeat },
  { key: "education", label: "Shkollim", Icon: GraduationCap },
  { key: "books", label: "Libra", Icon: BookOpen },
  { key: "work", label: "Punë", Icon: Briefcase },
  { key: "salary", label: "Rroga", Icon: Banknote },
  { key: "wallet", label: "Portofol", Icon: Wallet },
  { key: "savings", label: "Kursime", Icon: PiggyBank },
  { key: "bank", label: "Banka", Icon: Landmark },
  { key: "cash", label: "Cash", Icon: Coins },
  { key: "card", label: "Kartelë", Icon: CreditCard },
  { key: "charity", label: "Bamirësi", Icon: HandHeart },
  { key: "other", label: "Tjetër", Icon: Ellipsis },
];

const BY_KEY = new Map(CATEGORY_ICONS.map((i) => [i.key, i.Icon]));

export function CategoryIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = BY_KEY.get(name) ?? Ellipsis;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
