import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'eNagarSeba Citizen',
    short_name: 'eNagarSeba',
    description: 'One-stop municipal services for the citizens of West Bengal.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF7F4',
    theme_color: '#BF4A0A',
    icons: [
      { src: '/icon', type: 'image/png', sizes: '512x512', purpose: 'any' },
      { src: '/icon', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
  };
}
