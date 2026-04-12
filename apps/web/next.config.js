/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.bfl.ml' },
      { protocol: 'https', hostname: '**.ideogram.ai' },
      { protocol: 'https', hostname: '**.klingai.com' },
    ],
  },
};

module.exports = nextConfig;
