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
  // Prevent webpack from bundling server-only packages that have native binaries
  // or must remain as Node.js require() calls in the serverless function bundle.
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      'sharp',
      'bcryptjs',
      'multer',
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner',
    ],
  },
};

module.exports = nextConfig;
