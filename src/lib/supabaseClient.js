import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://spxubsynpcupysnrmxuz.supabase.co";
const supabaseKey = "sb_publishable_Ag1bsaEl5QIaqEGnHp5tDA_Zs-XLmey";

export const supabase = createClient(supabaseUrl, supabaseKey);