import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { CheckCircle2, XCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

export default function VerifyPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errMsg, setErrMsg] = useState("");
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const q = search.startsWith("?") ? search.slice(1) : search;
    const p = new URLSearchParams(q);
    const token = p.get("token");
    const email = p.get("email");

    if (!token || !email) {
      setStatus("error");
      setErrMsg("This link is missing required parameters.");
      return;
    }

    if (!API_BASE_URL) {
      setStatus("error");
      setErrMsg("Server URL is not configured (VITE_API_BASE_URL).");
      return;
    }

    fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then((r) => r.json())
      .then(async (d: { ok?: boolean; error?: { message?: string } }) => {
        if (d.ok) {
          setStatus("success");
          let target = "/dashboard";
          try {
            const st = await fetch(`${API_BASE_URL}/api/onboarding/status`, {
              credentials: "include",
              headers: { Accept: "application/json" },
            }).then((r) => r.json() as Promise<{ ok?: boolean; data?: { completed?: boolean } }>);
            if (st?.ok && st.data && st.data.completed === false) {
              target = "/onboarding";
            }
          } catch {
            /* keep dashboard */
          }
          setTimeout(() => setLocation(target), 1500);
        } else {
          setStatus("error");
          setErrMsg(d.error?.message ?? "Verification failed or link has expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrMsg("Cannot connect to the server.");
      });
  }, [search, setLocation]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-12 max-w-sm w-full text-center space-y-5 shadow-sm">
        {status === "verifying" && (
          <>
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verifying your link</h2>
            <p className="text-gray-500 text-sm">This will only take a moment...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">You&apos;re in!</h2>
            <p className="text-gray-500 text-sm">Redirecting to your workspace…</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Link invalid</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{errMsg}</p>
            <Link href="/login">
              <span className="inline-block bg-gray-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 cursor-pointer">
                Request a new link
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
