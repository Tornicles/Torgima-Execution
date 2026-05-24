import { radius } from "./radius";

export const buttons = {
  primary: `${radius.button} bg-emerald-600 text-white font-semibold px-5 py-2.5 hover:bg-emerald-700 disabled:opacity-50`,
  secondary: `${radius.button} border border-gray-200 bg-white text-gray-800 font-semibold px-5 py-2.5 hover:bg-gray-50`,
  ghost: `${radius.button} text-emerald-600 font-medium hover:underline`,
} as const;
