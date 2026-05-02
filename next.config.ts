import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // React Email pulls react-dom/server at runtime via dynamic resolution that
  // Next's bundler can't follow without help. Marking these external keeps
  // them as plain CJS resolves on the server.
  serverExternalPackages: [
    "@react-email/render",
    "@react-email/components",
  ],
};

export default nextConfig;
