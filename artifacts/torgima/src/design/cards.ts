import { radius } from "./radius";

export const cards = {
  base: `${radius.card} border border-gray-200 bg-white shadow-sm`,
  padded: `${radius.card} border border-gray-200 bg-white shadow-sm p-5 lg:p-6`,
  muted: `${radius.card} border border-gray-100 bg-gray-50/80`,
} as const;
