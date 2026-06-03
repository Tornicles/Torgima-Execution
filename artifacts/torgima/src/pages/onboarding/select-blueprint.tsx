import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { BlueprintLaunchInputScreen } from "@/components/pre-validation/BlueprintLaunchInputScreen";
import { TierLaunchProgress } from "@/components/pre-validation/TierLaunchProgress";
import {
  apiGet,
  configureOnboardingTier,
  fetchTierPreviews,
  formatApiEnvelopeError,
  selectTierAndLaunch,
  type TierPreviewCardDto,
} from "@/lib/torgima-api";
import { LANGUAGE } from "@/lib/language";
import { useOnboardingActiveBlueprintGuard } from "@/hooks/useOnboardingActiveBlueprintGuard";
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
  useOnboardingActiveBlueprintGuard();
  const params = new URLSearchParams(search);
  const validationIdFromQuery = params.get("validationId") ?? "";
  const { checking } = useAppRouteGuard("pre-launch");
  const { data: me } = useGetMe();

  const [context, setContext] = useState<ValidationLaunchContext | null>(null);
  const [tierPreviews, setTierPreviews] = useState<TierPreviewCardDto[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null);
  const [selectingTier, setSelectingTier] = useState<TierId | null>(null);
  const [tierConfigured, setTierConfigured] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  useEffect(() => {
    if (checking) return;
    const ctx = loadValidationLaunchContext();
    const validationId = validationIdFromQuery || ctx?.validationId || "";
    if (!validationId) {
      setLocation("/onboarding");
      return;
    }

    async function hydrateContext(base: ValidationLaunchContext | null) {
      let blueprintId = base?.blueprintId ?? "";
      if (!blueprintId || blueprintId === validationId) {
        try {
          const result = await apiGet<{ blueprintId?: string }>(
            `/api/validation/${validationId}/result`,
          );
          blueprintId = String(result.blueprintId ?? "");
        } catch {
          blueprintId = "";
        }
      }
      if (!blueprintId) {
        setLocation(`/validation/${validationId}/results`);
        return;
      }
      const merged: ValidationLaunchContext = {
        ...(base ?? {
          validationId,
          selectedPath: "adjusted",
          goal: "",
          purpose: "",
          timeframeLabel: "—",
          location: "—",
          domain: "—",
          commitmentLevel: "—",
          verdict: "ADJUST",
          directionLabel: "Adjusted Path (Best Fit)",
        }),
        validationId,
        blueprintId,
      };
      setContext(merged);
      saveValidationLaunchContext(merged);
      if (merged.selectedTier) setSelectedTier(merged.selectedTier);

      void fetchTierPreviews(blueprintId)
      .then((previews) => {
        if (previews.length) setTierPreviews(previews);
        const recommended = previews.find((p) => p.recommended);
        if (recommended && !merged.selectedTier) {
          setSelectedTier(recommended.tier);
        }
      })
      .catch(() => null);
    }

    void hydrateContext(ctx);
  }, [checking, validationIdFromQuery, setLocation]);

  useEffect(() => {
    if (selectedTier || !me || tierPreviews.length) return;
    setSelectedTier(defaultTierForSubscription(normalizeSubscriptionTier(me.tier)));
  }, [me, selectedTier, tierPreviews.length]);

  const validationId = context?.validationId ?? validationIdFromQuery;

  function handleTierChange(tier: TierId) {
    if (selectingTier || launching) return;
    setSelectedTier(tier);
    setTierConfigured(false);
    if (context) {
      saveValidationLaunchContext({ ...context, selectedTier: tier });
      setContext({ ...context, selectedTier: tier });
    }
  }

  /** DOC 32 — tier selection persists before activation. */
  async function handleSelectTier(tier: TierId) {
    if (!context?.blueprintId || selectingTier || launching) return;

    setSelectingTier(tier);
    setSelectedTier(tier);
    setLaunchError("");

    try {
      await configureOnboardingTier({
        blueprintId: context.blueprintId,
        tier,
        mode: "individual",
      });
      setTierConfigured(true);
      if (context) {
        saveValidationLaunchContext({ ...context, selectedTier: tier });
        setContext({ ...context, selectedTier: tier });
      }
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
            : "Could not save your execution level. Please try again.";
      setLaunchError(backendMessage);
      setTierConfigured(false);
    } finally {
      setSelectingTier(null);
    }
  }

  async function handleActivate() {
    if (!context?.blueprintId || launching) return;
    if (!selectedTier || !tierConfigured) {
      setLaunchError(LANGUAGE.onboarding.tierRequired);
      return;
    }

    setLaunching(true);
    setLaunchError("");

    try {
      const selectedPath = context.selectedPath ?? "adjusted";
      const result = await selectTierAndLaunch({
        validationId,
        blueprintId: context.blueprintId,
        selectedTier,
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
      setLaunching(false);
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
      <TierLaunchProgress active={Boolean(selectingTier || launching)} />
      <BlueprintLaunchInputScreen
        context={context}
        selectedTier={selectedTier}
        tierPreviews={tierPreviews}
        selectingTier={selectingTier}
        onTierChange={handleTierChange}
        onSelectTier={(tier) => void handleSelectTier(tier)}
        onLaunch={() => void handleActivate()}
        launching={launching}
        launchEnabled={tierConfigured}
        onBack={handleBack}
        launchError={launchError}
        cardsLocked={Boolean(selectingTier || launching)}
      />
    </>
  );
}

export { defaultTierForSubscription, TIER_RANK, normalizeSubscriptionTier };
