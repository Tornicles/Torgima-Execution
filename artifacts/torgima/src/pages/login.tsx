import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api-base";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string }; detail?: string };
      if (data.ok) {
        setSent(true);
      } else {
        setError(data.error?.message ?? data.detail ?? "Failed to send magic link. Try again.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <Link href="/">
            <span className="font-mono font-bold text-2xl text-primary cursor-pointer">TORGIMA_OS</span>
          </Link>
          <p className="text-muted-foreground text-sm font-mono">Individual Execution System</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          {!sent ? (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold font-mono">Sign In</h1>
                <p className="text-sm text-muted-foreground">Enter your email and we will send you a sign-in link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground">Email address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    className="font-mono"
                  />
                </div>

                {error && <p className="text-destructive text-sm font-mono">{error}</p>}

                <Button type="submit" disabled={loading || !email.trim()} className="w-full font-mono uppercase text-xs">
                  {loading ? "Sending..." : "Send Magic Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">✉️</div>
              <h2 className="text-xl font-bold font-mono">Check Your Email</h2>
              <p className="text-muted-foreground text-sm">
                We sent a sign-in link to <strong className="text-foreground">{email}</strong>.
                <br />
                It expires in 15 minutes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-xs text-primary underline font-mono"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground font-mono">
          <Link href="/">
            <span className="text-primary hover:underline cursor-pointer">← Back to home</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
