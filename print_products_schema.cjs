const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_TEST_EMAIL;
const password = process.env.SUPABASE_TEST_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TEST_EMAIL, and SUPABASE_TEST_PASSWORD before running this diagnostic.",
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr) throw authErr;

  const { data, error } = await supabase.from("products").select("*").limit(1);
  if (error) throw error;

  console.log("Product columns:", Object.keys(data[0] || {}));
}

run().catch((error) => {
  console.error("Schema diagnostic failed:", error.message);
  process.exitCode = 1;
});
