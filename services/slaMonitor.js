/* eslint-disable no-undef */
const runSLAMonitor = async (supabase) => {
  console.log('[SLA MONITOR START]');

  const now = new Date();
  const past = new Date(now - 30 * 60 * 1000); // last 30 min

  // 1. get recent checkins
  const { data: checkins } = await supabase
    .from('daily_checkins')
    .select('*')
    .gte('created_at', past.toISOString());

  for (const checkin of checkins || []) {
    
    const start = new Date(checkin.created_at);
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    // 2. check score
    const { data: score } = await supabase
      .from('vpnss_scores')
      .select('id')
      .eq('patient_id', checkin.patient_id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .maybeSingle();

    // 3. check communication
    const { data: comm } = await supabase
      .from('communication_logs')
      .select('id')
      .eq('patient_id', checkin.patient_id)
      .in('type', ['coaching_message', 'call'])
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .maybeSingle();

    if (!score || !comm) {
      console.log('[SLA BREACH]', checkin.patient_id);

      // prevent duplicate
      const { data: existing } = await supabase
        .from('communication_logs')
        .select('id')
        .eq('patient_id', checkin.patient_id)
        .eq('type', 'sla_failure')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .maybeSingle();

      if (!existing) {
        await supabase.from('communication_logs').insert({
          patient_id: checkin.patient_id,
          type: 'sla_failure',
          channel: 'system',
          status: 'failed'
        });
      }
    }
  }

  console.log('[SLA MONITOR DONE]');
};

module.exports = { runSLAMonitor };