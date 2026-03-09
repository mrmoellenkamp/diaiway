/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Allow images from Vercel Blob storage (*.public.blob.vercel-storage.com)
    // and any other external domains used in the app
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },
  // Needed so Next.js correctly handles the ESM bundles of daily-co packages.
  // SSR protection is handled via VideoConfig.tsx (dynamic + ssr:false).
  transpilePackages: ["@daily-co/daily-js", "jotai"],
}

export default nextConfig
