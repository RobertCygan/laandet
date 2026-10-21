import {
  Drill,
  Hammer,
  Trees,
  Car,
  Caravan,
  Sailboat,
  Mountain,
  Tent,
  Snowflake,
  Bike,
  PartyPopper,
  Monitor,
  Camera,
  Sparkles,
  Baby,
  House,
  Flame,
  Fence,
  Package,
  type LucideProps,
} from "lucide-react";
const icons = {
  drill: Drill,
  hammer: Hammer,
  trees: Trees,
  car: Car,
  trailer: Caravan,
  sailboat: Sailboat,
  mountain: Mountain,
  tent: Tent,
  snowflake: Snowflake,
  bike: Bike,
  party: PartyPopper,
  monitor: Monitor,
  camera: Camera,
  sparkles: Sparkles,
  baby: Baby,
  home: House,
  flame: Flame,
  ladder: Fence,
  box: Package,
};
export function CategoryIcon({
  name,
  ...props
}: LucideProps & { name: string }) {
  const Component = icons[name as keyof typeof icons] || Package;
  return <Component {...props} strokeWidth={1.6} />;
}
export function Logo({ symbol = false }: { symbol?: boolean }) {
  return (
    <span className="brand">
      <svg
        width="37"
        height="37"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M29 12H17a9 9 0 0 0 0 18h2M11 28h12a9 9 0 0 0 0-18h-2"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="m24 7 5 5-5 5M16 23l-5 5 5 5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!symbol && (
        <span>
          Lånndet<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
