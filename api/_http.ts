import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface JsonErrorPayload {
  error: string;
}

export async function readJsonBody<T = unknown>(req: VercelRequest): Promise<T> {
  if (req.body) {
    if (typeof req.body === 'string') {
      return parseJson<T>(req.body);
    }
    if (Buffer.isBuffer(req.body)) {
      return parseJson<T>(req.body.toString('utf8'));
    }
    return req.body as T;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (!chunks.length) {
    return {} as T;
  }
  return parseJson<T>(Buffer.concat(chunks).toString('utf8'));
}

export function sendJson<ResponsePayload>(
  res: VercelResponse,
  statusCode: number,
  payload: ResponsePayload
): void {
  res.status(statusCode).json(payload);
}

function parseJson<T>(raw: string): T {
  try {
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch (error) {
    throw new JsonBodyParseError('Invalid JSON body');
  }
}

export class JsonBodyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonBodyParseError';
  }
}
