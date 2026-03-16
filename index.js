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
  try {
    const fields = req.body.data.fields;
    console.log('NEUROPATHY FIELDS:', JSON.stringify(fields, null, 2));

    const getValue = parseFields(fields);

    const phone = getValue('Your phone number');
    const burning = parseInt(getValue('How much burning pain in your feet right now?')) || 0;
    const tingling = parseInt(getValue('Any tingling or pins and needles in your feet today?')) || 0;
    const numbness = parseInt(getValue('How numb do your feet feel right now?')) || 0;
    const walking = getValue('How far can you walk comfortably today?');
    const foot_check = getValue('Have you checked your feet today? Any cuts, blisters, redness or unusual warmth?');
    const foot_notes = getValue('What did you notice? Which foot, where exactly, how big?');
    const glucose = parseInt(getValue('What was your glucose reading today?')) || 0;
    const sleep = parseInt(getValue('How well did you sleep last night?')) || 0;
    const diafoot = getValue('Did you apply DiaFoot Cream this morning?');
    const neurapan = getValue('Did you apply NeuraPan Oil this evening?');
    const lumical = getValue('Did you do your Lumical session today?');
    const movement = getValue('Did you do movement today?');
    const trend = getValue('Compared to yesterday, how do you feel overall?');

    console.log('PARSED VALUES:', { phone, burning, tingling, numbness, walking, foot_check, glucose, sleep, diafoot, neurapan, lumical, movement, trend });

    const patientId = await findOrCreatePatient(phone, 'neuropathy');

    const alerts = [];
    const recommendations = [];
    const severity = burning + tingling + numbness;

    if (foot_check === 'Yes — I noticed something') alerts.push('FOOT WOUND DETECTED — immediate coach alert required');
    if (glucose > 200) alerts.push('HIGH GLUCOSE — patient needs to contact doctor');

    if (severity >= 18) recommendations.push('HIGH symptom day — rest feet, elevate, use all 3 products today');
    else if (severity >= 10) recommendations.push('MODERATE symptoms — apply DiaFoot with extra care today');
    else recommendations.push('LOW symptoms — great day, keep up your routine');

    if (diafoot !== 'Yes' && burning > 5) recommendations.push('DiaFoot not applied and burning is high — apply it now');
    if (neurapan !== 'Yes' && sleep < 4) recommendations.push('NeuraPan not applied and sleep was poor — apply tonight before bed');
    if (lumical === 'Skipped' && numbness > 6) recommendations.push('Lumical skipped and numbness is high — complete session today');
    if (lumical === 'Left only' || lumical === 'Right only') recommendations.push('Only one leg done for Lumical — complete the other leg today');
    if (movement === 'No' && walking !== '0 — Cannot walk') recommendations.push('Movement session not done — even 10 minutes of walking helps today');
    if (trend === 'Worse') recommendations.push('Patient reports feeling worse than yesterday — review full symptom scores');
    else if (trend === 'Better') recommendations.push('Patient feeling better than yesterday — positive trend, reinforce routine');
    if (burning > 6) recommendations.push('Apply DiaFoot Cream to both feet tonight — focus on arch and heel');
    if (tingling > 6) recommendations.push('Apply NeuraPan Flex Oil before bed — massage upward from toes to ankle');
    if (numbness > 6) recommendations.push('Complete Lumical red light session — both legs 20 min each');
    if (sleep <= 3) recommendations.push('Poor sleep worsens neuropathy — try NeuraPan Oil before bed tonight');
    else if (sleep <= 6) recommendations.push('Try elevating feet 20 minutes before bed tonight');
    if (glucose === 0) recommendations.push('Remember to measure glucose tomorrow morning');
    else if (glucose > 140 && glucose <= 200) recommendations.push('Glucose slightly elevated — watch your diet today');
    if (walking === '0 — Cannot walk') recommendations.push('Rest today — do seated exercises only');

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
        diafoot_applied: diafoot,
        neurapan_applied: neurapan,
        lumical_session: lumical,
        movement_done: movement,
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
    console.error('Neuropathy route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── VARICOSE VEIN FORM ────────────────────────────────────
app.post('/tally/varicose', async (req, res) => {
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

app.listen(3000, () => console.log('Varco backend running on port 3000'));
