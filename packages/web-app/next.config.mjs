/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Transpile workspace packages
  transpilePackages: ['@ollama-code/webui', '@ollama-code/ollama-code-core'],

  // Disable TypeScript checking during build (handled separately)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Experimental features
  experimental: {
    // Enable Server Actions for future use
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Webpack configuration for handling ESM modules
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },

  // Enable Turbopack (Next.js 16 default)
  turbopack: {},
};

export default nextConfig;
