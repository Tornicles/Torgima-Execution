import { useSearch } from "wouter";
import { useBlueprintStore } from "@/store/blueprintStore";

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

/** Active blueprint for Bhudhi universal dashboard (query param overrides store). */
export function useBhudhiBlueprint(): string {
  const search = useSearch();
  const storeId = useBlueprintStore((s) => s.activeBlueprintId);
  return blueprintIdFromSearch(search) ?? storeId ?? "";
}

export function bhudhiPath(section: string, blueprintId: string): string {
  const base = section ? `/app/bhudhi/${section}` : "/app/bhudhi";
  if (!blueprintId) return base;
  return `${base}?blueprintId=${encodeURIComponent(blueprintId)}`;
}
