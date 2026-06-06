import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import { uploadProofFile } from "@/api/orders";
import { DEFAULT_PROOF_STEPS, isValidUrl } from "@/lib/task-feedback";
import type { ProofState, TaskExecutionView } from "@/types/task-execution";

export function ProofInputs({
  order,
  proof,
  onChange,
  error,
}: {
  order: TaskExecutionView;
  proof: ProofState;
  onChange: (patch: Partial<ProofState>) => void;
  error?: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (order.proofType === "NONE" && !order.proofRequired) {
    return null;
  }

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fileId = await uploadProofFile({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        orderId: order.orderId,
      });
      onChange({ proofFileIds: [...proof.proofFileIds, fileId] });
    } catch {
      setUploadError(LANGUAGE.feedback.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
        {LANGUAGE.feedback.proofRequired}
      </p>
      <p className="text-sm text-amber-900">{order.proofInstruction}</p>

      {(order.proofType === "TEXT" || (order.proofRequired && order.proofType === "NONE")) && (
        <div>
          <textarea
            value={proof.proofText ?? ""}
            onChange={(e) => onChange({ proofText: e.target.value })}
            rows={4}
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
            placeholder={LANGUAGE.feedback.proofTextPlaceholder}
            aria-invalid={Boolean(error)}
          />
          <p className="mt-1 text-xs text-amber-800">
            {(proof.proofText?.length ?? 0)}/20 {LANGUAGE.feedback.minCharacters}
          </p>
        </div>
      )}

      {order.proofType === "FILE" && (
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? LANGUAGE.feedback.uploading : LANGUAGE.feedback.uploadProof}
            <input
              type="file"
              className="sr-only"
              accept="image/*,.pdf,.doc,.docx"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
          {proof.proofFileIds.length > 0 ? (
            <p className="mt-2 text-xs text-green-800">
              {proof.proofFileIds.length} file(s) ready
            </p>
          ) : null}
          {uploadError ? <p className="mt-1 text-xs text-red-700">{uploadError}</p> : null}
        </div>
      )}

      {order.proofType === "LINK" && (
        <div>
          <input
            type="url"
            value={proof.proofLinks[0] ?? ""}
            onChange={(e) => onChange({ proofLinks: [e.target.value] })}
            placeholder="https://"
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
          />
          {proof.proofLinks[0] && !isValidUrl(proof.proofLinks[0]) ? (
            <p className="mt-1 text-xs text-red-700">{LANGUAGE.feedback.invalidLink}</p>
          ) : null}
        </div>
      )}

      {order.proofType === "STEPS" && (
        <ul className="space-y-2">
          {DEFAULT_PROOF_STEPS.map((item) => {
            const ans = proof.stepAnswers.find((a) => a.itemId === item.itemId);
            return (
              <li key={item.itemId}>
                <label className="flex items-center gap-2 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={ans?.completed ?? false}
                    onChange={(e) => {
                      const next = proof.stepAnswers.map((a) =>
                        a.itemId === item.itemId ? { ...a, completed: e.target.checked } : a,
                      );
                      onChange({ stepAnswers: next });
                    }}
                  />
                  {item.label}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {order.proofType === "OUTPUT" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Main result"
            value={proof.outputFields?.result ?? ""}
            onChange={(e) =>
              onChange({
                outputFields: { ...proof.outputFields, result: e.target.value },
              })
            }
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Supporting notes"
            value={proof.outputFields?.notes ?? ""}
            onChange={(e) =>
              onChange({
                outputFields: { ...proof.outputFields, notes: e.target.value },
              })
            }
            rows={2}
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
          />
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
