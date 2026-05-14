import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-magic-link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
      } else {
        setError(data.error?.message ?? "Failed to send link.");
      }
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const FEATURES = [
    "Personalized execution plan",
    "Daily actionable tasks",
    "Signal-driven adaptation",
    "Blueprint tracking",
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
            Sign in to access your personalized execution blueprint and daily task engine.
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

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/">
            <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer w-fit">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </div>
          </Link>

          {!sent ? (
            <>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
                <p className="text-gray-500 mt-1">Enter your email to receive a magic sign-in link. No password required.</p>
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
                    disabled={loading || !email.trim()}
                    className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Sending...
                      </>
                    ) : (
                      "Send Magic Link →"
                    )}
                  </button>
                </form>
                <p className="text-center text-xs text-gray-400">🔒 We never share your email address.</p>
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
              <p className="text-gray-500 leading-relaxed">
                We sent a magic sign-in link to
                <br />
                <strong className="text-gray-900">{email}</strong>
              </p>
              <p className="text-sm text-gray-400">The link expires in 15 minutes. Check your spam if you don&apos;t see it.</p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-sm text-green-600 underline"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
