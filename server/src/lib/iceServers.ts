import type { IceServer } from '@scxn/shared';
import type { ServerConfig } from '../config';

const CLOUDFLARE_TTL_S = 24 * 60 * 60;
/** Credentials are refreshed well before they expire, so a room never outlives its relay. */
const CLOUDFLARE_REFRESH_MS = 12 * 60 * 60_000;
const CLOUDFLARE_TIMEOUT_MS = 5000;

interface CloudflareResponse {
  iceServers?: IceServer[];
}

/** Browsers block port 53, so those URLs only add timeouts. */
const withoutPort53 = (server: IceServer): IceServer | null => {
  const urls = [server.urls].flat().filter((url) => !/:53(\?|$)/.test(url));
  return urls.length ? { ...server, urls } : null;
};

async function fetchCloudflare(keyId: string, token: string): Promise<IceServer[]> {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: CLOUDFLARE_TTL_S }),
      signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const body = (await res.json()) as CloudflareResponse;
  const relays = (body.iceServers ?? [])
    .filter((s) => s.username && s.credential)
    .map(withoutPort53)
    .filter((s): s is IceServer => s !== null);
  if (!relays.length) throw new Error('Cloudflare TURN returned no relay servers');
  return relays;
}

/**
 * ICE servers handed to each participant on join: the static STUN/TURN configuration plus,
 * when configured, short-lived Cloudflare TURN credentials. Never rejects; a Cloudflare
 * outage falls back to the static list.
 */
export function createIceServerProvider(config: ServerConfig): () => Promise<IceServer[]> {
  const cloudflare = config.cloudflareTurn;
  if (!cloudflare) return async () => config.iceServers;

  let cached: { servers: IceServer[]; expiresAt: number } | null = null;
  let pending: Promise<IceServer[]> | null = null;

  return async () => {
    if (cached && cached.expiresAt > Date.now()) return cached.servers;
    pending ??= fetchCloudflare(cloudflare.keyId, cloudflare.token)
      .then((relays) => {
        const servers = [...config.iceServers, ...relays];
        cached = { servers, expiresAt: Date.now() + CLOUDFLARE_REFRESH_MS };
        return servers;
      })
      .catch((err: unknown) => {
        console.warn('[scxn] Cloudflare TURN unavailable, using static ICE servers', err);
        return config.iceServers;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
