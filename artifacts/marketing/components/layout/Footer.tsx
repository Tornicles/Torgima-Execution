import Link from "next/link";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Use Cases",
    links: [
      { href: "/use-cases/creators", label: "For Creators" },
      { href: "/use-cases/solopreneurs", label: "For Solopreneurs" },
      { href: "/use-cases/agencies", label: "For Agency Owners" },
      { href: "/use-cases/coaches", label: "For Coaches" },
      { href: "/use-cases/startups", label: "For Startups" },
    ],
  },
  {
    title: "Compare",
    links: [
      { href: "/compare/torgima-vs-notion", label: "vs Notion" },
      { href: "/compare/torgima-vs-clickup", label: "vs ClickUp" },
      { href: "/compare/torgima-vs-asana", label: "vs Asana" },
      { href: "/compare/torgima-vs-todoist", label: "vs Todoist" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/terms", label: "Terms of Service" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-dark-border bg-[#080510]">
      <div className="mx-auto max-w-content px-4 sm:px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <p className="font-syne font-extrabold text-xl text-white">TORGIMA</p>
            <p className="mt-2 text-sm text-zinc-400">The Execution Operating System</p>
            <p className="mt-1 text-sm font-semibold text-primary-bright">Stop Planning. Start Executing.</p>
            <div className="mt-4 flex gap-4 text-xs text-zinc-500">
              <a href="https://twitter.com/torgima" className="hover:text-white">
                Twitter
              </a>
              <a href="https://linkedin.com/company/torgima" className="hover:text-white">
                LinkedIn
              </a>
              <a href="https://youtube.com/@torgima" className="hover:text-white">
                YouTube
              </a>
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs text-zinc-600 leading-relaxed max-w-3xl">
          Torgima is a daily task manager, habit tracker, project management platform, and AI execution
          system built for creators, solopreneurs, founders, and agency owners. Replace Notion,
          ClickUp, Asana, and Todoist with one intelligent system that tells you exactly what to do
          every day.
        </p>

        <div className="mt-8 pt-8 border-t border-dark-border flex flex-wrap justify-between gap-4 text-xs text-zinc-500">
          <span>© {new Date().getFullYear()} Torgima. All rights reserved.</span>
          <span className="italic">Built for people who execute.</span>
        </div>
      </div>
    </footer>
  );
}
