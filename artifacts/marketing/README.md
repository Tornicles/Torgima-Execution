# Torgima marketing site (Next.js 14)

Premium public marketing site — App Router, Tailwind, Framer Motion, Syne / DM Sans / JetBrains Mono.

## Logo

Replace **`public/logo.png`** with your official **`torgima_logo.png`** (white on black, full wordmark). `public/og-image.png` should be your real Open Graph asset (currently a placeholder).

## Commands

```bash
pnpm --filter @workspace/marketing dev
pnpm --filter @workspace/marketing build
pnpm --filter @workspace/marketing start
```

## Deploy

Point your host at **`artifacts/marketing`** with default Next.js settings (e.g. Cloudflare Pages or another static/Node host). **Vercel is not used for production TORGIMA execution SPA** — that runs on Cloudflare Pages at https://torgima.com.
