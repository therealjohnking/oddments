import type { NextConfig } from 'next';

/**
 * Oddments ships as a fully static, client-side app: no server, no database, no
 * runtime APIs. `output: 'export'` emits a plain `out/` directory that can be
 * hosted on any static host (or opened from disk). Everything the tools do
 * happens in the browser.
 */
// A production build without the public origin still works, but its canonical
// URLs, og:url, robots.txt, and sitemap.xml all point at localhost. That is
// fine for local checks and must not be deployed — say so loudly at build time.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
  console.warn(
    '\n⚠ NEXT_PUBLIC_SITE_URL is not set: canonical/Open Graph URLs, robots.txt, and ' +
      'sitemap.xml will use http://localhost:3000. Fine for local verification — do not ' +
      'deploy this build. See DEPLOYMENT.md.\n',
  );
}

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  // The static export has no image optimization server; we don't use next/image
  // anyway, but this keeps `next/image` (if ever added) export-safe.
  images: { unoptimized: true },
};

export default nextConfig;
