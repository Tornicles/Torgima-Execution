import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "Torgima terms of service — agreement for using the execution platform.",
  path: "/legal/terms",
});

export default function TermsPage() {
  return (
    <article className="section-light py-16">
      <div className="mx-auto max-w-content px-4 sm:px-6 max-w-3xl text-zinc-600 leading-relaxed space-y-6">
        <h1 className="font-syne text-4xl font-bold text-[#18181b]">Terms of Service</h1>
        <p>Last updated: January 1, 2026</p>
        <p>
          By accessing Torgima at torgima.com or app.torgima.com, you agree to these terms. If you do not
          agree, do not use the service.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Service description</h2>
        <p>
          Torgima provides an execution operating system including idea validation, project structure
          generation, daily task assignment, signal tracking, and AI-assisted guidance through Bhudhi.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Accounts</h2>
        <p>
          You are responsible for your account credentials and for all activity under your account. You
          must provide accurate information during registration and validation.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Billing</h2>
        <p>
          Paid plans renew automatically unless cancelled. Refunds are available within 14 days of first
          paid subscription if the service did not deliver value — contact support@torgima.com.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Limitation of liability</h2>
        <p>
          Torgima provides execution guidance and market intelligence, not financial, legal, or
          investment advice. Business outcomes depend on your execution. We are not liable for business
          decisions made using validation reports or generated tasks.
        </p>
        <h2 className="font-syne text-xl font-bold text-[#18181b] pt-4">Contact</h2>
        <p>legal@torgima.com</p>
      </div>
    </article>
  );
}
