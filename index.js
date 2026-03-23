/* eslint-disable no-undef */

const express = require('express');

require('dotenv').config();
const { processCheckin } = require('./services/checkinService');
const { sendWhatsAppMessage } = require('./services/whatsappService');

const app = express();
app.use(express.json());

// ─── ENV ───────────────────────────────────────────────
const { supabase } = require('./supabaseClient');

// ─── ROOT ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('Varco backend is running!');
});


// ======================================================
// 🔥 WHATSAPP WEBHOOK (NEW)
// ======================================================

// ── VERIFY WEBHOOK ──
app.get('/whatsapp/webhook', (req, res) => {
  const VERIFY_TOKEN = 'varco_verify_123'; // SAME as Meta

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('[WEBHOOK VERIFIED]');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ── RECEIVE MESSAGES ──
app.post('/whatsapp/webhook', async (req, res) => {
  try {
    console.log('[WHATSAPP INCOMING]', JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const { normalizePhone } = require('./utils/phone');

    const phone = normalizePhone(message.from); // 91XXXXXXXXXX
    const text = message.text?.body?.toLowerCase();

    console.log('[USER MESSAGE]', phone, text);

    if (!text) {
      return res.sendStatus(200);
    }

    if (
      text.includes('hi') ||
      text.includes('start') ||
      text.includes('check')
    ) {
      await sendWhatsAppMessage(
        phone,
        'Please fill your daily check-in form:\nhttps://tally.so/r/rjEPMM'
      );

      console.log('[FORM LINK SENT]');
      return res.sendStatus(200);
    }

    await sendWhatsAppMessage(
      phone,
      "Type 'start' to begin your daily check-in."
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error('[WHATSAPP ERROR]', err);
    res.sendStatus(500);
  }
});


// ======================================================
// 🧩 TALLY ROUTES (UNCHANGED CORE)
// ======================================================

const parseFields = (fields) => {
  const getValue = (label) => {
    const field = fields.find(f => f.label === label);
    if (!field) return null;

    if (Array.isArray(field.value)) {
      return field.value
        .map(v => {
          const opt = field.options?.find(o => o.id === v);
          return opt ? opt.text : v;
        })
        .join(', ');
    }

    if (field.options && typeof field.value === 'string') {
      const opt = field.options.find(o => o.id === field.value);
      if (opt) return opt.text;
    }

    return field.value;
  };

  return getValue;
};

const findOrCreatePatient = async (phone, condition) => {
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newPatient } = await supabase
    .from('patients')
    .insert({ phone, condition })
    .select('id')
    .single();

  return newPatient?.id;
};


// ── NEUROPATHY ──
app.post('/tally/neuropathy', async (req, res) => {
  try {
    const fields = req.body.data.fields;
    const getValue = parseFields(fields);

    const { normalizePhone } = require('./utils/phone');

const rawPhone = getValue('Your phone number');
const phone = normalizePhone(rawPhone);

    const answers = {
      burning: parseInt(getValue('How much burning pain in your feet right now?')) || 0,
      tingling: parseInt(getValue('Any tingling or pins and needles in your feet today?')) || 0,
      numbness: parseInt(getValue('How numb do your feet feel right now?')) || 0,
      walking: 2,
      glucose: parseInt(getValue('What was your glucose reading today?')) || 0,
      sleep: parseInt(getValue('How well did you sleep last night?')) || 0,
      diafoot: getValue('Did you apply DiaFoot Cream this morning?') === 'Yes',
      neurapan: getValue('Did you apply NeuraPan Oil this evening?') === 'Yes',
      lumical_left: false,
      lumical_right: false,
      movement: getValue('Did you do movement today?') === 'Yes',
      wound: getValue('Have you checked your feet today? Any cuts, blisters, redness or unusual warmth?') === 'Yes — I noticed something'
    };
console.log('[PHONE]', phone);
console.log('[ANSWERS]', answers);
    const patientId = await findOrCreatePatient(phone, 'neuropathy');
    console.log('[PATIENT ID]', patientId);

    const { data, error } = await supabase.from('daily_checkins').insert({
  patient_id: patientId,
  ...answers
});

if (error) {
  console.error('[CHECKIN INSERT ERROR]', error);
} else {
  console.log('[CHECKIN INSERT SUCCESS]', data);
}

    res.status(200).json({ success: true });

    // 🔥 IMPORTANT: pass phone (NOT patientId)
   await processCheckin(supabase, phone, answers);
  } catch (err) {
    console.error('Neuropathy error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─── TEST ROUTE ─────────────────────────────────────────
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

  await processCheckin(supabase, '+917087692944', fakeAnswers);

  res.send('Test done');
});


// ─── START SERVER ───────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`Varco backend running on port ${PORT}`);
});

// require('./workers/checkinWorker');
require('./services/cronService');