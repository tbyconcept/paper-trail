import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to ' +
      '.env.local and fill in your Supabase project values (Project Settings → API). Auth/DB ' +
      'calls will fail until then, but the app still renders.',
  );
}

// createClient throws immediately on an empty URL, which would crash the
// whole app before .env.local is set up. Fall back to a syntactically
// valid placeholder so requests fail at call time (surfaced in each
// screen's own error state) instead of at import time.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // On web, Expo Router's static output does an initial Node-side
      // render pass with no `window`. Passing AsyncStorage there crashes
      // that pass (its web shim touches window.localStorage eagerly);
      // omitting `storage` lets supabase-js fall back to its own
      // isBrowser()-guarded default, which is SSR-safe.
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
