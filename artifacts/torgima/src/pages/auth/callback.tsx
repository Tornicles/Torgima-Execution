import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { setAuthToken } from "@/lib/auth-token";

/**
 * Auth callback page — handles Supabase redirects for:
 *  - Email confirmation links
 *  - Password reset links
 *  - Magic link (legacy, if re-enabled)
 *
 * Supabase appends tokens to the URL hash or query string.
 * The Supabase client detects these automatically when detectSessionInUrl: true.
 */
export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    // Check for error in query string (legacy magic link errors)
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setStatus("error");
      setErrMsg(urlError);
      return;
    }

    // Supabase handles its own token exchange via onAuthStateChange
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) {
        setAuthToken(session.access_token);
        // Redirect to password update page if this is a recovery flow
        if (event === "SIGNED_IN" && params.get("type") === "recovery") {
          setLocation("/auth/update-password");
        } else {
          setLocation("/dashboard");
        }
      } else if (event === "PASSWORD_RECOVERY") {
        setAuthToken(session?.access_token ?? null);
        setLocation("/auth/update-password");
      }
    });

    // Give Supabase 8 seconds to resolve the session from the URL
    const timeout = setTimeout(() => {
      setStatus("error");
      setErrMsg("Authentication timed out. Please try signing in again.");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [setLocation]);

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
                Back to login
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
