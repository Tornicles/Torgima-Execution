import { Code2, Globe, Palette, ShoppingBag, Users, Video } from "lucide-react";

const industries = [
  { icon: Code2, label: "Software" },
  { icon: Palette, label: "Design" },
  { icon: Video, label: "Content Creation" },
  { icon: ShoppingBag, label: "E-Commerce" },
  { icon: Users, label: "Coaching" },
  { icon: Globe, label: "Agency" },
];

export function SocialProof() {
  return (
    <section className="border-y border-dark-border bg-dark-card/50 py-12">
      <div className="mx-auto max-w-content px-4 sm:px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-8">
          Used by people building in
        </p>
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
          {industries.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-zinc-400">
              <Icon className="h-5 w-5 text-primary-bright" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
