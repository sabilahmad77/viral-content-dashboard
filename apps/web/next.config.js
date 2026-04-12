/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Skip type checking during build — checked separately via tsc
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.bfl.ml' },
      { protocol: 'https', hostname: '**.ideogram.ai' },
      { protocol: 'https', hostname: '**.klingai.com' },
      { protocol: 'https', hostname: '**.loca.lt' },
    ],
  },
};

module.exports = nextConfig;
