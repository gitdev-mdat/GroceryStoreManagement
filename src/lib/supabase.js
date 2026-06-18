// src/lib/supabase.js
// =====================================================================
// Supabase client — singleton
// =====================================================================
// CÁCH DÙNG:
//   import { supabase } from '@/lib/supabase';
//   const { data, error } = await supabase.from('s2a').select('*');
//
// BIẾN MÔI TRƯỜNG (xem .env.example):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    '[supabase] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.\n' +
    'Sao chép .env.example → .env.local và điền giá trị.\n' +
    'App vẫn chạy bằng localStorage cho đến khi có config.'
  );
}

export const supabase = createClient(url || 'http://localhost', key || 'public-anon', {
  auth: {
    persistSession: true,        // lưu session vào localStorage
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
});

// Helper: kiểm tra online
export const isSupabaseConfigured = () => Boolean(url && key);
