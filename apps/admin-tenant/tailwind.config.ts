import preset from '@enagar/config/tailwind/base';

import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset as Partial<Config>],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/forms/src/web/**/*.tsx',
    '../../packages/forms/src/builder/**/*.tsx',
  ],
};

export default config;
