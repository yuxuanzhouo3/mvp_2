/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configure static generation
  generateEtags: false,
  // Force disable profiling to avoid module not found errors
  webpack: (config, { dev, isServer }) => {
    // Disable React DevTools in production
    if (!dev && !isServer) {
      // Remove React DevTools from production build
      config.plugins = config.plugins.filter(plugin =>
        plugin.constructor.name !== 'ReactDevToolsPlugin'
      )
    }
    return config
  },
}

export default nextConfig
