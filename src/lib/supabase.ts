import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseUrl !== '';

if (!isConfigured) {
  console.error('❌ CONFIGURATION MANQUANTE : Les variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ne sont pas détectées.');
}

// Objet Dummy ultra-complet pour éviter TOUT crash au démarrage
const dummySupabase = {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
      eq: () => ({ 
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null })
      }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb)
    }),
    insert: () => ({ 
      select: () => ({ 
        single: () => Promise.resolve({ data: null, error: null }) 
      }) 
    }),
    update: () => ({ 
      eq: () => Promise.resolve({ data: null, error: null }) 
    }),
    delete: () => ({ 
      eq: () => Promise.resolve({ data: null, error: null }) 
    }),
    upsert: () => Promise.resolve({ error: null })
  }),
  channel: () => ({
    on: function() { return this; },
    subscribe: () => ({ unsubscribe: () => {} }),
    send: () => Promise.resolve()
  }),
  removeChannel: () => {},
  removeAllChannels: () => {},
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  }
} as any;

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : dummySupabase;
