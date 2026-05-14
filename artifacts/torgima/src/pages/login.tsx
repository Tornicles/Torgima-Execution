import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api-base";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { ok?: boolean; detail?: string };
      if (!res.ok || json.ok === false) {
        setStatus("error");
        setMessage(json.detail ?? `Request failed (${res.status})`);
        return;
      }
      setStatus("sent");
      setMessage("Check your email for the sign-in link.");
    } catch {
      setStatus("error");
      setMessage("Network error — is VITE_API_BASE_URL set to your API?");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-md border-border">
        <CardHeader>
          <CardTitle className="font-mono">AUTH_GATE</CardTitle>
          <CardDescription className="font-mono text-xs">Magic link sign-in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-mono text-sm"
              />
            </div>
            <Button type="submit" className="w-full font-mono" disabled={status === "loading"}>
              {status === "loading" ? "Sending…" : "Send magic link"}
            </Button>
            {message ? (
              <p
                className={`text-xs font-mono ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {message}
              </p>
            ) : null}
            <p className="text-[10px] text-muted-foreground font-mono pt-2">
              API: <span className="break-all">{API_BASE_URL}</span>
            </p>
          </form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs font-mono text-muted-foreground hover:text-primary">
              ← Back
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
