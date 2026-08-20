import { ImageResponse } from 'next/og';

// Static export: rendered once at build time.
export const dynamic = 'force-static';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS home-screen icon: the same mark as the favicon, at Apple's size.
// No rounded corners — iOS applies its own mask.
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#b23c12',
        color: '#ffffff',
        fontSize: 128,
        fontWeight: 700,
      }}
    >
      o
    </div>,
    size,
  );
}
