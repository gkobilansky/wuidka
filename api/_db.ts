import { sql } from '@vercel/postgres';

const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;
const REQUIRED_DB_ENV_VARS = ['POSTGRES_URL'];
let schemaPromise: Promise<void> | null = null;

export const ISO_WEEK_KEY_LENGTH = 7 + 1; // e.g. 2025-W02

export class DatabaseConfigError extends Error {
  constructor(message = 'Postgres connection env vars are missing. Run `vercel env pull .env.local` and restart dev server.') {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

export function assertDatabaseConfig(): void {
  const missing = REQUIRED_DB_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new DatabaseConfigError();
  }
}

export async function ensureScoresTable(): Promise<void> {
  assertDatabaseConfig();
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;
      await sql`
        CREATE TABLE IF NOT EXISTS scores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nickname TEXT NOT NULL,
          email TEXT,
          score INTEGER NOT NULL CHECK (score >= 0),
          iso_week CHAR(8) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS scores_iso_week_score_idx
        ON scores (iso_week, score DESC, created_at ASC);
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export function getIsoWeekId(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((utc.getTime() - yearStart.getTime()) / 86400000);
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return `${utc.getUTCFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

export function normalizeIsoWeekParam(value?: string | string[]): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }
  return ISO_WEEK_PATTERN.test(candidate) ? candidate : null;
}
