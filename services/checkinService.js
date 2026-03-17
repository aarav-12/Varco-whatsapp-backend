/* eslint-disable no-undef */
const { calculateVPNSS } = require('../utils/vpnss');

const processCheckin = async (supabase, patientId, answers) => {
  try {
    console.log('[PROCESS START]', patientId);

    const today = new Date().toISOString().split('T')[0];

    // LAST 7 DAYS (RAW)
    const { data: last7 } = await supabase
      .from('daily_checkins')
      .select('numbness, walking')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(7);

    // MISSED DAYS
    const { data: recent } = await supabase
      .from('daily_checkins')
      .select('date')
      .eq('patient_id', patientId)
      .gte('date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]);

    const missedDays = Math.max(0, 14 - (recent?.length || 0));

    // VPNSS
    const score = calculateVPNSS(answers, last7 || [], missedDays);

    console.log('[VPNSS]', score);

    // GET TODAY CHECKIN
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('id')
      .eq('patient_id', patientId)
      .eq('date', today)
      .single();

    // SAVE SCORE
const { error } = await supabase.from('vpnss_scores').upsert({
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
}, { onConflict: 'patient_id,date' });

if (error) {
  console.error('[VPNSS SAVE ERROR]', error);
} else {
  console.log('[VPNSS SAVED]');
}

    console.log('[DONE]');
  } catch (err) {
    console.error('[PROCESS ERROR]', err);
  }
};

module.exports = { processCheckin };