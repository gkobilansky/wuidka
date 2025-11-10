export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  createdAt: string;
}

export interface LeaderboardResponse {
  isoWeek: string;
  entries: LeaderboardEntry[];
}

export interface FetchLeaderboardOptions {
  week?: string;
  signal?: AbortSignal;
}

const LEADERBOARD_ENDPOINT = '/api/leaderboard';

export async function fetchLeaderboard(options: FetchLeaderboardOptions = {}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (options.week) {
    params.set('week', options.week);
  }

  const query = params.toString();
  const url = query ? `${LEADERBOARD_ENDPOINT}?${query}` : LEADERBOARD_ENDPOINT;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: options.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach leaderboard service');
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Received an invalid leaderboard response');
  }

  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load leaderboard';
    throw new Error(message);
  }

  const entries: LeaderboardEntry[] = Array.isArray(payload?.entries)
    ? payload.entries.map((entry: any) => ({
        rank: Number(entry?.rank ?? 0),
        nickname: String(entry?.nickname ?? 'Mystery Player'),
        score: Number(entry?.score ?? 0),
        createdAt: String(entry?.createdAt ?? '')
      }))
    : [];

  return {
    isoWeek: typeof payload?.isoWeek === 'string' ? payload.isoWeek : '',
    entries
  };
}
