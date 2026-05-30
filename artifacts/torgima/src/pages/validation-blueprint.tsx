import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ApiError } from "@workspace/api-client-react";
import { BlueprintLaunchInputScreen } from "@/components/pre-validation/BlueprintLaunchInputScreen";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import type { PathKey } from "@/components/validation/PathPanels";
import type { ValidationScreenData } from "@/components/validation/ValidationScreen";
import {
  apiFetchEnvelope,
  apiFetchResponseWithRetry,
  completeOnboarding,
  finalizeValidationBlueprint,
  launchValidationBlueprint,
} from "@/lib/torgima-api";
import { API_BASE_URL } from "@/lib/api-base";
import {
  buildLaunchContextFromPayload,
  loadValidationLaunchContext,
  saveValidationLaunchContext,
  type ValidationLaunchContext,
} from "@/lib/validation-launch-context";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

type ValidationPayload = ValidationScreenData & { status?: string };

export default function ValidationBlueprintPage() {
  const [, params] = useRoute("/validation/:id/blueprint");
  const validationId = params?.id ?? "";
  const { checking } = useAppRouteGuard("pre-launch");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [launching, setLaunching] = useState(false);
  const [context, setContext] = useState<ValidationLaunchContext | null>(null);
  const [selectedTier, setSelectedTier] = useState<TierId>("starter");
  const [selectedPath, setSelectedPath] = useState<PathKey>("adjusted");
  const [isFinalized, setIsFinalized] = useState(false);

  useEffect(() => {
    if (!validationId || checking) return;
    void loadPage();
  }, [validationId, checking]);

  async function loadPage() {
    setLoading(true);
    setError("");
    try {
      const cached = loadValidationLaunchContext();
      if (cached?.validationId === validationId) {
        setContext(cached);
        setSelectedPath(cached.selectedPath);
        setLoading(false);
        return;
      }

      const resultRes = await apiFetchResponseWithRetry(`/api/validation/${validationId}/result`);
      const resultJson = (await resultRes.json()) as { ok?: boolean; data?: ValidationPayload };
      let payload = resultJson.ok && resultJson.data ? resultJson.data : null;

      const runEnvelope = await apiFetchEnvelope<Record<string, unknown>>(`/api/v1/validation/${validationId}`);
      if (runEnvelope.ok && runEnvelope.data) {
        const erectorResult = runEnvelope.data;
        payload = {
          ...(payload ?? {}),
          erectorValidationId: validationId,
          blueprintId: String(erectorResult.blueprintId ?? payload?.blueprintId ?? ""),
          intelligence: {
            ...(payload?.intelligence ?? {}),
            erector: {
              ...(typeof payload?.intelligence?.erector === "object" ? (payload.intelligence.erector as object) : {}),
              ...erectorResult,
            },
          },
          verdict: String(erectorResult.verdict ?? payload?.verdict ?? "adjust"),
          paths: (erectorResult.paths as ValidationPayload["paths"]) ?? payload?.paths,
        };
      }

      if (!payload?.blueprintId) {
        setError("Complete validation before choosing a blueprint.");
        return;
      }

      const rec: PathKey =
        payload.verdict === "adjust" ? "adjusted" : payload.verdict === "pivot" ? "alternative" : "current";
      setSelectedPath(rec);
      setIsFinalized(Boolean((payload as { isFinalized?: boolean }).isFinalized));

      const ctx = buildLaunchContextFromPayload(validationId, payload, rec);
      setContext(ctx);
      saveValidationLaunchContext(ctx);

      const recommended = String(
        runEnvelope.data?.recommendedBlueprintLevel ?? runEnvelope.data?.recommended_blueprint_level ?? "starter",
      );
      if (recommended === "growth" || recommended === "ultimate" || recommended === "starter") {
        setSelectedTier(recommended);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!context?.blueprintId || launching) return;
    const launchUrl = `${API_BASE_URL}/api/v1/validations/${validationId}/launch`;

    setLaunching(true);
    setLaunchError("");
    try {
      await apiFetchResponseWithRetry(`/api/v1/validation/${validationId}/select-path`, {
        method: "POST",
        body: JSON.stringify({ selectedPath }),
      });

      if (!isFinalized) {
        await finalizeValidationBlueprint(validationId, selectedPath);
        setIsFinalized(true);
      }

      const result = await launchValidationBlueprint(validationId, {
        path: selectedPath,
        tier: selectedTier,
        selected_blueprint_type: selectedTier,
      });
      await completeOnboarding();
      window.location.href = result.redirectTo ?? result.redirect_to ?? "/dashboard";
    } catch (err) {
      const status = err instanceof ApiError ? err.status : "—";
      const backendMessage =
        err instanceof ApiError && err.data ? JSON.stringify(err.data) : err instanceof Error ? err.message : "Unknown";
      setLaunchError([`Launch failed (HTTP ${status})`, `URL: ${launchUrl}`, backendMessage].join("\n"));
    } finally {
      setLaunching(false);
    }
  }

  if (checking || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
        <p className="text-sm text-red-600">{error || "Missing validation context."}</p>
        <Link href={`/validation/${validationId}/results`} className="text-sm font-semibold text-[#5B21FF] underline">
          Back to validation results
        </Link>
      </div>
    );
  }

  return (
    <BlueprintLaunchInputScreen
      context={context}
      selectedTier={selectedTier}
      onTierChange={setSelectedTier}
      onBack={() => {
        window.location.href = `/validation/${validationId}/results`;
      }}
      onLaunch={() => void handleLaunch()}
      launching={launching}
      launchError={launchError}
    />
  );
}
