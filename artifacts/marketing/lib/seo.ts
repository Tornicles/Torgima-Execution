import type { Metadata } from "next";

const SITE = "https://torgima.com";

export function pageMetadata(opts: {
  title: string;
  description: string;
  keywords?: string[];
  path?: string;
  ogImage?: string;
}): Metadata {
  const url = opts.path ? `${SITE}${opts.path}` : SITE;
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: "Torgima",
      type: "website",
      images: [{ url: opts.ogImage ?? "/og-image.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      site: "@torgima",
      images: [opts.ogImage ?? "/og-image.png"],
    },
  };
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.torgima.com";
export const VALIDATE_URL = `${APP_URL}/validate`;
export const SIGNUP_URL = `${APP_URL}/signup`;
