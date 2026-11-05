import {
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  Package,
  PawPrint,
  Plane,
  Plus,
  Receipt,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  UtensilsCrossed,
  Wallet,
  Wine,
  type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  food: UtensilsCrossed,
  bus: Bus,
  bulb: Lightbulb,
  house: House,
  film: Clapperboard,
  shirt: Shirt,
  health: HeartPulse,
  package: Package,
  briefcase: Briefcase,
  coins: Coins,
  wallet: Wallet,
  plus: Plus,
  coffee: Coffee,
  game: Gamepad2,
  book: BookOpen,
  pet: PawPrint,
  gift: Gift,
  plane: Plane,
  scissors: Scissors,
  gym: Dumbbell,
  car: Car,
  phone: Smartphone,
  baby: Baby,
  wine: Wine,
  fuel: Fuel,
  school: GraduationCap,
  receipt: Receipt,
  card: CreditCard,
  bank: Landmark,
};

/** Yeni kategori eklerken secilebilen ikonlar */
export const PICKABLE_ICONS = [
  'coffee', 'game', 'book', 'pet', 'gift', 'plane', 'scissors', 'gym',
  'car', 'phone', 'baby', 'wine', 'fuel', 'school', 'card', 'bank',
];

/** Eski surumdeki emoji ikonlarini yeni ikon adlarina cevirir */
const EMOJI_TO_ICON: Record<string, string> = {
  '🛒': 'cart', '🍔': 'food', '🚌': 'bus', '💡': 'bulb', '🏠': 'house', '🎬': 'film',
  '👕': 'shirt', '💊': 'health', '📦': 'package', '💼': 'briefcase', '💰': 'coins', '➕': 'wallet',
  '☕': 'coffee', '🎮': 'game', '📚': 'book', '🐶': 'pet', '🎁': 'gift', '✈️': 'plane',
  '💇': 'scissors', '🏋️': 'gym', '🚗': 'car', '📱': 'phone', '👶': 'baby', '🍺': 'wine',
  '⛽': 'fuel', '🧾': 'receipt', '💳': 'card', '🏦': 'bank',
};

/** Eski canli renkleri yeni sade paletle degistirir */
const OLD_TO_NEW_COLOR: Record<string, string> = {
  '#0f766e': '#5b7f6b', '#ea580c': '#b5687a', '#2563eb': '#4f6d9a', '#ca8a04': '#b8913a',
  '#7c3aed': '#6e5e95', '#db2777': '#3f8c8c', '#0891b2': '#8a9a5b', '#dc2626': '#a85454',
  '#64748b': '#8c8f94', '#16a34a': '#4e8a5e', '#65a30d': '#7a9a4e', '#4d7c0f': '#6b8f7a',
};

export const PALETTE = [
  '#5b7f6b', '#b5687a', '#4f6d9a', '#b8913a', '#6e5e95',
  '#3f8c8c', '#8a9a5b', '#a85454', '#7d6b5d', '#8c8f94',
];

export function normalizeIcon(icon: string): string {
  if (ICONS[icon]) return icon;
  return EMOJI_TO_ICON[icon] ?? EMOJI_TO_ICON[icon.replace(/️/g, '')] ?? 'package';
}

export function normalizeColor(color: string): string {
  return OLD_TO_NEW_COLOR[color.toLowerCase()] ?? color;
}

export function CategoryIcon({ name, size = 18 }: { name?: string; size?: number }) {
  const Icon = ICONS[normalizeIcon(name ?? 'package')] ?? Package;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
