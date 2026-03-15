import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tandem/ui-kit", "@tandem/shared"],
  allowedDevOrigins: ["*.replit.dev", "*.spock.replit.dev"],
  devIndicators: false,
};

export default nextConfig;
// deploy 1773018815
