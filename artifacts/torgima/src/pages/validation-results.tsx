import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ApiError } from "@workspace/api-client-react";
import { ValidationResultsDashboard } from "@/components/validation/ValidationResultsDashboard";
import type { ValidationScreenData } from "@/components/validation/ValidationScreen";
import type { PathKey } from "@/components/validation/PathPanels";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import {
  apiFetchEnvelope,
  apiFetchResponseWithRetry,
  completeOnboarding,
  finalizeValidationBlueprint,
  formatApiEnvelopeError,
  launchValidationBlueprint,
  selectBlueprintPath,
} from "@/lib/torgima-api";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import {
  buildLaunchContextFromPayload,
  saveValidationLaunchContext,
} from "@/lib/validation-launch-context";
import { loadPreValidationDraft } from "@/lib/pre-validation-draft";

type ValidationPayload = ValidationScreenData & {
  status?: string;
  isFinalized?: boolean;
};

function normalizePayload(payload: ValidationPayload): ValidationPayload {
  return { ...payload, status: "validated" };
}

function mergeResultsEnrichment(
  payload: ValidationPayload | null,
  results: Record<string, unknown>,
): ValidationPayload {
  const erector = (payload?.intelligence?.erector ?? {}) as Record<string, unknown>;
  return normalizePayload({
    ...(payload ?? {}),
    intelligence: {
      ...(payload?.intelligence ?? {}),
      erector: {
        ...erector,
        competitors: results.competitors ?? erector.competitors,
        opportunities: results.opportunities ?? erector.opportunities,
        economicContext: results.economicContext ?? erector.economicContext,
      },
    },
  });
}

function mergeErectorApiPayload(
  payload: ValidationPayload | null,
  erectorResult: Record<string, unknown>,
  validationId: string,
): ValidationPayload {
  const userPurpose =
    typeof erectorResult.purpose === "string"
      ? erectorResult.purpose
      : typeof payload?.purpose === "string"
        ? payload.purpose
        : "";
  const userGoal =
    typeof erectorResult.rawGoal === "string"
      ? erectorResult.rawGoal
      : typeof erectorResult.raw_goal === "string"
        ? erectorResult.raw_goal
        : typeof payload?.goal === "string"
          ? payload.goal
          : "";

  return normalizePayload({
    ...(payload ?? {}),
    goal: userGoal || payload?.goal,
    purpose: userPurpose || payload?.purpose,
    erectorValidationId: validationId,
    validationContractId: String(
      erectorResult.validationContractId ?? erectorResult.contract_id ?? payload?.validationContractId ?? "",
    ),
    blueprintId: String(erectorResult.blueprintId ?? payload?.blueprintId ?? ""),
    isFinalized: Boolean(erectorResult.isFinalized ?? payload?.isFinalized),
    intelligence: {
      ...(payload?.intelligence ?? {}),
      erector: {
        ...(typeof payload?.intelligence?.erector === "object" ? (payload.intelligence.erector as object) : {}),
        ...erectorResult,
        rawGoal: userGoal || erectorResult.rawGoal || erectorResult.raw_goal,
        purpose: userPurpose,
        timeframe: erectorResult.timeframe,
        timeframeDays: erectorResult.timeframeDays ?? erectorResult.timeframe_days,
        commitmentLevel: erectorResult.commitmentLevel,
        locationCountry: erectorResult.locationCountry ?? erectorResult.location_country,
        businessModel: erectorResult.businessModel ?? erectorResult.business_model,
        domain: erectorResult.domain,
        scores: erectorResult.scores ?? erectorResult,
      },
    },
    verdict: String(erectorResult.verdict ?? payload?.verdict ?? "adjust"),
    paths: (erectorResult.paths as ValidationPayload["paths"]) ?? payload?.paths,
    launchBlocked: erectorResult.verdict === "blocked" || erectorResult.verdict === "pivot",
  });
}

function hasTimeframe(payload: ValidationPayload | null): boolean {
  const erector = payload?.intelligence?.erector as Record<string, unknown> | undefined;
  const draft = loadPreValidationDraft();
  const tf = String(erector?.timeframe ?? "").trim();
  const days = Number(erector?.timeframeDays ?? erector?.timeframe_days);
  return Boolean(tf || (Number.isFinite(days) && days > 0) || (draft.timeframeDays != null && draft.timeframeDays > 0));
}

export default function ValidationResultsPage() {
  const [, params] = useRoute("/validation/:id/results");
  const [, setLocation] = useLocation();
  const validationId = params?.id ?? "";
  const { checking } = useAppRouteGuard("pre-launch");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [projectName, setProjectName] = useState(() => loadPreValidationDraft().projectName);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathKey>("adjusted");
  const [selectedTier, setSelectedTier] = useState<TierId>("starter");
  const [isFinalized, setIsFinalized] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const loadResults = useCallback(async () => {
    if (!validationId) return;
    setLoading(true);
    setError("");
    try {
      const resultRes = await apiFetchResponseWithRetry(`/api/validation/${validationId}/result`);
      const resultJson = (await resultRes.json()) as { ok?: boolean; data?: ValidationPayload };
      let payload = resultJson.ok && resultJson.data ? normalizePayload(resultJson.data) : null;

      const runEnvelope = await apiFetchEnvelope<Record<string, unknown>>(`/api/v1/validation/${validationId}`);
      if (runEnvelope.ok && runEnvelope.data) {
        payload = mergeErectorApiPayload(payload, runEnvelope.data, validationId);
      }

      const resultsEnvelope = await apiFetchEnvelope<Record<string, unknown>>(
        `/api/v1/validations/${validationId}/results`,
      );
      if (resultsEnvelope.ok && resultsEnvelope.data) {
        payload = mergeResultsEnrichment(payload, resultsEnvelope.data);
      }

      if (!payload?.blueprintId) {
        setError("Validation results are not ready yet.");
        return;
      }

      const rec: PathKey =
        payload.verdict === "adjust" ? "adjusted" : payload.verdict === "pivot" ? "alternative" : "current";
      setSelectedPath(rec);
      setIsFinalized(Boolean(payload.isFinalized));

      const recommended = String(
        runEnvelope.data?.recommendedBlueprintLevel ?? runEnvelope.data?.recommended_blueprint_level ?? "starter",
      );
      if (recommended === "growth" || recommended === "ultimate" || recommended === "starter") {
        setSelectedTier(recommended);
      }

      setValidation(payload);
      saveValidationLaunchContext(buildLaunchContextFromPayload(validationId, payload, rec));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation results.");
    } finally {
      setLoading(false);
    }
  }, [validationId]);

  useEffect(() => {
    if (!validationId || checking) return;
    void loadResults();
  }, [validationId, checking, loadResults]);

  const timeframeMissing = useMemo(() => !hasTimeframe(validation), [validation]);
  const hasPaths = Boolean(
    validation?.paths?.current && validation?.paths?.adjusted && validation?.paths?.alternative,
  );

  async function handleSelectPath(path: PathKey) {
    setSelectedPath(path);
    saveValidationLaunchContext(buildLaunchContextFromPayload(validationId, validation, path));
    if (!validation?.blueprintId) return;
    try {
      await selectBlueprintPath(validation.blueprintId, path);
    } catch (err) {
      console.error("[PathSelect]", err);
    }
  }

  async function handleLaunch() {
    if (!validation?.blueprintId || launching || timeframeMissing) return;

    setLaunching(true);
    setLaunchError("");

    try {
      await selectBlueprintPath(validation.blueprintId, selectedPath ?? "adjusted");

      await apiFetchResponseWithRetry(`/api/v1/validation/${validationId}/select-path`, {
        method: "POST",
        body: JSON.stringify({ selectedPath: selectedPath ?? "adjusted" }),
      });

      if (!isFinalized) {
        await finalizeValidationBlueprint(validationId, selectedPath);
        setIsFinalized(true);
      }

      const result = await launchValidationBlueprint(validationId, {
        path: selectedPath,
        tier: selectedTier,
        selected_blueprint_type: selectedTier,
        projectName: projectName.trim(),
      });
      await completeOnboarding();
      window.location.href = result.redirectTo ?? result.redirect_to ?? "/dashboard";
    } catch (err) {
      const backendMessage =
        err instanceof ApiError && err.data
          ? formatApiEnvelopeError(
              { ok: false, status: err.status, error: err.data as { message?: string; fieldErrors?: Record<string, string[]> } },
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

  async function handleDownload() {
    if (!validationId) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(`/api/v1/validations/${validationId}/report`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Report generation failed");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `torgima-validation-report-${validationId}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Could not generate report. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  if (checking || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
          <p className="mt-4 text-sm text-[#64748B]">Loading validation results…</p>
        </div>
      </div>
    );
  }

  if (error || !validation) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-white px-6">
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
      onSelectPath={(path) => void handleSelectPath(path)}
      onLaunch={() => void handleLaunch()}
      onDownload={() => void handleDownload()}
      downloading={downloading}
      downloadError={downloadError}
      launching={launching}
      launchError={launchError}
      launchReady={hasPaths && Boolean(selectedPath) && !timeframeMissing}
      timeframeMissing={timeframeMissing}
      onEditContext={() => setLocation("/validate")}
      projectName={projectName}
      editingProjectName={editingProjectName}
      onEditProjectName={() => setEditingProjectName(true)}
      onProjectNameChange={setProjectName}
      onProjectNameEditDone={() => setEditingProjectName(false)}
      goalSummary={validation.goal}
    />
  );
}
