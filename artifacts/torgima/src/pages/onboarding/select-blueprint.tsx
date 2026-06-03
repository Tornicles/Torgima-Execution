import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { BlueprintLaunchInputScreen } from "@/components/pre-validation/BlueprintLaunchInputScreen";
import { TierLaunchProgress } from "@/components/pre-validation/TierLaunchProgress";
import {
  fetchTierPreviews,
  formatApiEnvelopeError,
  selectTierAndLaunch,
  type TierPreviewCardDto,
} from "@/lib/torgima-api";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import {
  loadValidationLaunchContext,
  saveValidationLaunchContext,
  type ValidationLaunchContext,
} from "@/lib/validation-launch-context";

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
  const [tierPreviews, setTierPreviews] = useState<TierPreviewCardDto[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null);
  const [selectingTier, setSelectingTier] = useState<TierId | null>(null);
  const [launchError, setLaunchError] = useState("");

  useEffect(() => {
    if (checking) return;
    const ctx = loadValidationLaunchContext();
    const validationId = validationIdFromQuery || ctx?.validationId || "";
    if (!ctx?.blueprintId || !validationId) {
      setLocation(validationId ? `/validation/${validationId}/results` : "/onboarding");
      return;
    }
    setContext({ ...ctx, validationId: validationIdFromQuery || ctx.validationId });
    if (ctx.selectedTier) setSelectedTier(ctx.selectedTier);

    void fetchTierPreviews(ctx.blueprintId)
      .then((previews) => {
        if (previews.length) setTierPreviews(previews);
        const recommended = previews.find((p) => p.recommended);
        if (recommended && !ctx.selectedTier) {
          setSelectedTier(recommended.tier);
        }
      })
      .catch(() => null);
  }, [checking, validationIdFromQuery, setLocation]);

  useEffect(() => {
    if (selectedTier || !me || tierPreviews.length) return;
    setSelectedTier(defaultTierForSubscription(normalizeSubscriptionTier(me.tier)));
  }, [me, selectedTier, tierPreviews.length]);

  const validationId = context?.validationId ?? validationIdFromQuery;

  function handleTierChange(tier: TierId) {
    if (selectingTier) return;
    setSelectedTier(tier);
    if (context) {
      saveValidationLaunchContext({ ...context, selectedTier: tier });
      setContext({ ...context, selectedTier: tier });
    }
  }

  async function handleSelectTier(tier: TierId) {
    if (!context?.blueprintId || selectingTier) return;

    setSelectingTier(tier);
    setSelectedTier(tier);
    setLaunchError("");

    try {
      const selectedPath = context.selectedPath ?? "adjusted";
      const result = await selectTierAndLaunch({
        validationId,
        blueprintId: context.blueprintId,
        selectedTier: tier,
        selectedPath,
      });
      window.location.href = result.redirectTo ?? "/dashboard";
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
            : "Could not build your execution system. Please try again.";
      setLaunchError(backendMessage);
      setSelectingTier(null);
    }
  }

  function handleBack() {
    if (selectingTier) return;
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
    <>
      <TierLaunchProgress active={Boolean(selectingTier)} />
      <BlueprintLaunchInputScreen
        context={context}
        selectedTier={selectedTier}
        tierPreviews={tierPreviews}
        selectingTier={selectingTier}
        onTierChange={handleTierChange}
        onSelectTier={(tier) => void handleSelectTier(tier)}
        onBack={handleBack}
        launchError={launchError}
        cardsLocked={Boolean(selectingTier)}
      />
    </>
  );
}

export { defaultTierForSubscription, TIER_RANK, normalizeSubscriptionTier };
