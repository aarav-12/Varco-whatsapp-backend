const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Neuropathy form webhook
app.post('/tally/neuropathy', async (req, res) => {
  const fields = req.body.data.fields;
  const getValue = (label) => {
    const field = fields.find(f => f.label === label);
    return field ? field.value : null;
  };

  const { error } = await supabase
    .from('neuropathy_checkin')
    .insert({
      phone: getValue('Your phone number'),
      burning_pain: getValue('How much burning pain in your feet right now?'),
      tingling: getValue('Any tingling or pins and needles in your feet today?'),
      numbness: getValue('How numb do your feet feel right now?'),
      walking_distance: getValue('How far can you walk comfortably today?'),
      foot_check: getValue('Have you checked your feet today? Any cuts, blisters, redness or unusual warmth?'),
      foot_notes: getValue('What did you notice? Which foot, where exactly, how big?'),
      glucose: getValue('What was your glucose reading today?'),
      sleep_quality: getValue('How well did you sleep last night?')
    });

  if (error) return res.status(500).json({ error });
  res.status(200).json({ success: true });
});

// Varicose vein form webhook
app.post('/tally/varicose', async (req, res) => {
  const fields = req.body.data.fields;
  const getValue = (label) => {
    const field = fields.find(f => f.label === label);
    return field ? field.value : null;
  };

  const { error } = await supabase
    .from('varicose_checkin')
    .insert({
      phone: getValue('Your phone number'),
      swelling: getValue('Is there any swelling in your feet or ankles today?'),
      swelling_side: getValue('Which side?'),
      walking_distance: getValue('How far can you walk comfortably today?'),
      sleep_quality: getValue('How well did you sleep last night? Did leg discomfort wake you?')
    });

  if (error) return res.status(500).json({ error });
  res.status(200).json({ success: true });
});

app.listen(3000, () => console.log('Varco backend running on port 3000'));
```

---

### File 3 — `README.md`
```
# Varco WhatsApp Backend
Webhook receiver for Tally forms → Supabase
