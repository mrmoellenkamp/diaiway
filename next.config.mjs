/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  /**
   * Prevent @daily-co packages from being bundled into the server bundle.
   * Next.js will treat them as external (Node require()) on the server side,
   * but since ssr:false is used, they are never actually required there.
   */
  serverExternalPackages: ["@daily-co/daily-js", "@daily-co/daily-react"],

  /**
   * Ensure Next.js transpiles the ESM-only Daily packages correctly
   * when they are evaluated client-side.
   */
  transpilePackages: ["@daily-co/daily-js", "@daily-co/daily-react"],

  webpack(config, { isServer }) {
    if (isServer) {
      // Hard-exclude Daily packages from the server bundle as a final safety net.
      // If something tries to import them server-side it gets an empty module,
      // not a runtime crash from accessing `window`.
      const existing = config.resolve?.alias ?? {}
      config.resolve = {
        ...config.resolve,
        alias: {
          ...existing,
          "@daily-co/daily-js": false,
          "@daily-co/daily-react": false,
        },
      }
    }
    return config
  },
}

export default nextConfig
