'use client';

import { Button } from '@enagar/ui';

export function StateLoginActions(): JSX.Element {
  return (
    <>
      <Button
        className="mt-6 w-full"
        type="button"
        onClick={() => {
          window.location.assign('/api/admin-auth/start');
        }}
      >
        Continue to Keycloak
      </Button>
      <Button
        className="mt-3 w-full"
        type="button"
        variant="secondary"
        onClick={() => {
          window.location.assign('/api/admin-auth/logout');
        }}
      >
        Sign out of Keycloak and try again
      </Button>
    </>
  );
}
