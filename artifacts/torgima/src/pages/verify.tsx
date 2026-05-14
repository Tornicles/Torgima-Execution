import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";

export default function VerifyPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const token = params.get("token");
    const email = params.get("email");

    if (!token || !email) {
      setStatus("error");
      setErrorMsg("Invalid or missing verification link.");
      return;
    }

    fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, email }),
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; error?: { message?: string } }) => {
        if (data.ok) {
          setStatus("success");
          void fetch(`${API_BASE_URL}/api/onboarding/status`, { credentials: "include" })
            .then((r) => r.json())
            .then((s: { ok?: boolean; data?: { completed?: boolean } }) => {
              const done = Boolean(s?.ok && s?.data?.completed);
              setTimeout(() => setLocation(done ? "/dashboard" : "/onboarding"), 1500);
            })
            .catch(() => setTimeout(() => setLocation("/dashboard"), 1500));
        } else {
          setStatus("error");
          setErrorMsg(data.error?.message ?? "Verification failed. Link may have expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Cannot connect to server.");
      });
  }, [search, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-xl p-10 max-w-sm w-full text-center space-y-4">
        {status === "verifying" && (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-mono text-muted-foreground text-sm">Verifying your sign-in link...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl">✓</div>
            <p className="font-mono font-bold text-lg">Verified</p>
            <p className="text-muted-foreground text-sm">Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl">✕</div>
            <p className="font-mono font-bold text-lg">Verification Failed</p>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <Link href="/login">
              <span className="text-primary underline text-sm font-mono cursor-pointer">Request a new link</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
