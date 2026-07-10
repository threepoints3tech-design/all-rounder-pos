import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isValidUrl = (url: string): boolean => {
  return url.startsWith("http://") || url.startsWith("https://");
};

const isValidKey = (key: string): boolean => {
  return key.length > 0 && !key.includes("your-") && !key.includes("placeholder") && !key.includes("anon-public-key");
};

const isConfigured = isValidUrl(supabaseUrl) && isValidKey(supabaseAnonKey);

if (!isConfigured) {
  console.warn(
    "Supabase credentials missing or invalid. Falling back to local storage mode."
  );
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

