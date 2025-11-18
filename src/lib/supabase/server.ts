// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Create a single instance of the Supabase client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default supabaseAdmin;