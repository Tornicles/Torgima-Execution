/**
 * DOC 31 §8 — page-level error boundary (no stack traces to users).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { LANGUAGE } from "@/lib/language";

type Props = { children: ReactNode; title?: string };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold text-gray-900">
            {this.props.title ?? LANGUAGE.errors.generic}
          </p>
          <p className="text-sm text-gray-500 max-w-md">{LANGUAGE.errors.boundaryHint}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-gray-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-gray-800"
          >
            {LANGUAGE.actions.refresh}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
