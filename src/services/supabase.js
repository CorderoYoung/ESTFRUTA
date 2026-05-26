import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  'https://vhteethimhqjnjnwtgya.supabase.co';

const supabaseAnonKey =
  'sb_publishable_EUBIkTYuZkRJxn-h3qzFpA_Hyc5I_rH';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);