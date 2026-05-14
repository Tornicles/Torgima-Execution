import { Link } from "wouter";
import { ArrowRight, Zap, Target, Activity, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono font-bold text-lg tracking-tight">TORGIMA_OS</span>
        </div>
        <Link href="/login">
          <Button variant="outline" size="sm" className="font-mono text-xs uppercase tracking-wider">
            Sign In →
          </Button>
        </Link>
      </nav>

      {/* ── HERO ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs font-mono text-primary uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Phase 1 — Individual Execution System
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-mono tracking-tight leading-[1.1]">
            Your goal.
            <br />
            <span className="text-primary">Continuously</span>
            <br />
            executed.
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Torgima converts your goal into a structured blueprint, then keeps generating the next correct task until the
            goal is complete. Signals measure reality. Conditions govern execution.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/login">
              <Button size="lg" className="font-mono uppercase tracking-wider text-sm w-full sm:w-auto group px-8">
                Begin Execution
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* ── HOW IT WORKS ── */}
      <section className="border-t border-border/50 px-8 py-20 bg-secondary/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-mono text-muted-foreground uppercase tracking-widest mb-12">
            How the system works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                icon: Target,
                step: "01",
                title: "Define Goal",
                desc: "Enter your goal, purpose, and timeframe. The system validates and builds a structured blueprint.",
              },
              {
                icon: Zap,
                step: "02",
                title: "Generate Tasks",
                desc: "The execution engine generates specific tasks based on your position, condition, and capability.",
              },
              {
                icon: Activity,
                step: "03",
                title: "Submit Feedback",
                desc: "Complete tasks and submit honest feedback. Signals update. Conditions adapt. Next task generates.",
              },
              {
                icon: Shield,
                step: "04",
                title: "Stay On Track",
                desc: "The control engine enforces correct pacing. Pivot when needed. The loop never goes empty.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-card border border-border rounded-xl p-6 space-y-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-primary font-bold text-lg">{item.step}</span>
                  <item.icon className="w-4 h-4 text-primary/50" />
                </div>
                <h3 className="font-bold font-mono">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA STRIP ── */}
      <section className="border-t border-border/50 px-8 py-16 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold font-mono">Ready to execute?</h2>
          <p className="text-muted-foreground text-sm">Create your account with a magic link. No password required.</p>
          <Link href="/login">
            <Button size="lg" className="font-mono uppercase tracking-wider px-10">
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/50 px-8 py-6 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">TORGIMA_OS v1.0</span>
        <span className="font-mono text-xs text-muted-foreground">Individual Execution System — Phase 1</span>
      </footer>
    </div>
  );
}
