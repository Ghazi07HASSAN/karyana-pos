import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Build time par TypeScript errors ignore karne ke liye
    ignoreBuildErrors: true,
  },
  eslint: {
    // Build time par ESLint warnings/errors ignore karne ke liye
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;