import { Link } from "wouter";
import { Compass, Lock, Sparkles } from "lucide-react";
import { BLUEPRINT_LABELS, ERECTOR_LABELS, getTierLabel } from "@/lib/language-map";

export type LimitedDashboardUser = {
  id: string;
  email: string;
  tier: string;
};

export type LimitedDashboardPreview = {
  projectName?: string | null;
  goal?: string | null;
  blueprintTier?: string | null;
  validationSummary?: string | null;
};

export function LimitedModeBanner({
  user,
  message,
  preview,
}: {
  user: LimitedDashboardUser;
  message: string;
  preview?: LimitedDashboardPreview;
}) {
  const tierLabel = getTierLabel(preview?.blueprintTier ?? user.tier);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-2xl rounded-[24px] border border-[#E8ECF0] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#5B21FF] px-6 py-8 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">
            Setup required
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">{message}</h1>
          <p className="mt-3 text-sm text-violet-100 leading-relaxed">
            Finish {ERECTOR_LABELS.erector_authenticated} to unlock your {BLUEPRINT_LABELS.blueprint.toLowerCase()},
            daily {BLUEPRINT_LABELS.orders.toLowerCase()}, and {BLUEPRINT_LABELS.signals.toLowerCase()}.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#E8ECF0] bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                {BLUEPRINT_LABELS.blueprint}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                {preview?.projectName?.trim() || preview?.goal?.trim() || "Not named yet"}
              </p>
              {preview?.goal && preview.projectName ? (
                <p className="mt-1 text-xs text-[#64748B] line-clamp-2">{preview.goal}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#E8ECF0] bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Plan</p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">{tierLabel}</p>
              <p className="mt-1 text-xs text-[#64748B]">{user.email}</p>
            </div>
          </div>

          {preview?.validationSummary ? (
            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#5B21FF] shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#5B21FF]">
                    {ERECTOR_LABELS.validation_report}
                  </p>
                  <p className="mt-1 text-sm text-[#334155]">{preview.validationSummary}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#94A3B8] shrink-0 mt-0.5" aria-hidden />
              <div className="text-sm text-[#64748B] space-y-1">
                <p className="font-semibold text-[#475569]">Locked until activation</p>
                <p>
                  {BLUEPRINT_LABELS.orders}, {BLUEPRINT_LABELS.signals.toLowerCase()}, and{" "}
                  {BLUEPRINT_LABELS.conditions.toLowerCase()} stay hidden until your project is active.
                </p>
              </div>
            </div>
          </div>

          <Link href="/validate">
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B21FF] px-5 py-3 text-sm font-bold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer">
              <Compass className="w-4 h-4" aria-hidden />
              Complete {ERECTOR_LABELS.erector_authenticated}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
