import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpsert() {
  console.log('Testing upsert with cutoff_minutes_before_closing...');
  
  const testData = {
    id: 'global-settings',
    cutoff_minutes_before_closing: 45
  };
  
  const { error } = await supabase.from('settings').upsert(testData);
  
  if (error) {
    console.error('❌ Upsert failed as expected:', error.message);
    console.error('Error code:', error.code);
  } else {
    console.log('✅ Upsert unexpectedly succeeded!');
  }
}

testUpsert();
