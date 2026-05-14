import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Official mark — replace `public/logo.png` with your `torgima_logo.png` asset. */
export function BrandLogo({
  height = 32,
  className,
  href = "/",
}: {
  height?: number;
  className?: string;
  href?: string | null;
}) {
  const img = (
    <Image
      src="/logo.png"
      alt="Torgima — Execute with intelligence"
      height={height}
      width={Math.round(height * 4)}
      className={cn("h-auto w-auto max-w-[220px] object-contain object-left", className)}
      priority
    />
  );
  if (!href) return img;
  return (
    <Link href={href} className="flex items-center shrink-0 focus-ring rounded-sm">
      {img}
    </Link>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      height={size}
      width={size}
      className="object-contain rounded-sm"
      aria-hidden
    />
  );
}
