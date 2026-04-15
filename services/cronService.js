/* eslint-disable no-undef */
const cron = require('node-cron');
const { supabase } = require('../supabaseClient');
const { sendWhatsAppMessage } = require('./whatsappService');
const { normalizePhone } = require('../utils/phone');
const { runSLAMonitor } = require('./slaMonitor');

console.log('🚀 Cron service loaded');

// ✅ Single source of truth for date
function getTodayDateIST() {
  const now = new Date();
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  return ist.toISOString().split('T')[0];
}

// ─────────────────────────────
// 🌅 8AM — Morning Nudge
// ─────────────────────────────
async function runMorningNudge() {
  try {
    const today = getTodayDateIST();

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

      // ✅ FIXED CALL SIGNATURE
      await sendWhatsAppMessage(
        phone,
        'Good morning! Please fill your daily check-in form.'
      );

      await supabase.from('communication_logs').insert({
        patient_id: patient.id,
        type: 'morning_nudge',
        channel: 'whatsapp',
        status: 'sent'
      });
    }

    console.log('✅ 8AM cron completed');
  } catch (err) {
    console.error('8AM error:', err);
  }
}

// ─────────────────────────────
// 🔁 12PM — Follow-up
// ─────────────────────────────
async function runNoonFollowup() {
  try {
    const today = getTodayDateIST(); // ✅ FIXED

    const { data: logs } = await supabase
      .from('communication_logs')
      .select('patient_id')
      .eq('type', 'morning_nudge')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const patientIds = [...new Set((logs || []).map(l => l.patient_id))];

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

      // 👉 Uncomment when ready
      await sendWhatsAppMessage(
        phone,
        'Reminder: please complete your check-in today.'
      );

      await supabase.from('communication_logs').insert({
        patient_id: patientId,
        type: 'followup_nudge',
        channel: 'whatsapp',
        status: 'sent'
      });
    }

    console.log('✅ 12PM cron completed');
  } catch (err) {
    console.error('12PM error:', err);
  }
}

// ─────────────────────────────
// 🔴 7PM — Final Reminder
// ─────────────────────────────
async function runFinalReminder() {
  try {
    const today = getTodayDateIST(); // ✅ FIXED

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

      // 👉 Uncomment when ready
      await sendWhatsAppMessage(
        phone,
        'Final reminder: please complete your check-in today.'
      );

      await supabase.from('communication_logs').insert({
        patient_id: patient.id,
        type: 'final_reminder',
        channel: 'whatsapp',
        status: 'sent'
      });
    }

    console.log('✅ 7PM cron completed');
  } catch (err) {
    console.error('7PM error:', err);
  }
}

// ─────────────────────────────
// 🌙 11:55PM — Day Increment
// ─────────────────────────────
async function runEndOfDayUpdate() {
  try {
    console.log('🌙 11:55PM → Updating programme_day');

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, programme_day');

    if (error) {
      console.error('[EOD ERROR]', error);
      return;
    }

    const updates = patients.map(p => ({
      id: p.id,
      programme_day: (p.programme_day || 0) + 1
    }));

    const { error: updateError } = await supabase
      .from('patients')
      .upsert(updates);

    if (updateError) {
      console.error('[EOD ERROR]', updateError);
      return;
    }

    console.log('✅ programme_day updated for all patients');
  } catch (err) {
    console.error('[EOD ERROR]', err);
  }
}

// ─────────────────────────────
// ⏱️ CRON SCHEDULES
// ─────────────────────────────

// 8AM
cron.schedule('0 8 * * *', runMorningNudge, {
  timezone: "Asia/Kolkata"
});

// 12PM
cron.schedule('0 12 * * *', runNoonFollowup, {
  timezone: "Asia/Kolkata"
});

// 7PM
cron.schedule('0 19 * * *', runFinalReminder, {
  timezone: "Asia/Kolkata"
});

// SLA monitor (every 30 min)
cron.schedule('*/30 * * * *', async () => {
  console.log('🛡️ SLA MONITOR TRIGGERED');
  await runSLAMonitor(supabase);
});

// 11:55PM
cron.schedule('55 23 * * *', runEndOfDayUpdate);

module.exports = {
  runMorningNudge,
  runNoonFollowup,
  runFinalReminder,
  runEndOfDayUpdate
};