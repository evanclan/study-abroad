import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseAnonKey, getSupabaseUrl, isLocalSupabase } from '@/lib/supabase/env';

const LOCAL_DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

export type Supabase = SupabaseClient<Database>;

let browserClient: Supabase | null = null;

function envOr(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) return fallback;
  return value;
}

/**
 * Browser-safe Supabase client (anon / publishable key). Singleton to avoid
 * leaking websocket subscriptions across hot reloads.
 */
export function getBrowserSupabase(): Supabase {
  if (browserClient) return browserClient;
  browserClient = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });
  return browserClient;
}

/**
 * Server-side Supabase client using the service-role key. ONLY import this
 * from server modules (route handlers / server actions / server components).
 */
export function getServerSupabase(): Supabase {
  const serviceRoleKey = envOr(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    isLocalSupabase() ? LOCAL_DEFAULT_SERVICE_ROLE_KEY : '',
  );

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for server-side database access when using a hosted Supabase project. Add it from Project Settings → API in the Supabase dashboard.',
    );
  }

  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'kaeru-support-ai/server' } },
  });
}
