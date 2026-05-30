import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";

/** Legacy route — redirects to canonical validation results. */
export default function ValidationBlueprintRedirectPage() {
  const [, params] = useRoute("/validation/:id/blueprint");
  const [, setLocation] = useLocation();
  const validationId = params?.id ?? "";

  useEffect(() => {
    if (validationId) setLocation(`/validation/${validationId}/results`);
    else setLocation("/validate");
  }, [validationId, setLocation]);

  return null;
}
