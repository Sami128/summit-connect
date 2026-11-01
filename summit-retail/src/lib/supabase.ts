import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './errors';

export function dataMode(): 'local' | 'supabase' {
  const driver = process.env.DATA_DRIVER;
  if (driver && driver !== 'local' && driver !== 'supabase') throw new ApiError(503, 'DATA_DRIVER must be local or supabase.');
  const configured = !!(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const mode: 'local' | 'supabase' = driver === 'supabase' || (!driver && configured) ? 'supabase' : 'local';
  if (mode === 'supabase' && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new ApiError(503, 'Shared storage is not fully configured. Ask your administrator to check the Supabase environment variables.');
  if (mode === 'local' && process.env.VERCEL) throw new ApiError(503, 'Vercel requires shared Supabase storage. Configure Supabase before deployment.');
  return mode;
}

export function createSupabase(): SupabaseClient {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ApiError(503, 'Supabase is not configured.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function checkDatabase(error: {message: string} | null, operation: string): void {
  if (error) {
    console.error(`[Supabase ${operation}]`, error.message);
    throw new ApiError(503, 'Shared data is unavailable. Your change was not saved. Please try again.');
  }
}
