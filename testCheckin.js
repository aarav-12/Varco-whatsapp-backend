/* eslint-disable no-undef */

require('dotenv').config();
const { processCheckin } = require('./services/checkinService');
const { supabase } = require('./supabaseClient');

async function runTest(phone, answers) {
  await processCheckin(supabase, phone, answers);
}

// 👇 change test cases here
runTest("+917087692944", {
  burning: 2,
  tingling: 2,
  numbness: 1,
  walking: 4,
  glucose: 120,
  sleep: 8,
  wound: false,
  swelling_side: null
});