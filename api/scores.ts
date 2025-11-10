import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { DatabaseConfigError, ensureScoresTable, getIsoWeekId, normalizeEmail } from './_db.js';
import { JsonBodyParseError, readJsonBody, sendJson } from './_http.js';

const ScorePayloadSchema = z.object({
  nickname: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string()
      .min(2, 'Nickname must be at least 2 characters')
      .max(24, 'Nickname must be 24 characters or fewer')
  ),
  score: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int('Score must be an integer').min(0, 'Score cannot be negative').max(1_000_000_000, 'Score is unreasonably large')
  ),
  email: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    },
    z.string().email('Email must be valid').max(254, 'Email must be 254 characters or fewer')
  ).optional()
});

type ScorePayload = z.infer<typeof ScorePayloadSchema>;

interface DbUserRow {
  id: string;
  nickname: string | null;
}

async function ensureUserRecord(payload: ScorePayload): Promise<DbUserRow> {
  const normalizedEmail = normalizeEmail(payload.email);
  if (normalizedEmail) {
    const result = await sql<DbUserRow>`
      INSERT INTO users (email, nickname)
      VALUES (${normalizedEmail}, ${payload.nickname})
      ON CONFLICT (email)
      DO UPDATE SET
        nickname = COALESCE(EXCLUDED.nickname, users.nickname),
        updated_at = NOW()
      RETURNING id, nickname;
    `;
    return result.rows[0];
  }

  const userResult = await sql<DbUserRow>`
    INSERT INTO users (nickname)
    VALUES (${payload.nickname})
    RETURNING id, nickname;
  `;
  return userResult.rows[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let payload: ScorePayload;
  try {
    const rawBody = await readJsonBody(req);
    const parsed = ScorePayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendJson(res, 400, { error: issue?.message ?? 'Invalid payload' });
      return;
    }
    payload = parsed.data;
  } catch (error) {
    if (error instanceof JsonBodyParseError) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    console.error('Unexpected error parsing score payload', error);
    sendJson(res, 500, { error: 'Unexpected error' });
    return;
  }

  try {
    await ensureScoresTable();
    const isoWeek = getIsoWeekId();
    const user = await ensureUserRecord(payload);
    const normalizedEmail = normalizeEmail(payload.email);
    const result = await sql<{
      id: string;
      nickname: string;
      user_id: string | null;
      score: number;
      iso_week: string;
      created_at: string;
    }>`
      INSERT INTO scores (user_id, nickname, email, score, iso_week)
      VALUES (${user.id}, ${payload.nickname}, ${normalizedEmail ?? null}, ${payload.score}, ${isoWeek})
      RETURNING id, nickname, user_id, score, iso_week, created_at;
    `;

    const entry = result.rows[0];
    const placementResult = await sql<{ higher: number }>`
      SELECT COUNT(*)::int AS higher
      FROM scores
      WHERE iso_week = ${isoWeek} AND score > ${payload.score};
    `;

    const placement = (placementResult.rows[0]?.higher ?? 0) + 1;

    sendJson(res, 201, {
      placement,
      isoWeek,
      entry: {
        id: entry.id,
        nickname: entry.nickname,
        userId: entry.user_id,
        score: entry.score,
        isoWeek: entry.iso_week,
        createdAt: entry.created_at
      }
    });
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    console.error('Failed to store score', error);
    sendJson(res, 500, { error: 'Failed to store score' });
  }
}
