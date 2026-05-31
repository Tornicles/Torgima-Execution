import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { SocialProof } from "@/components/home/SocialProof";
import { ProblemSection } from "@/components/home/ProblemSection";
import { SolutionSection } from "@/components/home/SolutionSection";
import { FeaturesGrid } from "@/components/home/FeaturesGrid";
import { HowItWorksPreview } from "@/components/home/HowItWorksPreview";
import { SignalConditionDemo } from "@/components/home/SignalConditionDemo";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { UseCasesPreview } from "@/components/home/UseCasesPreview";
import { PricingPreview } from "@/components/home/PricingPreview";
import { FinalCTA } from "@/components/home/FinalCTA";
import { StatsBar } from "@/components/home/StatsBar";
import { ScreenshotsSection } from "@/components/home/ScreenshotsSection";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Torgima — Daily Task Manager, Execution System & Project Management App",
  description:
    "Torgima is the intelligent execution system that tells you exactly what to do every day to reach your goals. Replace your habit tracker, project management app, daily planner, and workflow tool with one intelligent system powered by AI.",
  keywords: [
    "daily task manager",
    "habit tracker",
    "project management app",
    "workflow automation",
    "daily planner app",
    "productivity system",
    "AI task manager",
    "execution system",
  ],
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <StatsBar />
      <ProblemSection />
      <SolutionSection />
      <FeaturesGrid />
      <HowItWorksPreview />
      <ScreenshotsSection />
      <SignalConditionDemo />
      <TestimonialsSection />
      <UseCasesPreview />
      <PricingPreview />
      <FinalCTA />
    </>
  );
}
