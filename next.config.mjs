/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Needed so Next.js correctly handles the ESM bundles of daily-co packages.
  // SSR protection is handled via VideoConfig.tsx (dynamic + ssr:false).
  transpilePackages: ["@daily-co/daily-js", "@daily-co/daily-react", "jotai"],
}

export default nextConfig
