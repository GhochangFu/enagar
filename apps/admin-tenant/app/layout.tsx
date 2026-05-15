import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'eNagarSeba — Tenant Admin',
  description: 'Configure services and monitor KPIs for your municipality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
