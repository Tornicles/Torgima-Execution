/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/design-system"],
  async redirects() {
    return [
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/terms", destination: "/legal/terms", permanent: true },
    ];
  },
};

export default nextConfig;
