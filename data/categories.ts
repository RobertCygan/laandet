import type { Category } from "@/types";
export const categories: Category[] = [
  { id: "verktoy", name: "Verktøy", icon: "drill" },
  { id: "bygg", name: "Bygg og oppussing", icon: "hammer" },
  { id: "hage", name: "Hage og skog", icon: "trees" },
  { id: "transport", name: "Bil og transport", icon: "car" },
  { id: "tilhengere", name: "Tilhengere", icon: "trailer" },
  { id: "bat", name: "Båt og sjø", icon: "sailboat" },
  { id: "friluft", name: "Friluftsliv", icon: "mountain" },
  { id: "camping", name: "Camping", icon: "tent" },
  { id: "vinter", name: "Vinterutstyr", icon: "snowflake" },
  { id: "sport", name: "Sport", icon: "bike" },
  { id: "fest", name: "Fest og arrangement", icon: "party" },
  { id: "elektronikk", name: "Elektronikk", icon: "monitor" },
  { id: "foto", name: "Foto og video", icon: "camera" },
  { id: "rengjoring", name: "Rengjøring", icon: "sparkles" },
  { id: "barn", name: "Barn og familie", icon: "baby" },
  { id: "hjem", name: "Hjem og kjøkken", icon: "home" },
  { id: "grill", name: "Grill og matlaging", icon: "flame" },
  { id: "stiger", name: "Stiger og stillas", icon: "ladder" },
  { id: "annet", name: "Annet", icon: "box" },
];
export const areas = [
  "Leinesfjord",
  "Leines",
  "Nordfold",
  "Engeløya",
  "Nordskot",
  "Bogøy",
  "Helnessund",
  "Bogen",
];
export const categoryName = (id: string) =>
  categories.find((c) => c.id === id)?.name ?? id;
