/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
// const { calculateVPNSS } = require('./utils/vpnss');
const { processCheckin } = require('./services/checkinService');  
const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseConfig) {
  console.warn('SUPABASE_URL or SUPABASE_KEY is missing. Supabase routes will return configuration errors until these are set.');
}

const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null;

const ensureSupabaseConfigured = (res) => {
  if (supabase) return true;

  res.status(500).json({
    error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in your environment.'
  });
  return false;
};

app.get('/', (req, res) => {
  res.send('Varco backend is running!');
});

// ─── DEBUG ROUTE ───────────────────────────────────────────
app.post('/tally/debug', async (req, res) => {
  console.log('RAW TALLY DATA:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

// ─── HELPER — parses both text and option-based fields ─────
const parseFields = (fields) => {
  const getValue = (label) => {
    const field = fields.find(f => f.label === label);
    if (!field) return null;

    // If value is an array of option IDs, get the label instead
    if (Array.isArray(field.value)) {
      return field.value
        .map(v => {
          const opt = field.options?.find(o => o.id === v);
          return opt ? opt.text : v;
        })
        .join(', ');
    }

    // If value is a single option ID
    if (field.options && typeof field.value === 'string') {
      const opt = field.options.find(o => o.id === field.value);
      if (opt) return opt.text;
    }

    return field.value;
  };

  return getValue;
};

// ─── PATIENT HELPER ────────────────────────────────────────
const findOrCreatePatient = async (phone, condition) => {
  if (!supabase) return null;

  try {
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: newPatient, error: insertError } = await supabase
      .from('patients')
      .insert({ phone, condition })
      .select('id')
      .single();

    if (insertError) {
      console.error('Patient insert error:', insertError);
      return null;
    }

    return newPatient?.id;
  } catch (err) {
    console.error('findOrCreatePatient failed:', err);
    return null;
  }
};



// ─── NEUROPATHY FORM ───────────────────────────────────────
app.post('/tally/neuropathy', async (req, res) => {
  if (!ensureSupabaseConfigured(res)) return;

  try {
    const fields = req.body.data.fields;
    const getValue = parseFields(fields);

    // ── PARSE RAW INPUT ──
    const phone = getValue('Your phone number');

    const burning = parseInt(getValue('How much burning pain in your feet right now?')) || 0;
    const tingling = parseInt(getValue('Any tingling or pins and needles in your feet today?')) || 0;
    const numbness = parseInt(getValue('How numb do your feet feel right now?')) || 0;

    const glucose = parseInt(getValue('What was your glucose reading today?')) || 0;
    const sleep = parseInt(getValue('How well did you sleep last night?')) || 0;

    const toBool = (val) => val === 'Yes';

    const diafoot = toBool(getValue('Did you apply DiaFoot Cream this morning?'));
    const neurapan = toBool(getValue('Did you apply NeuraPan Oil this evening?'));
    const movement = toBool(getValue('Did you do movement today?'));

    const lumicalRaw = getValue('Did you do your Lumical session today?');
    const lumical_left = lumicalRaw === 'Left only' || lumicalRaw === 'Both';
    const lumical_right = lumicalRaw === 'Right only' || lumicalRaw === 'Both';

    const walkingRaw = getValue('How far can you walk comfortably today?');
    const walking =
      walkingRaw === '0 — Cannot walk' ? 0 :
      walkingRaw?.includes('Short') ? 1 : 2;

    const foot_check = getValue('Have you checked your feet today? Any cuts, blisters, redness or unusual warmth?');
    const wound = foot_check === 'Yes — I noticed something';

    const foot_notes = getValue('What did you notice? Which foot, where exactly, how big?');

    // ── CREATE ANSWERS OBJECT (FOR AI + SCORING) ──
    const answers = {
      burning,
      tingling,
      numbness,
      walking,
      glucose,
      sleep,
      diafoot,
      neurapan,
      lumical_left,
      lumical_right,
      movement,
      wound
    };

    // ── PATIENT ──
    const patientId = await findOrCreatePatient(phone, 'neuropathy');

    // ── STORE RAW CHECKIN ──
    const { error: checkinError } = await supabase
      .from('daily_checkins')
      .insert({
        patient_id: patientId,
        burning,
        tingling,
        numbness,
        walking,
        wound,
        wound_desc: foot_notes,
        glucose,
        sleep,
        diafoot,
        neurapan,
        lumical_left,
        lumical_right,
        movement
      })
      .select()
      .single();

    if (checkinError) throw checkinError;

    // ── RESPOND FAST (IMPORTANT) ──
    res.status(200).json({ success: true });

    // ── BACKGROUND PROCESSING ──
    setImmediate(() => processCheckin(supabase, patientId, answers));

  } catch (err) {
    console.error('Neuropathy route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── VARICOSE VEIN FORM ────────────────────────────────────
app.post('/tally/varicose', async (req, res) => {
  if (!ensureSupabaseConfigured(res)) return;

  try {
    const fields = req.body.data.fields;
    console.log('VARICOSE FIELDS:', JSON.stringify(fields, null, 2));

    const getValue = parseFields(fields);

    const phone = getValue('Your phone number');
    const swelling = getValue('Is there any swelling in your feet or ankles today?');
    const swelling_side = getValue('Which side?');
    const walking = getValue('How far can you walk comfortably today?');
    const sleep = parseInt(getValue('How well did you sleep last night? Did leg discomfort wake you?')) || 0;
    const lumical = getValue('Did you complete your Lumical session today?');
    const trend = getValue('Compared to yesterday, how do your legs feel?');

    console.log('PARSED VALUES:', { phone, swelling, swelling_side, walking, sleep, lumical, trend });

    const patientId = await findOrCreatePatient(phone, 'varicose');

    const alerts = [];
    const recommendations = [];

    if (swelling === 'Yes — one side only') alerts.push('DVT RED FLAG — unilateral swelling — immediate doctor referral required');
    if (swelling === 'Yes — both feet') recommendations.push('Elevate legs for 20 minutes today — avoid standing for long periods');
    else if (swelling === 'No swelling') recommendations.push('No swelling today — great sign, keep moving');
    if (lumical === 'Skipped') recommendations.push('Lumical session skipped — complete it today for best results');
    else if (lumical === 'Left only' || lumical === 'Right only') recommendations.push('Only one leg done for Lumical — complete the other leg today');
    if (trend === 'Worse') recommendations.push('Patient reports legs feeling worse than yesterday — review swelling and walking scores');
    else if (trend === 'Better') recommendations.push('Legs feeling better than yesterday — positive trend, reinforce routine');
    if (sleep <= 3) recommendations.push('Poor sleep — try elevating legs on a pillow tonight');
    else if (sleep <= 6) recommendations.push('Moderate sleep — compression socks during the day may help');
    if (walking === '0 — Cannot walk') recommendations.push('Rest today — do ankle rotation exercises while seated');

    const { error } = await supabase
      .from('varicose_checkin')
      .insert({
        patient_id: patientId,
        phone,
        swelling,
        swelling_side,
        walking_distance: walking,
        sleep_quality: sleep,
        lumical_session: lumical,
        trend_vs_yesterday: trend,
        alerts: alerts.join(' | '),
        recommendations: recommendations.join(' | ')
      });

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error });
    }

    res.status(200).json({ success: true, alerts, recommendations });
  } catch (err) {
    console.error('Varicose route error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/test', async (req, res) => {
  const fakeAnswers = {
    burning: 6,
    tingling: 5,
    numbness: 7,
    walking: 1,
    glucose: 180,
    sleep: 4,
    diafoot: false,
    neurapan: false,
    lumical_left: false,
    lumical_right: false,
    movement: false,
    wound: false
  };

 const { data: patient } = await supabase
  .from('patients')
  .select('id')
  .limit(1)
  .single();

const patientId = patient.id;

  await processCheckin(supabase, patientId, fakeAnswers);

  res.send('Test done');
});
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Varco backend running on port ${PORT}`));
