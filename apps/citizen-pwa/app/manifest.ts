import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'eNagarSeba Citizen',
    short_name: 'eNagarSeba',
    description: 'One-stop municipal services for the citizens of West Bengal.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F4C75',
    theme_color: '#0F4C75',
    icons: [
      { src: '/icon', type: 'image/png', sizes: '512x512', purpose: 'any' },
      { src: '/icon', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
  };
}
