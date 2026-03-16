import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tandem/ui-kit", "@tandem/shared"],
  allowedDevOrigins: ["*.replit.dev", "*.spock.replit.dev"],
  devIndicators: false,
  async redirects() {
    return [
      // Old config pages → new /chatbot tab destinations
      { source: "/knowledge", destination: "/chatbot?tab=knowledge", permanent: false },
      { source: "/handoff",   destination: "/chatbot?tab=handoff",   permanent: false },
      { source: "/intents",   destination: "/chatbot?tab=behavior",  permanent: false },
      { source: "/widget",    destination: "/chatbot?tab=appearance", permanent: false },
      { source: "/menus",     destination: "/chatbot?tab=knowledge", permanent: false },
      // Old top-level pages → /account
      { source: "/settings",     destination: "/account", permanent: false },
      { source: "/integrations", destination: "/account", permanent: false },
    ];
  },
};

export default nextConfig;
// deploy 1773018815
