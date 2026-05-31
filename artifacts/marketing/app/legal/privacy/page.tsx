import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "Torgima privacy policy — how we collect, use, and protect your data.",
  path: "/legal/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="section-light py-16">
      <div className="mx-auto max-w-content px-4 sm:px-6 max-w-3xl text-zinc-600 leading-relaxed space-y-6">
        <h1 className="font-syne text-4xl font-bold text-[#18181b]">Privacy Policy</h1>
        <p>Last updated: January 1, 2026</p>
        <p>
          Torgima (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Torgima execution platform and
          marketing website at torgima.com. This policy explains how we handle your information when you
          use our services.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Information we collect</h2>
        <p>
          We collect information you provide directly: account email, project goals, validation inputs,
          task feedback, and usage data necessary to operate the execution system. We do not sell your
          project data or validation reports to third parties.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">How we use information</h2>
        <p>
          Your data powers task generation, signal calculation, validation intelligence, and product
          improvement. Bhudhi processes your project context solely to generate relevant execution
          guidance within your account.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Security</h2>
        <p>
          Data is encrypted in transit (TLS) and at rest. Access is restricted to authorized personnel
          for support and infrastructure operations only.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Contact</h2>
        <p>
          Questions: privacy@torgima.com
        </p>
      </div>
    </article>
  );
}
