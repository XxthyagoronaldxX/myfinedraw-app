import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // gera .next/standalone (servidor enxuto usado na imagem Docker)
  output: 'standalone',
};

export default nextConfig;
