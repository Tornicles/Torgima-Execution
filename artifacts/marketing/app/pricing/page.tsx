import type { Metadata } from "next";
import { PricingPageContent } from "@/components/sections/PricingPageContent";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Starter, Growth, and Ultimate — clear limits, one execution system. Start free.",
};

export default function PricingPage() {
  return <PricingPageContent />;
}
