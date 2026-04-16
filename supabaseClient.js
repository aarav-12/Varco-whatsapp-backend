/* eslint-disable no-undef */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[SUPABASE CONFIG] Missing SUPABASE_URL or SUPABASE key');
}

if (supabaseKey && supabaseKey.startsWith('sb_publishable_')) {
  console.warn('[SUPABASE CONFIG] Using publishable key. Server writes may fail with RLS. Set SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

module.exports = { supabase };