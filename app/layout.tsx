import type { Metadata, Viewport } from 'next';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Oddments — small instruments, finished properly',
    template: '%s · Oddments',
  },
  description:
    'A collection of small, unusually polished browser utilities. Local-first, no account, no database — everything runs in your browser.',
  applicationName: 'Oddments',
  authors: [{ name: 'Oddments' }],
  icons: {
    icon: [
      {
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#b23c12"/><text x="16" y="23" font-family="ui-monospace,monospace" font-size="20" font-weight="700" text-anchor="middle" fill="#fff">o</text></svg>',
          ),
      },
    ],
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
      </body>
    </html>
  );
}
