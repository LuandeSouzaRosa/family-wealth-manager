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
  experimental: {
    // Força o build a continuar mesmo com erros de worker/memória
    workerThreads: false,
    cpus: 1,
    turbo: {
       // Silencia o erro de Turbopack vs Webpack
    }
  },
  // Força o uso explícito de Webpack se necessário, ou Turbopack vazio
  turbopack: {} 
};

export default nextConfig;
