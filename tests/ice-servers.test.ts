import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIceServerProvider } from '../server/src/lib/iceServers';
import { config } from '../server/src/config';

const stun = { urls: ['stun:stun.example.com:3478'] };
const base = { ...config, iceServers: [stun] };
const cloudflare = { ...base, cloudflareTurn: { keyId: 'key', token: 'secret' } };

function cloudflareReply(status = 201) {
  return new Response(
    JSON.stringify({
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
        {
          urls: [
            'turn:turn.cloudflare.com:3478?transport=udp',
            'turn:turn.cloudflare.com:53?transport=udp',
            'turns:turn.cloudflare.com:443?transport=tcp',
          ],
          username: 'user',
          credential: 'pass',
        },
      ],
    }),
    { status },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ICE server provider', () => {
  it('returns the static servers when Cloudflare TURN is not configured', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await createIceServerProvider({ ...base, cloudflareTurn: null })()).toEqual([stun]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('adds Cloudflare relays without port 53 and caches them', async () => {
    const fetch = vi.fn(async () => cloudflareReply());
    vi.stubGlobal('fetch', fetch);
    const provider = createIceServerProvider(cloudflare);
    const servers = await provider();
    expect(servers).toEqual([
      stun,
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turns:turn.cloudflare.com:443?transport=tcp',
        ],
        username: 'user',
        credential: 'pass',
      },
    ]);
    await provider();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    });
  });

  it('falls back to the static servers when Cloudflare fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => cloudflareReply(401)),
    );
    expect(await createIceServerProvider(cloudflare)()).toEqual([stun]);
  });
});
