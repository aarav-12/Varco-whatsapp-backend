const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get('/', (req, res) => {
  res.send('Varco backend is running!');
});

// ─── NEUROPATHY FORM ───────────────────────────────────────
app.post('/tally/neuropathy', async (req, res) => {
  const fields = req.body.data.fields;
  const getValue = (label) => {
    const field = fields.find(f => f.label === label);
    return field ? field.value : null;
  };

  const phone = getValue('Your phone number');
  const burning = parseInt(getValue('How much burning pain in your feet right now?')) || 0;
  const tingling = parseInt(getValue('Any tingling or pins and needles in your feet today?')) || 0;
  const numbness = parseInt(getValue('How numb do your feet feel right now?')) || 0;
  const walking = getValue('How far can you walk comfortably today?');
  const foot_check = getValue('Have you checked your feet today? Any cuts, blisters, redness or unusual warmth?');
  const foot_notes = getValue('What did you notice? Which foot, where exactly, how big?');
  const glucose = parseInt(getValue('What was your glucose reading today?')) || 0;
  const sleep = parseInt(getValue('How well did you sleep last night?')) || 0;

  // ── Find or create patient ──
  let patientId = null;
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('phone', phone)
    .single();

  if (existing) {
    patientId = existing.id;
  } else {
    const { data: newPatient } = await supabase
      .from('patients')
      .insert({ phone, condition: 'neuropathy' })
      .select('id')
      .single();
    patientId = newPatient?.id;
  }

  // ── Decision tree ──
  const alerts = [];
  const recommendations = [];
  const severity = burning + tingling + numbness;

  // Danger alerts
  if (foot_check === 'Yes — I noticed something') {
    alerts.push('FOOT WOUND DETECTED — immediate coach alert required');
  }
  if (glucose > 200) {
    alerts.push('HIGH GLUCOSE — patient needs to contact doctor');
  }

  // Severity scoring
  if (severity >= 18) {
    recommendations.push('HIGH symptom day — rest feet, elevate them, use all 3 products today');
  } else if (severity >= 10) {
    recommendations.push('MODERATE symptoms — apply DiaFoot with extra care today');
  } else {
    recommendations.push('LOW symptoms — great day, keep up your routine');
  }

  // Product recommendations
  if (burning > 6) recommendations.push('Apply DiaFoot Cream to both feet tonight — focus on arch and heel');
  if (tingling > 6) recommendations.push('Apply NeuraPan Flex Oil before bed — massage upward from toes to ankle');
  if (numbness > 6) recommendations.push('Complete Lumical red light session today — both legs 20 min each');

  // Sleep recommendation
  if (sleep <= 3) recommendations.push('Poor sleep worsens neuropathy — try NeuraPan Oil before bed tonight');
  else if (sleep <= 6) recommendations.push('Try elevating feet 20 minutes before bed tonight');

  // Glucose recommendation
  if (glucose === 0) recommendations.push('Remember to measure glucose tomorrow morning');
  else if (glucose > 140 && glucose <= 200) recommendations.push('Glucose slightly elevated — watch your diet today');

  // Walking recommendation
  if (walking === '0 — Cannot walk') recommendations.push('Rest today — do seated exercises only');
  else if (walking === '3 — 15 to 30 minutes' || walking === '4 — 30 minutes or more') {
    recommendations.push('Good mobility today — complete your movement session');
  }

  // ── Save to Supabase ──
  const { error } = await supabase
    .from('neuropathy_checkin')
    .insert({
      patient_id: patientId,
      phone,
      burning_pain: burning,
      tingling,
      numbness,
      severity_score: severity,
      walking_distance: walking,
      foot_check,
      foot_notes,
      glucose,
      sleep_quality: sleep,
      alerts: alerts.join(' | '),
      recommendations: recommendations.join(' | ')
    });

  if (error) return res.status(500).json({ error });
  res.status(200).json({ success: true, alerts, recommendations });
});

// ─── VARICOSE VEIN FORM ────────────────────────────────────
app.post('/tally/varicose', async (req, res) => {
  const fields = req.body.data.fields;
  const getValue = (label) => {
    const field = fields.find(f => f.label === label);
    return field ? field.value : null;
  };

  const phone = getValue('Your phone number');
  const swelling = getValue('Is there any swelling in your feet or ankles today?');
  const swelling_side = getValue('Which side?');
  const walking = getValue('How far can you walk comfortably today?');
  const sleep = parseInt(getValue('How well did you sleep last night? Did leg discomfort wake you?')) || 0;

  // ── Find or create patient ──
  let patientId = null;
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('phone', phone)
    .single();

  if (existing) {
    patientId = existing.id;
  } else {
    const { data: newPatient } = await supabase
      .from('patients')
      .insert({ phone, condition: 'varicose' })
      .select('id')
      .single();
    patientId = newPatient?.id;
  }

  // ── Decision tree ──
  const alerts = [];
  const recommendations = [];

  // Danger alert — DVT red flag
  if (swelling === 'Yes — one side only') {
    alerts.push('DVT RED FLAG — unilateral swelling — immediate doctor referral required');
  }

  // Swelling recommendations
  if (swelling === 'Yes — both feet') {
    recommendations.push('Elevate legs for 20 minutes today — avoid standing for long periods');
  } else if (swelling === 'No swelling') {
    recommendations.push('No swelling today — great sign, keep moving');
  }

  // Sleep recommendation
  if (sleep <= 3) recommendations.push('Poor sleep — try elevating legs on a pillow tonight');
  else if (sleep <= 6) recommendations.push('Moderate sleep — compression socks during the day may help');

  // Walking recommendation
  if (walking === '0 — Cannot walk') {
    recommendations.push('Rest today — do ankle rotation exercises while seated');
  } else if (walking === '3 — 15 to 30 minutes' || walking === '4 — 30 minutes or more') {
    recommendations.push('Good mobility — walking is the best thing for varicose veins, keep it up');
  }

  // ── Save to Supabase ──
  const { error } = await supabase
    .from('varicose_checkin')
    .insert({
      patient_id: patientId,
      phone,
      swelling,
      swelling_side,
      walking_distance: walking,
      sleep_quality: sleep,
      alerts: alerts.join(' | '),
      recommendations: recommendations.join(' | ')
    });

  if (error) return res.status(500).json({ error });
  res.status(200).json({ success: true, alerts, recommendations });
});

app.listen(3000, () => console.log('Varco backend running on port 3000'));
