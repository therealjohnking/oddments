import type { Metadata, Viewport } from 'next';
import { Analytics } from '@/components/site/Analytics';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from '@/lib/site/meta';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Site-wide defaults; every public page also declares its own openGraph
  // block and canonical via pageMetadata() (Next merges metadata shallowly).
  // The og:image comes from app/opengraph-image.tsx, the icons from
  // app/icon.tsx and app/apple-icon.tsx — all generated at build time.
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#17161a' },
  ],
};

// Applied before paint so the chosen theme never flashes.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('oddments-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
