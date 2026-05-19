import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

/** Brand square used by the web manifest + install prompts (Master Sprint 5.4). */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#BF4A0A',
        color: '#ffffff',
        fontSize: 192,
        fontWeight: 700,
      }}
    >
      eN
    </div>,
    { ...size },
  );
}
