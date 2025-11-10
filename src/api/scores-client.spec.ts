import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { submitScore, type SubmitScoreResponse } from './scores-client';

const mockResponse = (options: { ok?: boolean; status?: number; jsonBody?: any } = {}): Response => {
  const { ok = true, status = 200, jsonBody = {} } = options;
  return {
    ok,
    status,
    json: async () => jsonBody,
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'default',
    url: '',
    clone() {
      return this;
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(jsonBody)
  } as Response;
};

describe('submitScore', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('throws when nickname is missing', async () => {
    await expect(
      submitScore({ nickname: '   ', score: 100 })
    ).rejects.toThrow('Nickname is required');
  });

  it('submits payload and normalizes response', async () => {
    const payload: SubmitScoreResponse = {
      placement: 2,
      isoWeek: '2025-W07',
      entry: {
        id: 'abc',
        nickname: 'Tester',
        score: 1234,
        isoWeek: '2025-W07',
        createdAt: '2025-02-13T00:00:00.000Z'
      }
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: payload }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const result = await submitScore({ nickname: ' Tester ', email: '  user@example.com ', score: 1234 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({
      nickname: 'Tester',
      email: 'user@example.com',
      score: 1234
    }));
    expect(result).toEqual(payload);
  });

  it('throws a friendly validation error when server responds with 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ ok: false, status: 400, jsonBody: { error: 'Nickname too short' } })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      submitScore({ nickname: 't', score: 1 })
    ).rejects.toThrow('Nickname too short');
  });

  it('throws a friendly service error when server responds with 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ ok: false, status: 503 })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      submitScore({ nickname: 'User', score: 1 })
    ).rejects.toThrow('Score service is temporarily unavailable');
  });

  it('surfaces network errors distinctly', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      submitScore({ nickname: 'User', score: 10 })
    ).rejects.toThrow('Unable to reach score service');
  });
});
