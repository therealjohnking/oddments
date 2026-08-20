import { ImageResponse } from 'next/og';

// Static export: the icon is rendered once at build time, not on a server.
export const dynamic = 'force-static';

export const size = { width: 48, height: 48 };
export const contentType = 'image/png';

// The favicon is generated at build time from the same mark the header uses:
// a rounded burnt-orange square with a white lowercase "o".
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#b23c12',
        borderRadius: 10,
        color: '#ffffff',
        fontSize: 34,
        fontWeight: 700,
      }}
    >
      o
    </div>,
    size,
  );
}
