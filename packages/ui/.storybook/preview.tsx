import type { Preview } from '@storybook/react';
import { applyTenantTheme } from '@enagar/tenant-theme';
import '../src/storybook.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.tenantTheme as 'platform' | 'kmc' | 'hmc' | 'cmc';
      if (theme === 'kmc') {
        applyTenantTheme({ theme_color: '#0F4C75', logo_url: null, languages_enabled: ['en'] });
      } else if (theme === 'hmc') {
        applyTenantTheme({ theme_color: '#1B5E20', logo_url: null, languages_enabled: ['en'] });
      } else if (theme === 'cmc') {
        applyTenantTheme({ theme_color: '#6A1B9A', logo_url: null, languages_enabled: ['en'] });
      } else {
        applyTenantTheme(null);
      }
      return (
        <div className="min-h-[200px] bg-canvas p-6">
          <Story />
        </div>
      );
    },
  ],
  globalTypes: {
    tenantTheme: {
      name: 'Tenant theme',
      description: 'Runtime CSS vars via @enagar/tenant-theme',
      defaultValue: 'platform',
      toolbar: {
        icon: 'paintbrush',
        title: 'ULB theme',
        description: 'Platform vs KMC / HMC / CMC brand CSS vars',
        showName: true,
        items: [
          { value: 'platform', title: 'Platform' },
          { value: 'kmc', title: 'KMC' },
          { value: 'hmc', title: 'HMC' },
          { value: 'cmc', title: 'CMC' },
        ],
      },
    },
  },
};

export default preview;
