import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MotionRoot } from "@/lib/motion";
import { fontSyne, fontDm, fontJet } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://torgima.com"),
  title: {
    default: "Torgima — AI Execution System",
    template: "%s | Torgima",
  },
  description:
    "Turn your goals into daily intelligent action. Torgima is the AI system that builds your execution blueprint, generates your tasks, and adapts when reality changes.",
  openGraph: {
    type: "website",
    siteName: "Torgima",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@torgima",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontSyne.variable} ${fontDm.variable} ${fontJet.variable}`}>
      <body>
        <MotionRoot>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <Footer />
        </MotionRoot>
      </body>
    </html>
  );
}
