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

/* =====================================================
   🟢 8 AM MORNING NUDGE
===================================================== */
cron.schedule('*/2 * * * *', async () => {
  console.log('⏰ 8AM Nudge Cron Triggered');

  try {
    const today = getTodayDate();

    const { data: patients, error } = await supabase
      .from('patients')
      .select('*');

    if (error) {
      console.error('❌ Error fetching patients:', error);
      return;
    }

    for (const patient of patients) {
      const phone = normalizePhone(patient.phone);

      if (!phone) {
        console.log(`⚠️ Invalid phone: ${patient.id}`);
        continue;
      }

      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('date', today)
        .maybeSingle();

      if (checkin) continue;

      console.log(`📩 Morning Nudge → ${phone}`);

      // ⚠️ Enable after WhatsApp fix
      // await sendWhatsAppMessage({
      //   to: phone,
      //   message: 'Good morning! Please fill your daily check-in form.'
      // });

      // ✅ LOG NUDGE (CRITICAL)
      await supabase.from('communication_logs').insert({
        patient_id: patient.id,
        type: 'morning_nudge',
        channel: 'whatsapp',
        status: 'sent'
      });
    }

    console.log('✅ 8AM cycle complete\n');
  } catch (err) {
    console.error('🔥 8AM cron failed:', err);
  }
});


/* =====================================================
   🔵 12 PM FOLLOW-UP NUDGE (NON-RESPONDERS)
===================================================== */
cron.schedule('*/2 * * * *', async () => {
  console.log('⏰ 12PM Follow-up Cron Triggered');

  try {
    const today = getTodayDate();

    // 1. Get all patients who got morning nudge
    const { data: logs, error: logError } = await supabase
      .from('communication_logs')
      .select('patient_id')
      .eq('type', 'morning_nudge')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (logError) {
      console.error('❌ Error fetching logs:', logError);
      return;
    }

    const patientIds = [...new Set(logs.map(l => l.patient_id))];

    for (const patientId of patientIds) {
      // 2. Skip if already checked in
      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('patient_id', patientId)
        .eq('date', today)
        .maybeSingle();

      if (checkin) continue;

      // 3. Get patient phone
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      const phone = normalizePhone(patient?.phone);

      if (!phone) {
        console.log(`⚠️ Invalid phone for ${patientId}`);
        continue;
      }

      console.log(`🔁 Follow-up → ${phone}`);

      // ⚠️ Enable after WhatsApp fix
      // await sendWhatsAppMessage({
      //   to: phone,
      //   message: 'Reminder: please complete your check-in today.'
      // });

      // ✅ LOG FOLLOW-UP
      await supabase.from('communication_logs').insert({
        patient_id: patientId,
        type: 'followup_nudge',
        channel: 'whatsapp',
        status: 'sent'
      });
    }

    console.log('✅ 12PM cycle complete\n');
  } catch (err) {
    console.error('🔥 12PM cron failed:', err);
  }
});