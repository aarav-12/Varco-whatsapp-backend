/* eslint-disable no-undef */
const cron = require('node-cron');
const { supabase } = require('../supabaseClient');
const { sendWhatsAppMessage } = require('./whatsappService');
const { normalizePhone } = require('../utils/phone');

console.log('🚀 Cron service loaded');

// Helper: get today's date (YYYY-MM-DD)
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// TEMP: run every 2 minutes for testing
cron.schedule('*/2 * * * *', async () => {
  console.log('⏰ 8AM Nudge Cron Triggered');

  try {
    const today = getTodayDate();

    // 1. Fetch all patients
    const { data: patients, error: patientError } = await supabase
      .from('patients')
      .select('*');

    if (patientError) {
      console.error('❌ Error fetching patients:', patientError);
      return;
    }

    console.log(`👥 Total patients: ${patients.length}`);

    for (const patient of patients) {
      // Normalize phone
      const phone = normalizePhone(patient.phone);

      if (!phone) {
        console.log(`⚠️ Skipping invalid phone for patient ${patient.id}`);
        continue;
      }

      // 2. Check if patient has check-in today
      const { data: checkin, error: checkinError } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('date', today)
        .maybeSingle();

      if (checkinError) {
        console.error(`❌ Check-in error for ${patient.id}:`, checkinError);
        continue;
      }

      // 3. If NOT checked in → send nudge
      if (!checkin) {
        console.log(`📩 Nudge → ${phone}`);

        // ⚠️ TEMP DISABLE until token fixed
        // await sendWhatsAppMessage({
        //   to: phone,
        //   message: 'Good morning! Please fill your daily check-in form.'
        // });

      } else {
        console.log(`✅ Already checked in: ${phone}`);
      }
    }

    console.log('✅ Cron cycle complete\n');
  } catch (err) {
    console.error('🔥 Cron failed:', err);
  }
});