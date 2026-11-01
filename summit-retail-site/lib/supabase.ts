import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './errors';

export function dataMode(): 'd1' | 'supabase' {
  const driver = process.env.DATA_DRIVER;
  if (driver && driver !== 'd1' && driver !== 'supabase') throw new ApiError(503, 'This hosted application requires DATA_DRIVER=d1 or supabase. Local disk storage is not supported.');
  const configured = !!(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const mode = driver === 'supabase' || (!driver && configured) ? 'supabase' : 'd1';
  if (mode === 'supabase' && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new ApiError(503, 'Shared storage is not fully configured. Ask your administrator to check the Supabase environment variables.');
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
