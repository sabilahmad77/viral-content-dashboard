/** @type {import('next').NextConfig} */
const path = require('path');

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
  webpack: (config, { defaultLoaders }) => {
    // Apply the default Next.js (SWC) TypeScript loader to files in the
    // Express API source tree, which lives outside this package's root dir.
    // Without this rule, webpack rejects .ts files from ../api/src/ because
    // the built-in SWC rule only matches files under apps/web/.
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      include: [path.resolve(__dirname, '..', 'api', 'src')],
      use: defaultLoaders.babel,
    });
    return config;
  },
};

module.exports = nextConfig;
