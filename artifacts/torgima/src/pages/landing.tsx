import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Zap, Target, Activity, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden>
            <path d="M14 4L4 10V18L14 24L24 18V10L14 4Z" stroke="#111827" strokeWidth="2" fill="none" />
            <path d="M9 13L14 10L19 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 10V19" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-xl tracking-tight">TORGIMA</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <span className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer">Sign in</span>
          </Link>
          <Link href="/login">
            <button
              type="button"
              className="bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
            >
              Get started →
            </button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 text-xs font-semibold text-green-700 uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Phase 1 — Individual Execution System
          </div>

          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
            Execute your goals.
            <br />
            <span className="text-green-600">Every single day.</span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Torgima is the execution operating system that never stops working. Give it your goal and it generates the
            next correct Order, adapts to your performance, and keeps execution continuity — without the noise.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <button
              type="button"
              className="bg-gray-900 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-gray-800 transition-all text-base group flex items-center gap-2 mx-auto sm:mx-0"
            >
              Start Your Blueprint
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-gray-400">
            {["No password required", "Magic link sign-in", "Free to start"].map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <section className="border-t border-gray-100 px-8 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                icon: Target,
                step: "01",
                title: "Define Your Goal",
                desc: "Enter your goal, purpose, and timeframe. Torgima validates and builds a structured execution blueprint.",
              },
              {
                icon: Zap,
                step: "02",
                title: "Daily execution orders",
                desc: "The system generates specific operational orders from your blueprint position, capability, and condition enforcement.",
              },
              {
                icon: Activity,
                step: "03",
                title: "Submit feedback",
                desc: "Complete orders and submit honest execution reports. Signals update; conditions adapt; the next execution order generates.",
              },
              {
                icon: Shield,
                step: "04",
                title: "Stay On Track",
                desc: "The control engine enforces correct pacing. Pivot when needed. The execution loop never goes empty.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold text-lg">{item.step}</span>
                  <item.icon className="w-4 h-4 text-green-500" />
                </div>
                <h3 className="font-bold text-gray-900">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 px-8 py-16 bg-white">
        <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 p-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Sample Intelligence Report</p>
          <p className="text-sm text-gray-700">
            Trending in your niche: short-form proof-of-work content. Platform signal favors consistent publishing.
            Today&apos;s recommendation: execute one high-leverage Order before expanding scope.
          </p>
          <p className="text-xs text-gray-400">Generated nightly — illustrative demo only.</p>
        </div>
      </section>

      <section className="border-t border-gray-100 px-8 py-20 text-center">
        <div className="max-w-md mx-auto space-y-5">
          <h2 className="text-2xl font-bold">Ready to start executing?</h2>
          <p className="text-gray-500 text-sm">Create your account in under 60 seconds. No password required.</p>
          <Link href="/login">
            <button
              type="button"
              className="bg-gray-900 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-gray-800 transition-all w-full text-base"
            >
              Get started for free
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-sm font-bold">TORGIMA</span>
        <span className="text-xs text-gray-400">Individual Execution System — Phase 1</span>
      </footer>
    </div>
  );
}
