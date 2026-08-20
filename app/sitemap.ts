import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site/meta';
import { toolPath, TOOLS } from '@/lib/site/tools';

// Static export: emitted once at build time as /sitemap.xml.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  // No lastModified: the build has no honest per-page modification date, and
  // a fabricated one is worse than none.
  return [
    // Bare origin (no trailing slash) so the entry string-matches the home
    // page's rendered canonical.
    { url: base },
    ...TOOLS.map((tool) => ({ url: `${base}${toolPath(tool)}` })),
    { url: `${base}/about` },
    { url: `${base}/privacy` },
  ];
}
