import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  productionBrowserSourceMaps: false, // Segurança: Desabilita "ver código fonte" em produção
  poweredByHeader: false, // Segurança: Esconde que o site é feito em Next.js
};

export default nextConfig;
