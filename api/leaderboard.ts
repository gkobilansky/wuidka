import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { DatabaseConfigError, ensureScoresTable, getIsoWeekId, normalizeIsoWeekParam } from './_db.js';
import { sendJson } from './_http.js';

interface LeaderboardRow {
  nickname: string;
  score: number;
  created_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const requestedWeek = normalizeIsoWeekParam(req.query?.week);
  const isoWeek = requestedWeek ?? getIsoWeekId();

  try {
    await ensureScoresTable();

    const result = await sql<LeaderboardRow>`
      SELECT nickname, score, created_at
      FROM scores
      WHERE iso_week = ${isoWeek}
      ORDER BY score DESC, created_at ASC
      LIMIT 5;
    `;

    sendJson(res, 200, {
      isoWeek,
      entries: result.rows.map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        score: row.score,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    console.error('Failed to fetch leaderboard', error);
    sendJson(res, 500, { error: 'Failed to fetch leaderboard' });
  }
}
