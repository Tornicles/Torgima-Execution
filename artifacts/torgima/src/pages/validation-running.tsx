import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";

/** Legacy route — redirects to validation results (running UI lives in refinement flow). */
export default function ValidationRunningRedirectPage() {
  const [, params] = useRoute("/validation/:id/running");
  const [, setLocation] = useLocation();
  const validationId = params?.id ?? "";

  useEffect(() => {
    if (validationId) setLocation(`/validation/${validationId}/results`);
    else setLocation("/validate");
  }, [validationId, setLocation]);

  return null;
}
