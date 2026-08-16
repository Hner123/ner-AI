import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node-native libraries that must not be bundled by Turbopack.
  serverExternalPackages: ["pg", "exceljs", "mammoth", "unpdf"],
};

export default nextConfig;
