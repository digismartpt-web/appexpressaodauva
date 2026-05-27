import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Simple .env parser
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSchema() {
  console.log('Inspecting settings table...');
  
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'global-settings').maybeSingle();
  
  if (error) {
    console.error('Error selecting from settings:', error);
    return;
  }
  
  if (data) {
    console.log('Columns in settings table:', Object.keys(data));
    console.log('Settings data:', JSON.stringify(data, null, 2));
  } else {
    console.log('No row found with ID global-settings. Checking first available row...');
    const { data: anyData, error: anyError } = await supabase.from('settings').select('*').limit(1);
    if (anyError) {
      console.error('Error selecting any row:', anyError);
    } else if (anyData && anyData.length > 0) {
      console.log('Columns in settings table:', Object.keys(anyData[0]));
      console.log('Sample data:', JSON.stringify(anyData[0], null, 2));
    } else {
      console.log('Table is empty.');
    }
  }
}

inspectSchema();
