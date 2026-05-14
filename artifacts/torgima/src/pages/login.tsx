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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: { message?: string }; detail?: string };

      if (data.ok) {
        setSent(true);
      } else {
        setError(data.error?.message ?? data.detail ?? "Failed to send link. Try again.");
      }
    } catch {
      setError("Cannot reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-10 text-center space-y-5">
            <div className="text-5xl">✉️</div>
            <h2 className="text-xl font-bold font-mono">Check your email</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>.
              <br />
              The link expires in 15 minutes.
            </p>
            <p className="text-xs text-muted-foreground">No email? Check your spam folder.</p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="text-xs text-primary underline underline-offset-2 font-mono"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-1">
          <Link href="/">
            <div className="inline-flex items-center gap-2 cursor-pointer">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-mono font-bold text-xl tracking-tight">TORGIMA_OS</span>
            </div>
          </Link>
          <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider">Individual Execution System</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold font-mono">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email to receive a magic sign-in link. No password required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                disabled={loading}
                className="font-mono"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                <p className="text-destructive text-sm font-mono">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full font-mono uppercase tracking-wider text-xs"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-background border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send Magic Link"
              )}
            </Button>
          </form>
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
