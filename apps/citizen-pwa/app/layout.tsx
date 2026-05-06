import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'eNagarSeba',
  description: 'One-stop municipal services for the citizens of West Bengal.',
};

export const viewport: Viewport = {
  themeColor: '#0F4C75',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
