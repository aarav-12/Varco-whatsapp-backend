/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// // Takes a patient’s answers
//  Calculates a health score (VPNSS)
//  Decides how serious things are
//  Sends a WhatsApp message (always)
//  Calls the patient (if serious)
//  Saves everything in the database

// Basically:
// Input → Analyze → Decide → Act → Log
const { calculateVPNSS } = require('../utils/vpnss');
const { generateMessage } = require('./aiService');
const { sendWhatsAppMessage } = require('./whatsappService');
const { triggerVapiCall } = require('./vapiService');

const processCheckin = async (supabase, phone, answers) => {
  try {
    console.log('[PROCESS START]', phone);

    const today = new Date().toISOString().split('T')[0];

    // ── FIND OR CREATE PATIENT ──
    let patient;

    const { data: existingPatient } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', phone)
      .single();

    if (existingPatient) {
      patient = existingPatient;
      console.log('[PATIENT FOUND]', patient.id);
    } else {
      const { data: newPatient, error: createError } = await supabase
        .from('patients')
        .insert({
          phone: phone,
          name: 'Unknown'
        })
        .select()
        .single();

      if (createError) {
        console.error('[PATIENT CREATE ERROR]', createError);
        return;
      }

      patient = newPatient;
      console.log('[PATIENT CREATED]', patient.id);
    }

    // ── GET LAST 7 DAYS ──
    const { data: last7 } = await supabase
      .from('daily_checkins')
      .select('numbness, walking')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(7);

    // ── GET LAST 14 DAYS ──
    const { data: recent } = await supabase
      .from('daily_checkins')
      .select('date')
      .eq('patient_id', patient.id)
      .gte(
        'date',
        new Date(Date.now() - 14 * 86400000)
          .toISOString()
          .split('T')[0]
      );

    const missedDays = Math.max(0, 14 - (recent?.length || 0));

    // ── VPNSS ──
    const score = calculateVPNSS(answers, last7 || [], missedDays);
    console.log('[VPNSS]', score);

    // ── GET TODAY CHECKIN ──
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('date', today)
      .single();

    // ── SAVE VPNSS ──
    const { error: vpnssError } = await supabase
      .from('vpnss_scores')
      .upsert(
        {
          patient_id: patient.id,
          checkin_id: checkin?.id,
          date: today,
          base_score: score.breakdown?.base || 0,
          function_score: score.breakdown?.function_score || 0,
          engagement_penalty: score.breakdown?.engagement_penalty || 0,
          risk_multiplier: score.breakdown?.risk_mult || 1,
          total_score: score.total,
          tier: score.tier,
          trajectory: score.trajectory,
          hard_override: score.hardOverride,
          flags: score.flags,
          inputs: score.breakdown?.inputs || {}
        },
        { onConflict: 'patient_id,date' }
      );

    if (vpnssError) {
      console.error('[VPNSS SAVE ERROR]', vpnssError);
      return;
    }

    console.log('[VPNSS SAVED]');

    // ── AI MESSAGE ──
    const aiResponse = await generateMessage(score, answers);

    // ── ROUTING LOGIC ──
    const shouldCall =
      score.hardOverride ||
      ["severe", "critical"].includes(score.tier) ||
      score.trajectory === "worsening";

    console.log('[ROUTING]', shouldCall ? 'CALL + WHATSAPP' : 'WHATSAPP ONLY');

    // ── ACTIONS ──
   if (shouldCall) {
  let callStatus = 'sent';

  try {
    await triggerVapiCall({
      phone: patient.phone.startsWith('+')
        ? patient.phone
        : `+${patient.phone}`,
      message: aiResponse.text
    });
  } catch (err) {
    console.error('[CALL FAILED]', err);
    callStatus = 'failed';
  }

  await supabase.from('communication_logs').insert({
    patient_id: patient.id,
    type: 'call',
    channel: 'call',
    status: callStatus
  });
}

    // Always send WhatsApp (fallback + record)
   
    let messageStatus = 'sent';

try {
  await sendWhatsAppMessage(patient.phone, aiResponse.text);
} catch (err) {
  console.error('[WHATSAPP FAILED]');
  messageStatus = 'failed';
}

// 🔥 ADD THIS BLOCK
await supabase.from('communication_logs').insert({
  patient_id: patient.id,
  type: 'coaching_message',
  channel: 'whatsapp',
  status: messageStatus
});
console.log('[COMM LOG INSERTED]');
    // ── STORE MESSAGE ──
    const { error: msgError } = await supabase
      .from('coaching_messages')
      .insert({
        patient_id: patient.id,
        checkin_id: checkin?.id,
        message_text: aiResponse.text,
        tier: score.tier,
        trajectory: score.trajectory,
        is_fallback: aiResponse.isFallback,
        ai_error: aiResponse.error
      });

    if (msgError) {
      console.error('[MESSAGE SAVE ERROR]', msgError);
    } else {
      console.log('[MESSAGE STORED]');
    }

    console.log('[DONE]');
  } catch (err) {
    console.error('[PROCESS ERROR]', err);
  }
};

module.exports = { processCheckin };