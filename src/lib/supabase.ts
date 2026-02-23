import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

/**
 * Server-side Supabase client using service role key (BFF pattern).
 * This client bypasses RLS and should only be used in API route handlers.
 * Lazy-initialized to allow the app to build without env vars set.
 */
export function getSupabaseClient(): SupabaseClient {
    if (_supabase) return _supabase;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
        );
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return _supabase;
}

// Convenience alias
export const supabase = new Proxy({} as SupabaseClient, {
    get(_, prop) {
        const client = getSupabaseClient();
        const key = prop as keyof SupabaseClient;
        const value = client[key];
        return typeof value === "function" ? value.bind(client) : value;
    },
});
