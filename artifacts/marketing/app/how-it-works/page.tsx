import type { Metadata } from "next";
import { HowItWorksFullPage } from "@/components/sections/HowItWorksFullPage";

export const metadata: Metadata = {
  title: "How It Works",
  description: "From goal and validation to blueprint, daily loop, signals, and adaptive control.",
};

export default function Page() {
  return <HowItWorksFullPage />;
}
