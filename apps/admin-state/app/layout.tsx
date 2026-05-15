import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'eNagarSeba — State Super-Admin',
  description: 'Onboard municipalities, supervise tenants, and support ULB operators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
