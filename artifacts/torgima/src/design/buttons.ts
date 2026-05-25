import { radius } from "./radius";

export const buttons = {
  primary: `${radius.button} bg-[var(--torgima-primary)] text-white font-semibold px-5 py-2.5 hover:bg-[var(--torgima-primary-hover)] disabled:opacity-50`,
  secondary: `${radius.button} border border-[var(--torgima-primary)] bg-white text-[var(--torgima-primary)] font-semibold px-5 py-2.5 hover:bg-[var(--torgima-primary-light)]`,
  ghost: `${radius.button} text-gray-600 font-medium hover:bg-gray-100 px-3 py-2`,
} as const;
