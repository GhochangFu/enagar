import preset from '@enagar/config/tailwind/base';

import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset as Partial<Config>],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/forms/src/web/**/*.tsx',
  ],
};

export default config;
