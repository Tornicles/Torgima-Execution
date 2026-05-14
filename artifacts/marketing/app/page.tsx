import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Benefits } from "@/components/sections/Benefits";
import { ProductPreview } from "@/components/sections/ProductPreview";
import { Differentiation } from "@/components/sections/Differentiation";
import { SocialProof } from "@/components/sections/SocialProof";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Benefits />
      <ProductPreview />
      <Differentiation />
      <SocialProof />
      <FinalCTA />
    </>
  );
}
