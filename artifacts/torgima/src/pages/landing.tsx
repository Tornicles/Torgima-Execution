import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Target, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border">
        <span className="font-mono font-bold text-xl tracking-tight text-primary">TORGIMA_OS</span>
        <Link href="/login">
          <Button variant="outline" className="font-mono text-xs uppercase">
            Sign In
          </Button>
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs font-mono text-primary uppercase">
            <Zap className="w-3 h-3" />
            Phase 1 — Individual Execution System
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold font-mono tracking-tight leading-tight">
            Your goal.
            <br />
            <span className="text-primary">Continuously executed.</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Torgima takes your goal and keeps generating the next correct task until it is complete. Signals measure
            reality. Conditions govern execution. Nothing goes empty.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="font-mono uppercase text-sm w-full sm:w-auto group">
                Start Execution
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* How it works */}
      <section className="border-t border-border px-8 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold font-mono text-center mb-12 uppercase">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Target,
                step: "01",
                title: "Define Your Goal",
                desc: "Enter your goal, purpose, and timeframe. The system validates and builds a complete execution blueprint.",
              },
              {
                icon: Zap,
                step: "02",
                title: "Execute Tasks",
                desc: "The system generates specific, actionable tasks. Complete them, submit feedback, and the loop continues automatically.",
              },
              {
                icon: Activity,
                step: "03",
                title: "Adapt In Real Time",
                desc: "Your execution signals inform the condition state. The system adjusts difficulty, pace, and direction based on reality.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-primary font-mono text-2xl font-bold">{item.step}</span>
                  <item.icon className="w-5 h-5 text-primary/60" />
                </div>
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-6 text-center">
        <p className="text-xs font-mono text-muted-foreground">TORGIMA_OS — Individual Execution System — Phase 1</p>
      </footer>
    </div>
  );
}
