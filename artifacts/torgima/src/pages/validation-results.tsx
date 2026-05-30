import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ValidationResultsDashboard } from "@/components/validation/ValidationResultsDashboard";
import type { ValidationScreenData } from "@/components/validation/ValidationScreen";
import type { PathKey } from "@/components/validation/PathPanels";
import { apiFetchEnvelope, apiFetchResponseWithRetry } from "@/lib/torgima-api";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import {
  buildLaunchContextFromPayload,
  saveValidationLaunchContext,
} from "@/lib/validation-launch-context";

type ValidationPayload = ValidationScreenData & { status?: string };

function normalizePayload(payload: ValidationPayload): ValidationPayload {
  return { ...payload, status: "validated" };
}

export default function ValidationResultsPage() {
  const [, params] = useRoute("/validation/:id/results");
  const [, setLocation] = useLocation();
  const validationId = params?.id ?? "";
  const { checking } = useAppRouteGuard("pre-launch");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathKey>("adjusted");
  const [hasPaths, setHasPaths] = useState(false);

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
      setHasPaths(Boolean(payload.paths?.current && payload.paths?.adjusted && payload.paths?.alternative));
      setValidation(payload);
      saveValidationLaunchContext(buildLaunchContextFromPayload(validationId, payload, rec));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation results.");
    } finally {
      setLoading(false);
    }
  }

  function goToBlueprintSelection() {
    if (!validation?.blueprintId) return;
    saveValidationLaunchContext(
      buildLaunchContextFromPayload(validationId, validation, selectedPath),
    );
    setLocation(`/validation/${validationId}/blueprint`);
  }

  function handleDownload() {
    window.print();
  }

  if (checking || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
          <p className="mt-4 text-sm text-[#64748B]">Loading validation results…</p>
        </div>
      </div>
    );
  }

  if (error || !validation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-lg text-center">
          <p className="text-sm text-red-600">{error || "No results"}</p>
          <button
            type="button"
            onClick={() => void loadResults()}
            className="mt-4 text-sm font-semibold text-[#5B21FF] underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ValidationResultsDashboard
      data={validation}
      validationId={validationId}
      selectedPath={selectedPath}
      onSelectPath={(path) => {
        setSelectedPath(path);
        saveValidationLaunchContext(
          buildLaunchContextFromPayload(validationId, validation, path),
        );
      }}
      onLaunch={goToBlueprintSelection}
      onDownload={handleDownload}
      launchReady={hasPaths && Boolean(selectedPath)}
    />
  );
}
