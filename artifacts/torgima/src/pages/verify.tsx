import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";

type Status = "verifying" | "success" | "error";

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const q = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(q);
    const token = params.get("token");
    const email = params.get("email");

    if (!token || !email) {
      setStatus("error");
      setErrorMsg("This link is missing required parameters. Request a new one.");
      return;
    }

    if (!API_BASE_URL) {
      setStatus("error");
      setErrorMsg("Server URL is not configured (VITE_API_BASE_URL).");
      return;
    }

    fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; error?: { message?: string } }) => {
        if (data.ok) {
          setStatus("success");
          setTimeout(() => setLocation("/dashboard"), 1500);
        } else {
          setStatus("error");
          setErrorMsg(
            data.error?.message ?? "Verification failed. The link may have expired or already been used.",
          );
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Cannot connect to the server. Please try again.");
      });
  }, [search, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-xl p-10 text-center space-y-5">
          {status === "verifying" && (
            <>
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-mono font-bold">Verifying</p>
                <p className="text-muted-foreground text-sm">Checking your sign-in link...</p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-5xl">✓</div>
              <div className="space-y-1">
                <p className="font-mono font-bold text-lg">Verified</p>
                <p className="text-muted-foreground text-sm">Signed in successfully. Redirecting...</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl">✕</div>
              <div className="space-y-2">
                <p className="font-mono font-bold text-lg">Link Invalid</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{errorMsg}</p>
              </div>
              <Link href="/login">
                <span className="inline-block mt-2 font-mono text-sm text-primary underline underline-offset-2 cursor-pointer">
                  Request a new link
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
