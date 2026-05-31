import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog-data";

const BASE = "https://torgima.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/features",
    "/how-it-works",
    "/pricing",
    "/about",
    "/faq",
    "/blog",
    "/use-cases",
    "/use-cases/creators",
    "/use-cases/solopreneurs",
    "/use-cases/agencies",
    "/use-cases/coaches",
    "/use-cases/startups",
    "/compare/torgima-vs-notion",
    "/compare/torgima-vs-clickup",
    "/compare/torgima-vs-asana",
    "/compare/torgima-vs-todoist",
    "/legal/privacy",
    "/legal/terms",
  ];

  return [
    ...staticPages.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: path === "" || path === "/pricing" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.includes("compare") || path.includes("use-cases") ? 0.8 : 0.9,
    })),
    ...blogPosts.map((post) => ({
      url: `${BASE}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
