import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'isPublicRoute';

/** Marks routes that intentionally bypass JWT auth, such as health and login endpoints. */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_ROUTE_KEY, true);
