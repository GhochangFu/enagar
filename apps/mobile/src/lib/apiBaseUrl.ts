const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Metro / Expo Go host, e.g. `192.168.1.8:8081` → `192.168.1.8`. */
export function hostFromMetroUri(hostUri: string): string | null {
  const host = hostUri.split(':')[0]?.trim() ?? '';
  if (!host || LOCAL_API_HOSTS.has(host)) {
    return null;
  }
  return host;
}

/**
 * On a physical device, `localhost` in the API URL points at the phone — not the dev PC.
 * When Metro advertises a LAN host (`exp://192.168.x.x:8081`), swap localhost for that IP.
 */
export function rewriteLocalhostApiBase(base: string, lanHost: string): string {
  try {
    const url = new URL(base);
    if (!LOCAL_API_HOSTS.has(url.hostname)) {
      return base.replace(/\/$/, '');
    }
    url.hostname = lanHost;
    return url.toString().replace(/\/$/, '');
  } catch {
    return base.replace(/\/$/, '');
  }
}
