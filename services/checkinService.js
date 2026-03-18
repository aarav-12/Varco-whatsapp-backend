/* eslint-disable no-undef */

const { calculateVPNSS } = require('../utils/vpnss');
const { generateMessage } = require('./aiService');
const { sendWhatsAppMessage } = require('./whatsappService');

const processCheckin = async (supabase, patientId, answers) => {
  try {
    console.log('[PROCESS START]', patientId);

    const today = new Date().toISOString().split('T')[0];

    // ── GET LAST 7 DAYS ──
    const { data: last7 } = await supabase
      .from('daily_checkins')
      .select('numbness, walking')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(7);

    // ── GET LAST 14 DAYS FOR MISSED DAYS ──
    const { data: recent } = await supabase
      .from('daily_checkins')
      .select('date')
      .eq('patient_id', patientId)
      .gte(
        'date',
        new Date(Date.now() - 14 * 86400000)
          .toISOString()
          .split('T')[0]
      );

    const missedDays = Math.max(0, 14 - (recent?.length || 0));

    // ── CALCULATE VPNSS ──
    const score = calculateVPNSS(answers, last7 || [], missedDays);

    console.log('[VPNSS]', score);

    // ── GET TODAY'S CHECKIN ID ──
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('id')
      .eq('patient_id', patientId)
      .eq('date', today)
      .single();

    // ── SAVE VPNSS SCORE ──
    const { error: vpnssError } = await supabase
      .from('vpnss_scores')
      .upsert(
        {
          patient_id: patientId,
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
    } else {
      console.log('[VPNSS SAVED]');
    }

    // ── GET PATIENT PHONE ──
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('phone')
      .eq('id', patientId)
      .single();

    if (patientError || !patient?.phone) {
      console.error('[PATIENT FETCH ERROR]', patientError);
      return;
    }

    // ── GENERATE AI MESSAGE ──
    const aiResponse = await generateMessage(score, answers);

    // ── SEND WHATSAPP ──
    await sendWhatsAppMessage(patient.phone, aiResponse.text);

    // ── STORE MESSAGE ──
    const { error: msgError } = await supabase
      .from('coaching_messages')
      .insert({
        patient_id: patientId,
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