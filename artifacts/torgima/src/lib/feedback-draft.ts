import type { FeedbackFormState } from "@/types/task-execution";

const PREFIX = "torgima:feedback-draft:";

export function feedbackDraftKey(orderId: string): string {
  return `${PREFIX}${orderId}`;
}

export function saveFeedbackDraft(orderId: string, form: FeedbackFormState): void {
  try {
    sessionStorage.setItem(feedbackDraftKey(orderId), JSON.stringify(form));
  } catch {
    /* quota / private mode */
  }
}

export function loadFeedbackDraft(orderId: string): FeedbackFormState | null {
  try {
    const raw = sessionStorage.getItem(feedbackDraftKey(orderId));
    if (!raw) return null;
    return JSON.parse(raw) as FeedbackFormState;
  } catch {
    return null;
  }
}

export function clearFeedbackDraft(orderId: string): void {
  try {
    sessionStorage.removeItem(feedbackDraftKey(orderId));
  } catch {
    /* ignore */
  }
}
