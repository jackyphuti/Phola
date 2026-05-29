import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.invalid';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'public-anon-key';

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );