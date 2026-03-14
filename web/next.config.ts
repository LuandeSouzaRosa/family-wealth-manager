import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false, // Desabilita o modo estrito para evitar double-render e alguns erros
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Desabilitar turbopack options que podem estar conflitando
  experimental: {
     workerThreads: false,
     cpus: 1
  }
};

export default nextConfig;
