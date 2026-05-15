import preset from '@enagar/config/tailwind/base';

import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset as Partial<Config>],
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
};

export default config;
