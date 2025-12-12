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
  webpack: (config, { dev, isServer }) => {
    // Disable React DevTools in production
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-dom': 'react-dom/profiling',
      }
      // Remove React DevTools from production build
      config.plugins = config.plugins.filter(plugin =>
        plugin.constructor.name !== 'ReactDevToolsPlugin'
      )
    }
    return config
  },
}

export default nextConfig
