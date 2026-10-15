import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * The project URL and publishable (anon) key are public by design: they ship
 * inside the app, and the database permission rules decide what anyone can do.
 * Defaults point at the development project; override them in `.env`.
 * Never put the secret / service_role key in the app.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://iwleoyjcvybjvrqpcalm.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bGVveWpjdnlianZycXBjYWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjc5NTIsImV4cCI6MjEwNzYwMzk1Mn0.hqLZndCVmLGW-JfZS0zCs91pMtD7SgDjrh0eWDK1dQ0';

const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
