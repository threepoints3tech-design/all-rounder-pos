const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wgorrkrfpbkxnufkilva.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb3Jya3JmcGJreG51ZmtpbHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDgwNTUsImV4cCI6MjA5OTIyNDA1NX0.d6om0OAnOoqjmJsLxlj8ZYt7-vgvttF7ius68NGiZ5g';

const email = 'threepoints3.tech@gmail.com';
const password = 'ThreePoint3.tech#/';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Logging in as Super Admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authErr) {
    console.error("Admin login failed:", authErr.message);
    return;
  }

  // Query information_schema
  console.log("Querying information_schema for products table column types...");
  const { data: cols, error: colsErr } = await supabase.rpc('get_table_columns_debug');
  
  if (colsErr) {
    // If no RPC exists, we can run a direct select query from information_schema via a trick?
    // Wait, the anon/authenticated client cannot query information_schema directly unless it is exposed.
    // Let's try to query information_schema using postgrest!
    const { data: infoCols, error: infoErr } = await supabase
      .from('products')
      .select('*')
      .limit(1);
    
    if (infoErr) {
      console.error("Error reading products:", infoErr);
    } else {
      console.log("Single product record columns:", Object.keys(infoCols[0] || {}));
    }
  } else {
    console.log("Columns:", cols);
  }
}

run();
