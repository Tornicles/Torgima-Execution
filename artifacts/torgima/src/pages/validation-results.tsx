import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { ApiError } from "@workspace/api-client-react";
import { PreLaunchShell } from "@/components/shell/PreLaunchShell";
import { ValidationResultsDashboard } from "@/components/validation/ValidationResultsDashboard";
import type { ValidationScreenData } from "@/components/validation/ValidationScreen";
import type { PathKey } from "@/components/validation/PathPanels";
import type { TierId, ModeId } from "@/components/blueprint/BlueprintSelectionPanel";
import {
  apiFetchEnvelope,
  apiFetchResponseWithRetry,
  launchValidationBlueprint,
  completeOnboarding,
} from "@/lib/torgima-api";
import { API_BASE_URL } from "@/lib/api-base";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

type ValidationPayload = ValidationScreenData & { status?: string };

function normalizePayload(payload: ValidationPayload): ValidationPayload {
  return { ...payload, status: "validated" };
}

export default function ValidationResultsPage() {
  const [, params] = useRoute("/validation/:id/results");
  const validationId = params?.id ?? "";
  const { checking } = useAppRouteGuard("pre-launch");

  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathKey>("adjusted");
  const [selectedTier] = useState<TierId>("starter");
  const [selectedMode] = useState<ModeId>("individual");

  useEffect(() => {
    if (!validationId || checking) return;
    void loadResults();
  }, [validationId, checking]);

  async function loadResults() {
    setLoading(true);
    setError("");
    try {
      const resultRes = await apiFetchResponseWithRetry(`/api/validation/${validationId}/result`);
      const resultJson = (await resultRes.json()) as { ok?: boolean; data?: ValidationPayload };
      let payload = resultJson.ok && resultJson.data ? normalizePayload(resultJson.data) : null;

      const runEnvelope = await apiFetchEnvelope<Record<string, unknown>>(`/api/v1/validation/${validationId}`);
      if (runEnvelope.ok && runEnvelope.data) {
        const erectorResult = runEnvelope.data;
        payload = normalizePayload({
          ...(payload ?? {}),
          erectorValidationId: validationId,
          validationContractId: String(
            erectorResult.validationContractId ?? erectorResult.contract_id ?? payload?.validationContractId ?? "",
          ),
          blueprintId: String(erectorResult.blueprintId ?? payload?.blueprintId ?? ""),
          intelligence: {
            ...(payload?.intelligence ?? {}),
            erector: {
              ...(typeof payload?.intelligence?.erector === "object" ? (payload.intelligence.erector as object) : {}),
              ...erectorResult,
              scores: erectorResult.scores ?? erectorResult,
            },
          },
          verdict: String(erectorResult.verdict ?? payload?.verdict ?? "adjust"),
          paths: (erectorResult.paths as ValidationPayload["paths"]) ?? payload?.paths,
          launchBlocked: erectorResult.verdict === "blocked" || erectorResult.verdict === "pivot",
        });
      }

      if (!payload?.blueprintId) {
        setError("Validation results are not ready yet.");
        return;
      }

      const rec: PathKey =
        payload.verdict === "adjust" ? "adjusted" : payload.verdict === "pivot" ? "alternative" : "current";
      setSelectedPath(rec);
      setValidation(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation results.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!validation?.blueprintId || launching) return;
    const launchUrl = `${API_BASE_URL}/api/v1/validations/${validationId}/launch`;
    const selectedDirection = {
      path: selectedPath,
      tier: selectedTier,
      mode: selectedMode,
    };

    setLaunching(true);
    setLaunchError("");
    try {
      await apiFetchResponseWithRetry(`/api/v1/validation/${validationId}/select-path`, {
        method: "POST",
        body: JSON.stringify({ selectedPath }),
      });

      const result = await launchValidationBlueprint(validationId, selectedDirection);
      await completeOnboarding();
      window.location.href = result.redirectTo ?? result.redirect_to ?? "/dashboard";
    } catch (err) {
      const status = err instanceof ApiError ? err.status : "—";
      const backendMessage =
        err instanceof ApiError && err.data ? JSON.stringify(err.data) : err instanceof Error ? err.message : "Unknown";
      setLaunchError(
        [
          `Launch failed (HTTP ${status})`,
          `URL: ${launchUrl}`,
          `Validation id: ${validationId}`,
          `Selected direction: ${JSON.stringify(selectedDirection)}`,
          backendMessage,
        ].join("\n"),
      );
    } finally {
      setLaunching(false);
    }
  }

  function handleDownload() {
    window.print();
  }

  if (checking || loading) {
    return (
      <PreLaunchShell step={3}>
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PreLaunchShell>
    );
  }

  if (error || !validation) {
    return (
      <PreLaunchShell step={3}>
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <p className="text-red-600 text-sm">{error || "No results"}</p>
          <button type="button" onClick={() => void loadResults()} className="text-emerald-600 underline text-sm">
            Retry
          </button>
        </div>
      </PreLaunchShell>
    );
  }

  return (
    <PreLaunchShell step={3}>
      <ValidationResultsDashboard
        data={validation}
        validationId={validationId}
        completedLabel="Completed"
        selectedPath={selectedPath}
        onSelectPath={setSelectedPath}
        onLaunch={() => void handleLaunch()}
        onDownload={handleDownload}
        launching={launching}
        launchError={launchError}
        onDataUpdate={(next) => {
          setValidation(next);
          const rec: PathKey =
            next.verdict === "adjust" ? "adjusted" : next.verdict === "pivot" ? "alternative" : "current";
          setSelectedPath(rec);
        }}
      />
    </PreLaunchShell>
  );
}
