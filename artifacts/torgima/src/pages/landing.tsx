import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-4 max-w-lg">
        <h1 className="text-4xl font-bold font-mono tracking-tight text-primary">TORGIMA</h1>
        <p className="text-muted-foreground font-mono text-sm">
          Execution infrastructure for operators who want systems, not slogans.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/login">
          <Button className="font-mono">Enter system</Button>
        </Link>
      </div>
    </div>
  );
}
