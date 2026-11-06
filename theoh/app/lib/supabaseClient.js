import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We use the service role key for API operations because we do not have user authentication logs,
// so we need bypass privileges on RLS to read/write order items and user wallet coin balances.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (typeof window === "undefined" && (!supabaseUrl || !supabaseServiceKey)) {
  console.error(
    "[supabaseClient] ERROR: Supabase credentials are missing.\n" +
    "Create a .env.local file in the project root with:\n" +
    "  NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>\n" +
    "Then restart the dev server."
  );
}

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
