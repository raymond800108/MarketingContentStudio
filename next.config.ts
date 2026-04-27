import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // ffmpeg.wasm requires SharedArrayBuffer, which requires cross-origin isolation.
        // COEP: credentialless lets us keep loading third-party CDN assets (kie.ai / fal.ai
        // images/videos) without them having to opt-in via CORP, while still enabling
        // SharedArrayBuffer. Chrome/Edge/Firefox support this; Safari has partial support.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
