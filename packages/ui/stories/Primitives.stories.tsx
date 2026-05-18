import { Badge } from '../src/components/Badge';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Icon } from '../src/components/Icon';
import { PageHeader } from '../src/components/PageHeader';
import { Skeleton } from '../src/components/Skeleton';
import { Spinner } from '../src/components/Spinner';

import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Phase UX/Primitives',
};

export default meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button loading>Loading</Button>
    </div>
  ),
};

export const CardsAndBadges: StoryObj = {
  render: () => (
    <div className="grid max-w-lg gap-4">
      <Card>
        <PageHeader
          eyebrow="Sprint 6.14"
          title="Birth Certificate"
          subtitle="Tenant bar uses brand surface tokens"
          tenantBar
        />
        <div className="mt-4 flex gap-2">
          <Badge tone="brand">Pending clerk</Badge>
          <Badge tone="success">Approved</Badge>
          <Badge tone="warning">SLA</Badge>
        </div>
      </Card>
      <Card tone="surface" padding="md">
        <p className="text-sm text-ink-secondary">Surface tone uses tenant --brand-surface-rgb.</p>
      </Card>
    </div>
  ),
};

export const Loading: StoryObj = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner />
      <Skeleton className="h-10 w-48" />
    </div>
  ),
};

export const Icons: StoryObj = {
  render: () => (
    <div className="flex gap-4 text-brand">
      <Icon name="home" />
      <Icon name="inbox" />
      <Icon name="building" />
      <Icon name="check" />
    </div>
  ),
};
