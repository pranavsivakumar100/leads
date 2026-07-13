import { createClient } from "@supabase/supabase-js";

import { config } from "@/config";

/** Browser Supabase client (anon key) — used for auth only.
 *  Data access goes through the FastAPI backend. */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
