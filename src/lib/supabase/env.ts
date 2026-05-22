const LOCAL_DEFAULT_URL = 'http://127.0.0.1:54321';

const LOCAL_DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getSupabaseUrl(): string {
  return nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? LOCAL_DEFAULT_URL;
}

/** Publishable (sb_publishable_*) or legacy anon JWT from the Supabase dashboard. */
export function getSupabaseAnonKey(): string {
  return (
    nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    LOCAL_DEFAULT_ANON_KEY
  );
}

export function isLocalSupabase(): boolean {
  const url = getSupabaseUrl();
  return url.includes('127.0.0.1') || url.includes('localhost');
}
