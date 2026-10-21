// Disabling research mode alone does not enable a marketplace. Payments and real
// bookings deliberately have no implementation or API route in this MVP.
export const RESEARCH_MODE = true;
export const BRAND = "Lånndet";
export const STORAGE_KEYS = {
  events: "laanndet:events:v1",
  surveys: "laanndet:surveys:v1",
  favorites: "laanndet:favorites:v1",
  interests: "laanndet:interests:v1",
  draft: "laanndet:draft:v1",
  tracking: "laanndet:tracking:v1",
};
export const units = {
  hour: "time",
  day: "dag",
  weekend: "helg",
  week: "uke",
} as const;
export const nok = (value: number) =>
  new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(value);
