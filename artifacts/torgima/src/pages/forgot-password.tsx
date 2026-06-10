import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      { redirectTo: `${window.location.origin}/auth/reset-password` },
    );

    setLoading(false);

    if (resetError) {
      setError("Could not send reset email. Please try again.");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-12 max-w-sm w-full text-center space-y-5 shadow-sm">
          <div className="text-5xl">📬</div>
          <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="text-gray-500 leading-relaxed text-sm">
            We sent password reset instructions to{" "}
            <strong className="text-gray-900">{email}</strong>.
          </p>
          <Link href="/login">
            <span className="inline-block text-sm text-green-600 hover:underline cursor-pointer">
              ← Back to login
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link href="/login">
          <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer w-fit">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </div>
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-500 mt-1">
            Enter your email and we&apos;ll send you reset instructions.
          </p>
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
                "Send reset instructions →"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
