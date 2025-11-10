export interface UserContactPayload {
  email: string;
  nickname?: string;
}

export interface UserContactResponse {
  id: string;
  email: string;
  nickname: string | null;
}

export interface UserContactOptions {
  signal?: AbortSignal;
}

const USERS_ENDPOINT = '/api/users';

export async function submitUserContact(
  payload: UserContactPayload,
  options: UserContactOptions = {}
): Promise<UserContactResponse> {
  const email = payload.email?.trim();
  if (!email) {
    throw new Error('Email is required');
  }

  const nickname = payload.nickname?.trim();

  let response: Response;
  try {
    response = await fetch(USERS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        email,
        ...(nickname ? { nickname } : {})
      }),
      signal: options.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach signup service');
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    throw new Error('Signup service returned an invalid response');
  }

  if (!response.ok) {
    const serverMessage = typeof body?.error === 'string' ? body.error : null;
    if (response.status === 400) {
      throw new Error(serverMessage ?? 'Please double-check your email');
    }
    if (response.status === 503) {
      throw new Error(serverMessage ?? 'Signup service is temporarily unavailable');
    }
    throw new Error(serverMessage ?? 'Failed to save your info');
  }

  return {
    id: String(body?.id ?? ''),
    email: String(body?.email ?? email),
    nickname: typeof body?.nickname === 'string' && body.nickname.length ? String(body.nickname) : null
  };
}
