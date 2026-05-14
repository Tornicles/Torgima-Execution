import type { Metadata } from "next";
import { FeaturesPageContent } from "@/components/sections/FeaturesPageContent";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Goal validation, execution blueprint, intelligent tasks, signals, recovery, and academy — one connected system.",
};

export default function FeaturesPage() {
  return <FeaturesPageContent />;
}
