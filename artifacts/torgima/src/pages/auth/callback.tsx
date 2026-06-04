import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { XCircle } from "lucide-react";
import { buildApiMagicLinkVerifyUrl } from "@/lib/magic-link-verify";

/**
 * Magic-link callback — public route, no session guard.
 * Completes sign-in via top-level GET to the API (not fetch), so the session cookie is set reliably.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"verifying" | "error">("verifying");
  const [errMsg, setErrMsg] = useState("");
  const search = useSearch();

  useEffect(() => {
    const q = search.startsWith("?") ? search.slice(1) : search;
    const p = new URLSearchParams(q);
    const error = p.get("error");
    if (error) {
      setStatus("error");
      setErrMsg(error);
      return;
    }

    const token = p.get("token");
    const email = p.get("email");

    if (!token || !email) {
      setStatus("error");
      setErrMsg("This sign-in link is missing required parameters.");
      return;
    }

    window.location.replace(buildApiMagicLinkVerifyUrl(token, email));
  }, [search]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-12 max-w-sm w-full text-center space-y-5 shadow-sm">
        {status === "verifying" && (
          <>
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Signing you in</h2>
            <p className="text-gray-500 text-sm">This will only take a moment...</p>
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
