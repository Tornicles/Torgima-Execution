import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyCTA } from "@/components/layout/MobileStickyCTA";
import { PageBackground } from "@workspace/design-system";
import { fontSyne, fontDm, fontJet } from "@/lib/fonts";
import "@workspace/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://torgima.com"),
  title: {
    default: "Torgima — Daily Task Manager & Execution System",
    template: "%s | Torgima",
  },
  description:
    "Torgima is the intelligent execution system that validates your idea, builds your project plan, and tells you exactly 8 tasks to do every day. Replaces habit trackers, project managers, and daily planners.",
  keywords: [
    "daily task manager",
    "habit tracker",
    "project management",
    "execution system",
    "AI task manager",
    "daily planner",
    "workflow automation",
    "goal tracker",
    "productivity app",
  ],
  robots: "index, follow",
  openGraph: { type: "website", siteName: "Torgima", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", site: "@torgima" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Torgima",
  applicationCategory: "ProductivityApplication",
  description:
    "Intelligent execution system for daily task management, habit tracking, and project execution",
  url: "https://torgima.com",
  offers: [
    { "@type": "Offer", price: "9", priceCurrency: "USD", name: "Starter" },
    { "@type": "Offer", price: "29", priceCurrency: "USD", name: "Growth" },
    { "@type": "Offer", price: "79", priceCurrency: "USD", name: "Ultimate" },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "2400",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSyne.variable} ${fontDm.variable} ${fontJet.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <PageBackground />
        <Navbar />
        <main className="min-h-screen pt-16 pb-20 md:pb-0">{children}</main>
        <Footer />
        <MobileStickyCTA />
      </body>
    </html>
  );
}
