import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { BlueprintLaunchInputScreen } from "@/components/pre-validation/BlueprintLaunchInputScreen";
import {
  apiFetchResponseWithRetry,
  completeOnboarding,
  finalizeValidationBlueprint,
  formatApiEnvelopeError,
  launchValidationBlueprint,
  selectBlueprintPath,
} from "@/lib/torgima-api";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import {
  loadValidationLaunchContext,
  saveValidationLaunchContext,
  type ValidationLaunchContext,
} from "@/lib/validation-launch-context";
import { loadPreValidationDraft } from "@/lib/pre-validation-draft";

const TIER_RANK: Record<TierId, number> = { starter: 0, growth: 1, ultimate: 2 };

function normalizeSubscriptionTier(raw?: string | null): TierId {
  if (raw === "ultimate" || raw === "growth" || raw === "starter") return raw;
  return "starter";
}

function defaultTierForSubscription(subscriptionTier: TierId): TierId {
  return TIER_RANK.growth <= TIER_RANK[subscriptionTier] ? "growth" : "starter";
}

export default function SelectBlueprintPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const validationIdFromQuery = params.get("validationId") ?? "";
  const { checking } = useAppRouteGuard("pre-launch");
  const { data: me } = useGetMe();

  const [context, setContext] = useState<ValidationLaunchContext | null>(null);
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [projectName] = useState(() => loadPreValidationDraft().projectName);

  useEffect(() => {
    if (checking) return;
    const ctx = loadValidationLaunchContext();
    const validationId = validationIdFromQuery || ctx?.validationId || "";
    if (!ctx?.blueprintId || !validationId) {
      setLocation(validationId ? `/validation/${validationId}/results` : "/onboarding");
      return;
    }
    setContext({ ...ctx, validationId });
    if (ctx.selectedTier) setSelectedTier(ctx.selectedTier);
  }, [checking, validationIdFromQuery, setLocation]);

  useEffect(() => {
    if (selectedTier || !me) return;
    setSelectedTier(defaultTierForSubscription(normalizeSubscriptionTier(me.tier)));
  }, [me, selectedTier]);

  const validationId = context?.validationId ?? validationIdFromQuery;

  function handleTierChange(tier: TierId) {
    setSelectedTier(tier);
    if (context) {
      saveValidationLaunchContext({ ...context, selectedTier: tier });
      setContext({ ...context, selectedTier: tier });
    }
  }

  async function handleLaunch() {
    if (!context?.blueprintId || !selectedTier || launching) {
      setLaunchError("Please select an execution level to continue.");
      return;
    }

    setLaunching(true);
    setLaunchError("");

    try {
      const selectedPath = context.selectedPath ?? "adjusted";

      await selectBlueprintPath(context.blueprintId, selectedPath);
      await apiFetchResponseWithRetry(`/api/v1/validation/${validationId}/select-path`, {
        method: "POST",
        body: JSON.stringify({ selectedPath }),
      });
      await finalizeValidationBlueprint(validationId, selectedPath);

      const result = await launchValidationBlueprint(validationId, {
        path: selectedPath,
        tier: selectedTier,
        blueprintTier: selectedTier,
        blueprintId: context.blueprintId,
        projectName: projectName.trim(),
      });
      await completeOnboarding();
      window.location.href = result.redirectTo ?? result.redirect_to ?? "/dashboard";
    } catch (err) {
      const backendMessage =
        err instanceof ApiError && err.data
          ? formatApiEnvelopeError(
              {
                ok: false,
                status: err.status,
                error: err.data as { message?: string; fieldErrors?: Record<string, string[]> },
              },
              err.message,
            )
          : err instanceof Error
            ? err.message
            : "Launch failed";
      setLaunchError(backendMessage);
    } finally {
      setLaunching(false);
    }
  }

  function handleBack() {
    if (validationId) setLocation(`/validation/${validationId}/results`);
    else setLocation("/onboarding");
  }

  if (checking || !context) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-white">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
      </div>
    );
  }

  return (
    <BlueprintLaunchInputScreen
      context={context}
      selectedTier={selectedTier}
      onTierChange={handleTierChange}
      onBack={handleBack}
      onLaunch={() => void handleLaunch()}
      launching={launching}
      launchError={launchError}
    />
  );
}

export { defaultTierForSubscription, TIER_RANK, normalizeSubscriptionTier };
