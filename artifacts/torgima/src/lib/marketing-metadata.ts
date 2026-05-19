import { useEffect } from "react";

const DEFAULT_DESCRIPTION =
  "Torgima converts your goal into a structured execution blueprint, generates your next task continuously, and adapts to your execution reality with overnight intelligence.";

function setMeta(selector: string, attr: "content", value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const match = selector.match(/\[(name|property)="([^"]+)"\]/);
    if (match) el.setAttribute(match[1]!, match[2]!);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

export function useMarketingMetadata(input: {
  title: string;
  description?: string;
  path?: string;
}) {
  useEffect(() => {
    const title = input.title === "Torgima" ? "Torgima — The Execution Operating System" : `${input.title} | Torgima`;
    const description = input.description ?? DEFAULT_DESCRIPTION;
    const url = `https://torgima.com${input.path ?? ""}`;

    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:type"]', "content", "website");
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:image"]', "content", "https://torgima.com/og-image.png");
    setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", "https://torgima.com/og-image.png");
    setMeta('meta[name="robots"]', "content", "index, follow");
  }, [input.description, input.path, input.title]);
}
