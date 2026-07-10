const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking Supabase connection to:", supabaseUrl);
  
  // 1. Fetch profiles to see if the user exists
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*');

  if (pError) {
    console.error("Error fetching profiles:", pError);
  } else {
    console.log("Profiles found in DB:");
    console.log(JSON.stringify(profiles, null, 2));
  }

  // 2. Fetch tenants to see if there are any
  const { data: tenants, error: tError } = await supabase
    .from('tenants')
    .select('*');

  if (tError) {
    console.error("Error fetching tenants:", tError);
  } else {
    console.log("Tenants found in DB:");
    console.log(JSON.stringify(tenants, null, 2));
  }
}

check();
