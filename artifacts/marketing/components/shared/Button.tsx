import Link from "next/link";
import { GhostButton, PrimaryButton, TorgimaButton } from "@workspace/design-system";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline";

const linkGhost =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-8 py-4 border border-white/20 text-white font-heading font-semibold transition-all duration-150 hover:bg-white/10 hover:scale-[1.02]";
const linkSecondary =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 py-3 bg-white text-[#18181b] font-heading font-bold hover:bg-zinc-100 hover:scale-[1.02]";

export function Button({
  href,
  children,
  variant = "primary",
  className,
  onClick,
  type = "button",
}: {
  href?: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  if (variant === "secondary") {
    const base = cn(linkSecondary, className);
    return href ? (
      <Link href={href} className={base}>
        {children}
      </Link>
    ) : (
      <button type={type} onClick={onClick} className={base}>
        {children}
      </button>
    );
  }

  if (variant === "ghost") {
    const base = cn(linkGhost, className);
    return href ? (
      <Link href={href} className={base}>
        {children}
      </Link>
    ) : (
      <button type={type} onClick={onClick} className={base}>
        {children}
      </button>
    );
  }

  if (variant === "outline") {
    return href ? (
      <Link href={href} className={cn(className)}>
        <GhostButton className="w-full pointer-events-none">{children}</GhostButton>
      </Link>
    ) : (
      <GhostButton type={type} onClick={onClick} className={className}>
        {children}
      </GhostButton>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn("inline-block", className)}>
        <PrimaryButton className="pointer-events-none">{children}</PrimaryButton>
      </Link>
    );
  }

  return (
    <TorgimaButton variant="primary" type={type} onClick={onClick} className={className}>
      {children}
    </TorgimaButton>
  );
}
