/* eslint-disable no-undef */
const cron = require('node-cron');
const { supabase } = require('../supabaseClient');
const { sendWhatsAppMessage } = require('./whatsappService');
const { normalizePhone } = require('../utils/phone');

console.log('🚀 Cron service loaded');

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/* =========================
   8 AM MORNING NUDGE
========================= */
cron.schedule('*/2 * * * *', async () => {
  try {
    const today = getTodayDate();

    const { data: patients } = await supabase
      .from('patients')
      .select('*');

    for (const patient of patients) {
      const phone = normalizePhone(patient.phone);
      if (!phone) continue;

      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('date', today)
        .maybeSingle();

      if (checkin) continue;

      console.log(`📩 8AM → ${phone}`);

      // await sendWhatsAppMessage({
      //   to: phone,
      //   message: 'Good morning! Please fill your daily check-in form.'
      // });

      await supabase.from('communication_logs').insert({
        patient_id: patient.id,
        type: 'morning_nudge',
        channel: 'whatsapp',
        status: 'sent'
      });
    }
  } catch (err) {
    console.error('8AM error:', err);
  }
});


/* =========================
   12 PM FOLLOW-UP
========================= */
cron.schedule('*/2 * * * *', async () => {
  try {
    const today = getTodayDate();

    const { data: logs } = await supabase
      .from('communication_logs')
      .select('patient_id')
      .eq('type', 'morning_nudge')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const patientIds = [...new Set(logs.map(l => l.patient_id))];

    for (const patientId of patientIds) {
      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('patient_id', patientId)
        .eq('date', today)
        .maybeSingle();

      if (checkin) continue;

      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      const phone = normalizePhone(patient?.phone);
      if (!phone) continue;

      console.log(`🔁 12PM → ${phone}`);

      // await sendWhatsAppMessage({
      //   to: phone,
      //   message: 'Reminder: please complete your check-in today.'
      // });

      await supabase.from('communication_logs').insert({
        patient_id: patientId,
        type: 'followup_nudge',
        channel: 'whatsapp',
        status: 'sent'
      });
    }
  } catch (err) {
    console.error('12PM error:', err);
  }
});


/* =========================
   7 PM FINAL REMINDER
========================= */
cron.schedule('*/2 * * * *', async () => {
  try {
    const today = getTodayDate();

    const { data: patients } = await supabase
      .from('patients')
      .select('*');

    for (const patient of patients) {
      const phone = normalizePhone(patient.phone);
      if (!phone) continue;

      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('date', today)
        .maybeSingle();

      if (checkin) continue;

      console.log(`🔴 7PM → ${phone}`);

      // await sendWhatsAppMessage({
      //   to: phone,
      //   message: 'Final reminder: please complete your check-in today.'
      // });

      await supabase.from('communication_logs').insert({
        patient_id: patient.id,
        type: 'final_reminder',
        channel: 'whatsapp',
        status: 'sent'
      });
    }
  } catch (err) {
    console.error('7PM error:', err);
  }
});