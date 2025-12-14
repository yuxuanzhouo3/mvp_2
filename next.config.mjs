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
  // Controlled via env to avoid profiling alias issues on some React versions
  webpack: (config, { dev, isServer }) => {
    const disableProfilingAlias =
      process.env.DISABLE_REACT_PROFILING_ALIAS === "true" ||
      process.env.DISABLE_REACT_PROFILING_ALIAS === "1";

    // Disable React DevTools in production
    if (!dev && !isServer) {
      if (!disableProfilingAlias) {
        config.resolve.alias = {
          ...config.resolve.alias,
          'react-dom': 'react-dom/profiling',
        }
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
