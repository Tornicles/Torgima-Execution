import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setAuthToken } from "@/lib/auth-token";
import { apiFetch } from "@/config/api";

const FEATURES = [
  "Personalized execution Blueprint",
  "Daily execution Orders",
  "Signal-driven adaptation",
  "Blueprint tracking",
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const returnTo = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("returnTo") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    setLoading(false);

    if (loginError) {
      if (
        loginError.message.includes("Invalid login credentials") ||
        loginError.message.includes("invalid_credentials")
      ) {
        setError("Incorrect email or password. Please try again.");
      } else if (loginError.message.includes("Email not confirmed")) {
        setError("Please check your email and confirm your account first.");
      } else if (loginError.message.includes("Too many requests")) {
        setError("Too many login attempts. Please wait a few minutes and try again.");
      } else {
        setError(loginError.message || "Login failed. Please try again.");
      }
      return;
    }

    if (data.session?.access_token) {
      setAuthToken(data.session.access_token);

      // Check if onboarding is complete
      try {
        const res = await apiFetch("/api/auth/session");
        const body = (await res.json()) as {
          data?: { user?: { onboardingComplete?: boolean } };
        };
        const onboardingComplete = body.data?.user?.onboardingComplete ?? false;
        const destination = returnTo || (onboardingComplete ? "/dashboard" : "/onboarding");
        setLocation(destination);
      } catch {
        setLocation(returnTo || "/dashboard");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-gray-900 text-white p-12 flex-col">
        <div className="flex items-center gap-2 mb-12">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <path d="M14 4L4 10V18L14 24L24 18V10L14 4Z" stroke="white" strokeWidth="2" fill="none" />
            <path d="M9 13L14 10L19 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 10V19" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-xl">TORGIMA</span>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-4xl font-bold leading-tight mb-4">Your execution system awaits.</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Sign in to access your personalized execution Blueprint and daily Order engine.
          </p>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-sm text-gray-300">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500">Individual Execution System — Phase 1</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/">
            <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer w-fit">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </div>
          </Link>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-1">Sign in with your email and password.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  disabled={loading}
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-300 disabled:bg-gray-50"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700">Password</label>
                  <Link href="/forgot-password">
                    <span className="text-xs text-green-600 hover:underline cursor-pointer">
                      Forgot password?
                    </span>
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-300 disabled:bg-gray-50"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Signing in...
                  </>
                ) : (
                  "Sign in →"
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/signup">
                <span className="text-green-600 font-medium hover:underline cursor-pointer">
                  Create one
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
