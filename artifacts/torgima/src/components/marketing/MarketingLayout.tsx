import { Link } from "wouter";
import { Menu } from "lucide-react";

const nav = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/changelog", label: "Changelog" },
];

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0F1E]">
      <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-[#FAFAFA]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#0A0F1E] font-black">
              T
            </span>
            <span className="text-lg font-bold tracking-tight">Torgima</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {nav.slice(0, 3).map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-gray-600 hover:text-[#0A0F1E]">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#0A0F1E]">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#0EA5E9] px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-600"
            >
              Start Your Blueprint
            </Link>
          </div>
          <details className="relative md:hidden">
            <summary className="list-none rounded-xl border border-[#E5E7EB] p-2">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-xl">
              {[...nav, { href: "/signup", label: "Start Your Blueprint" }].map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-gray-50">
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="border-t border-[#E5E7EB] bg-[#0A0F1E] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="text-lg font-bold">Torgima</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-300">
              The execution operating system that converts goals into the next correct move.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-gray-300 sm:grid-cols-2 sm:gap-x-8">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
            <span>Privacy</span>
            <span>Terms</span>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-8 text-xs text-gray-500 lg:px-8">
          © {new Date().getFullYear()} Torgima. Phase 1 individual execution system.
        </div>
      </footer>
    </div>
  );
}

export function MarketingSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#E5E7EB] px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#0EA5E9]">{eyebrow}</p> : null}
        <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-0.02em] text-[#0A0F1E]">{title}</h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export function ProductFrame({ title = "Morning Intelligence Report" }: { title?: string }) {
  return (
    <div className="rounded-[2rem] border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="rounded-[1.5rem] border border-gray-100 bg-[#FAFAFA] p-5">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</p>
            <p className="mt-1 text-xl font-bold">Today’s execution context</p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Ready</span>
        </div>
        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          {["Competitor gap: proof-led content", "Platform signal: retention first", "Execution window: this week"].map((item) => (
            <div key={item} className="rounded-2xl border border-gray-100 bg-white p-4 text-sm font-medium text-gray-700">
              {item}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-[#0A0F1E] p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Recommended next move</p>
          <p className="mt-2 text-sm leading-6">Create one proof-of-work artifact tied to your active blueprint.</p>
        </div>
      </div>
    </div>
  );
}
