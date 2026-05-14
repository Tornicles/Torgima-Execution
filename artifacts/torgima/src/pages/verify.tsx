import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";

/** Consumes `?token=` + `?email=` from the magic-link redirect and establishes session cookie. */
export default function VerifyPage() {
  const [, setLocation] = useLocation();
  const [msg, setMsg] = useState("Verifying…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");
    if (!token || !email) {
      setMsg("Missing token or email. Request a new link from /login.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token, email }),
        });
        const json = (await res.json()) as { ok?: boolean };
        if (!res.ok || json.ok === false) {
          setMsg("Verification failed. Try signing in again.");
          return;
        }
        setLocation("/dashboard");
      } catch {
        setMsg("Network error during verification.");
      }
    })();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <p className="font-mono text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}
