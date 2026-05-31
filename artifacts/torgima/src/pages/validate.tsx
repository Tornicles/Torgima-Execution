import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy /validate entry — redirects to canonical onboarding flow. */
export default function ValidatePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/onboarding");
  }, [setLocation]);

  return null;
}
