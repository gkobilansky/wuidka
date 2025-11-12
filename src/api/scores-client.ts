export interface SubmitScorePayload {
  nickname: string;
  score: number;
  email?: string;
}

export interface SubmitScoreResponse {
  placement: number;
  isoWeek: string;
  entry: {
    id: string;
    userId?: string | null;
    nickname: string;
    score: number;
    isoWeek: string;
    createdAt: string;
  };
}

export interface SubmitScoreOptions {
  signal?: AbortSignal;
}

const SCORES_ENDPOINT = '/api/scores';

export async function submitScore(
  payload: SubmitScorePayload,
  options: SubmitScoreOptions = {}
): Promise<SubmitScoreResponse> {
  const nickname = payload.nickname?.trim();
  if (!nickname) {
    throw new Error('Nickname is required');
  }

  if (!Number.isFinite(payload.score)) {
    throw new Error('Score is missing');
  }

  const email = payload.email?.trim();

  let response: Response;
  try {
    response = await fetch(SCORES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        nickname,
        email: email?.length ? email : undefined,
        score: payload.score
      }),
      signal: options.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Offline — reconnect to submit your score.');
    }
    throw new Error('Unable to reach score service');
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    throw new Error('Score service returned an invalid response');
  }

  if (!response.ok) {
    const serverMessage = typeof body?.error === 'string' ? body.error : null;
    if (response.status === 400) {
      throw new Error(serverMessage ?? 'Please check your nickname and try again');
    }
    if (response.status === 503) {
      throw new Error(serverMessage ?? 'Score service is temporarily unavailable');
    }
    throw new Error(serverMessage ?? 'Failed to submit score');
  }

  return {
    placement: Number(body?.placement ?? 0),
    isoWeek: typeof body?.isoWeek === 'string' ? body.isoWeek : '',
      entry: {
        id: String(body?.entry?.id ?? ''),
        userId: typeof body?.entry?.userId === 'string' && body.entry.userId.length ? String(body.entry.userId) : null,
        nickname: String(body?.entry?.nickname ?? nickname),
        score: Number(body?.entry?.score ?? payload.score),
        isoWeek: typeof body?.entry?.isoWeek === 'string' ? body.entry.isoWeek : '',
        createdAt: typeof body?.entry?.createdAt === 'string' ? body.entry.createdAt : ''
      }
  };
}
