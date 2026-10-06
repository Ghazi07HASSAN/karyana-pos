/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Build time par TypeScript errors ignore karne ke liye
    ignoreBuildErrors: true,
  },
  eslint: {
    // Build time par ESLint warnings/errors ignore karne ke liye
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;