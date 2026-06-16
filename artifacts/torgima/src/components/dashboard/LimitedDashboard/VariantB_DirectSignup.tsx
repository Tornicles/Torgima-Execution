import { Link } from "wouter";
import { Compass } from "lucide-react";
import { BLUEPRINT_LABELS } from "@/lib/language-map";
import type { DirectSignupContext } from "./limited-dashboard-types";

const ANALYSIS_TOPICS = [
  "Your project and target customer",
  "Your market and revenue model",
  "Your resources and timeline",
  "Your success criteria and blockers",
] as const;

export function VariantB_DirectSignup({
  context,
  userEmail,
}: {
  context: DirectSignupContext;
  userEmail: string;
}) {
  const isStarter = context.user_tier === "starter" || context.user_tier === "free";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-2xl rounded-[24px] border border-[#E8ECF0] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#5B21FF] px-6 py-8 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">{userEmail}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Welcome to Torgima</h1>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3 text-sm text-[#475569] leading-relaxed">
            <p>Torgima turns your project idea into daily {BLUEPRINT_LABELS.orders.toLowerCase()} governed by your execution health.</p>
            <p>Before your project launches, Project Intelligence analyses whether it can succeed.</p>
            <p>Complete your analysis to get your first Order.</p>
          </div>

          <div className="rounded-2xl border border-[#E8ECF0] bg-[#F8FAFC] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">What you will cover</p>
            <ol className="mt-3 space-y-2 text-sm text-[#475569] list-decimal pl-5">
              {ANALYSIS_TOPICS.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-[#64748B]">Takes about 8–12 minutes to complete.</p>
          </div>

          <Link href="/onboarding/intake">
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B21FF] px-5 py-3 text-sm font-bold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer">
              <Compass className="w-4 h-4" aria-hidden />
              Start Project Analysis
            </span>
          </Link>

          {isStarter ? (
            <p className="text-center text-sm text-[#64748B]">
              Free preview available — answer 5 quick questions first.{" "}
              <Link href="/validate" className="font-semibold text-[#5B21FF] hover:underline">
                Try free preview
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
