import { useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import { uploadProofFile } from "@/api/orders";
import { isValidUrl } from "@/lib/task-feedback";
import type { ProofState, TaskExecutionView } from "@/types/task-execution";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.txt,.csv,.xlsx,.docx,application/pdf,image/png,image/jpeg,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type UploadPhase = "idle" | "uploading" | "success" | "error";

/** DOC 34 — auto-upload proof file + optional link before feedback submit. */
export function ProofUpload({
  order,
  proof,
  onChange,
  disabled,
  error,
}: {
  order: TaskExecutionView;
  proof: ProofState;
  onChange: (patch: Partial<ProofState>) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const [phase, setPhase] = useState<UploadPhase>(
    proof.proofFileId ? "success" : "idle",
  );
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const needsProof = order.proofRequired || order.proofType === "FILE";
  if (!needsProof && order.proofType !== "LINK") {
    return null;
  }

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setUploadError("File must be 10MB or smaller.");
      setPhase("error");
      return;
    }
    setPhase("uploading");
    setProgress(12);
    setUploadError(null);
    try {
      setProgress(45);
      const fileId = await uploadProofFile({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        orderId: order.orderId,
      });
      setProgress(100);
      onChange({
        proofFileId: fileId,
        proofFileIds: [fileId],
        proofFileName: file.name,
      });
      setPhase("success");
    } catch {
      setUploadError(LANGUAGE.feedback.uploadFailed);
      setPhase("error");
    }
  }

  function handleLinkBlur(url: string) {
    if (!url.trim()) {
      setLinkError(null);
      return;
    }
    setLinkError(isValidUrl(url) ? null : LANGUAGE.feedback.invalidLink);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
        {LANGUAGE.feedback.proofRequired}
      </p>
      {order.proofInstruction ? (
        <p className="text-sm text-amber-900">{order.proofInstruction}</p>
      ) : null}

      {(order.proofType === "FILE" || order.proofRequired) && (
        <div className="space-y-2">
          {phase === "success" && proof.proofFileName ? (
            <p className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              {LANGUAGE.feedback.proofUploaded}: {proof.proofFileName}
            </p>
          ) : (
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 ${
                disabled ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {phase === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {phase === "uploading"
                ? LANGUAGE.feedback.uploading
                : LANGUAGE.feedback.proofUploadIdle}
              <input
                type="file"
                className="sr-only"
                accept={ACCEPT}
                disabled={disabled || phase === "uploading"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
          )}

          {phase === "uploading" ? (
            <div className="h-2 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-amber-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          {uploadError || phase === "error" ? (
            <p className="text-xs text-red-700">{uploadError ?? LANGUAGE.feedback.uploadFailed}</p>
          ) : null}
        </div>
      )}

      {(order.proofType === "LINK" || order.proofRequired) && (
        <div>
          <label className="text-xs font-medium text-amber-900">
            {LANGUAGE.feedback.proofLinkPlaceholder}
          </label>
          <input
            type="url"
            value={proof.proofLinks[0] ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ proofLinks: [e.target.value] })}
            onBlur={(e) => handleLinkBlur(e.target.value)}
            placeholder="https://"
            className="mt-1 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
          />
          {linkError ? <p className="mt-1 text-xs text-red-700">{linkError}</p> : null}
        </div>
      )}

      {order.proofType === "TEXT" && (
        <div>
          <textarea
            value={proof.proofText ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ proofText: e.target.value })}
            rows={4}
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
            placeholder={LANGUAGE.feedback.proofTextPlaceholder}
          />
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-800">
            <FileText className="h-3 w-3" />
            {(proof.proofText?.length ?? 0)}/20 {LANGUAGE.feedback.minCharacters}
          </p>
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
