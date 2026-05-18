import preset from '@enagar/config/tailwind/base';

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './stories/**/*.{ts,tsx}'],
  presets: [preset as Partial<Config>],
  plugins: [],
};

export default config;
