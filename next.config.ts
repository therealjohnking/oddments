import type { NextConfig } from 'next';

/**
 * Oddments ships as a fully static, client-side app: no server, no database, no
 * runtime APIs. `output: 'export'` emits a plain `out/` directory that can be
 * hosted on any static host (or opened from disk). Everything the tools do
 * happens in the browser.
 */
const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  // The static export has no image optimization server; we don't use next/image
  // anyway, but this keeps `next/image` (if ever added) export-safe.
  images: { unoptimized: true },
};

export default nextConfig;
