import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setAuthToken } from "@/lib/auth-token";

const FEATURES = [
  "Personalized execution Blueprint",
  "Daily execution Orders",
  "Signal-driven adaptation",
  "Blueprint tracking",
];

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!email.includes("@") || !email.includes(".")) return "Please enter a valid email address.";
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password) && !/[0-9]/.test(password)) {
      return "Password must contain at least one number or capital letter.";
    }
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);

    if (signupError) {
      if (
        signupError.message.includes("already registered") ||
        signupError.message.includes("already been registered") ||
        signupError.message.includes("User already registered")
      ) {
        setError("An account with this email already exists. Please log in instead.");
      } else if (
        signupError.message.includes("weak_password") ||
        signupError.message.includes("Password should")
      ) {
        setError("Your password is too weak. Use at least 8 characters with a number or capital letter.");
      } else {
        setError(signupError.message || "Sign up failed. Please try again.");
      }
      return;
    }

    if (data.session?.access_token) {
      // Email confirmation disabled — signed in immediately
      setAuthToken(data.session.access_token);
      setLocation("/onboarding");
    } else if (data.user) {
      // Email confirmation required — tell user to check email
      setLocation("/signup/check-email");
    }
  }

  const passwordsMatch = !confirmPassword || password === confirmPassword;

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
          <h2 className="text-4xl font-bold leading-tight mb-4">Start executing your goals.</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Create your account and begin your personalized execution Blueprint in minutes.
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
            <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 mt-1">Set up your email and password to get started.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  disabled={loading}
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-300 disabled:bg-gray-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="At least 8 characters"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-300 disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-400">Minimum 8 characters with at least one number or capital letter</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Repeat your password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-300 disabled:bg-gray-50 ${
                    !passwordsMatch ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {!passwordsMatch && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password || !confirmPassword || !passwordsMatch}
                className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Creating account...
                  </>
                ) : (
                  "Create account →"
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400">🔒 We never share your email address.</p>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login">
                <span className="text-green-600 font-medium hover:underline cursor-pointer">
                  Sign in
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
