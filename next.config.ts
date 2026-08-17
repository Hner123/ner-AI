import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node-native libraries that must not be bundled by Turbopack.
  serverExternalPackages: ["pg", "exceljs", "mammoth", "unpdf"],
  async rewrites() {
    return [
      // Chrome insists on this exact path to verify the Android app belongs to
      // this site. A directory literally named `.well-known` inside app/ isn't
      // routable, so the handler lives at /assetlinks and is rewritten here.
      { source: "/.well-known/assetlinks.json", destination: "/assetlinks" },
    ];
  },
};

export default nextConfig;
