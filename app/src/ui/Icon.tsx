import {
  Axe,
  Baby,
  Bike,
  Box,
  Camera,
  Construction,
  Drill,
  Dumbbell,
  Flame,
  Hammer,
  House,
  Monitor,
  Package,
  PartyPopper,
  Sailboat,
  Shirt,
  Snowflake,
  Sofa,
  Sparkles,
  Tent,
  Trees,
  Truck,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  axe: Axe,
  baby: Baby,
  bike: Bike,
  box: Box,
  camera: Camera,
  construction: Construction,
  drill: Drill,
  dumbbell: Dumbbell,
  flame: Flame,
  hammer: Hammer,
  house: House,
  monitor: Monitor,
  package: Package,
  "party-popper": PartyPopper,
  sailboat: Sailboat,
  shirt: Shirt,
  snowflake: Snowflake,
  sofa: Sofa,
  sparkles: Sparkles,
  tent: Tent,
  trees: Trees,
  truck: Truck,
};

/** Category icon by name (names are stored in the categories table). */
export function CategoryIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? Box;
  return <Cmp size={size} aria-hidden="true" />;
}
