import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  transpilePackages: ['react-force-graph-3d', 'three', 'three-spritetext'],
};

export default nextConfig;