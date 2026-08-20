/**
 * Site-level constants and the shared page-metadata helper.
 *
 * The public origin is deliberately not hardcoded: canonical URLs, Open Graph
 * URLs, robots.txt, and sitemap.xml all resolve against NEXT_PUBLIC_SITE_URL,
 * set at build time by whoever deploys (see DEPLOYMENT.md). Without it, the
 * build falls back to localhost — fine for development, wrong for production,
 * and the deployment docs say so.
 */

import type { Metadata } from 'next';

export const SITE_NAME = 'Oddments';
export const SITE_TITLE = 'Oddments — small instruments for annoying little problems';
export const SITE_TAGLINE = 'Small instruments for annoying little problems.';
export const SITE_DESCRIPTION =
  'A collection of small browser tools for annoying little problems. Local-first, no account, no database — everything runs in your browser.';

/** The public repository — also where feedback lives (GitHub Issues). */
export const GITHUB_URL = 'https://github.com/blairhartman/oddments';
export const FEEDBACK_URL = `${GITHUB_URL}/issues`;

/** Build-time fallback when NEXT_PUBLIC_SITE_URL is unset (development). */
export const DEFAULT_SITE_URL = 'http://localhost:3000';

/** The public origin for absolute URLs, without a trailing slash. */
export function siteUrl(): string {
  // Read as a full static property so Next can inline it at build time.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEFAULT_SITE_URL;
  return configured.replace(/\/+$/, '');
}

/**
 * The shared social-preview image, emitted at build time by
 * app/opengraph-image.tsx. Declared explicitly here because Next merges
 * metadata shallowly: a page-level openGraph block would otherwise drop the
 * file-convention image on every route below the root segment.
 */
export const OG_IMAGE = {
  url: '/opengraph-image',
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
};

export interface PageMetaInput {
  /** Display name; the layout's title template appends "· Oddments". */
  name: string;
  description: string;
  /** Route path starting with "/", used for the canonical and og:url. */
  path: string;
}

/**
 * Metadata for one public page (a tool, About, Privacy).
 *
 * Each page declares its own canonical and Open Graph block because Next
 * merges metadata shallowly: an inherited canonical would silently point
 * every page at the parent. The og:image is injected separately by the
 * file-convention `app/opengraph-image.tsx`, which applies to every route.
 */
export function pageMetadata({ name, description, path }: PageMetaInput): Metadata {
  return {
    title: name,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${name} · ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      type: 'website',
      images: [OG_IMAGE],
    },
  };
}
