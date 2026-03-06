/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Tells Next.js to transpile these ESM-only packages for the client bundle.
  // The actual SSR protection comes from VideoConfig.tsx (dynamic + ssr:false).
  transpilePackages: ["@daily-co/daily-js", "@daily-co/daily-react"],
}

export default nextConfig
