import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site/meta';

// Static export: rendered once at build time. This one generic card serves
// every route (file-convention og images apply to the whole subtree) — a
// deliberate M0.10 choice over nine bespoke marketing graphics.
export const dynamic = 'force-static';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

// The site's warm-paper light palette, so shared links look like the site.
const BG = '#f6f4ee';
const TEXT = '#1c1b18';
const MUTED = '#57544c';
const ACCENT = '#b23c12';
const BORDER = '#d3cebf';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '72px 84px',
        background: BG,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 76,
            height: 76,
            borderRadius: 18,
            background: ACCENT,
            color: '#ffffff',
            fontSize: 52,
            fontWeight: 700,
          }}
        >
          o
        </div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>
          {SITE_NAME}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 36,
          fontSize: 42,
          fontWeight: 500,
          color: MUTED,
        }}
      >
        {SITE_TAGLINE}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 64,
          paddingTop: 40,
          borderTop: `2px solid ${BORDER}`,
          fontSize: 28,
          color: MUTED,
        }}
      >
        No account, no uploads — everything runs in your browser.
      </div>
    </div>,
    size,
  );
}
