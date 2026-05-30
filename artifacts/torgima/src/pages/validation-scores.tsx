import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy route — redirects to new Erector intake. */
export default function ValidationScoresRedirectPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const stored = sessionStorage.getItem("torgima_validation_results");
    if (stored) setLocation(`/validation/${stored}/results`);
    else setLocation("/validate");
  }, [setLocation]);

  return null;
}
