'use client';

import { useEffect, useRef } from 'react';

import { authHeaders, readApiError } from '../lib/workspace-http';

import type { TokenResponse } from '../lib/workspace-types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = globalThis.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * When `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set, subscribes via service worker and registers the
 * serialised PushSubscription with `POST /citizen/notifications/push-token`.
 */
export function PwaWebPushRegister({ token }: { token: TokenResponse }): null {
  const done = useRef(false);

  useEffect(() => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapid || done.current || typeof window === 'undefined') {
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
        });
        const res = await fetch(`${apiBaseUrl}/citizen/notifications/push-token`, {
          method: 'POST',
          headers: authHeaders(token, true),
          body: JSON.stringify({
            platform: 'web',
            token: JSON.stringify(sub.toJSON()),
          }),
        });
        if (!res.ok) {
          console.warn(await readApiError(res));
          return;
        }
        done.current = true;
      } catch {
        /* Optional pilot env — non-fatal when VAPID not provisioned. */
      }
    })();
  }, [token]);

  return null;
}
