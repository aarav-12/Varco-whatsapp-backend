/* eslint-disable no-undef */
function calculateVPNSS(answers, last7DaysScores = [], missedDays = 0) {
  const burning  = Math.min(Math.max(parseInt(answers.burning)  || 0, 0), 10);
  const tingling = Math.min(Math.max(parseInt(answers.tingling) || 0, 0), 10);
  const numbness = Math.min(Math.max(parseInt(answers.numbness) || 0, 0), 10);
  const walking  = Math.min(Math.max(parseInt(answers.walking)  || 0, 0), 4);
  const glucose  = Math.max(parseInt(answers.glucose) || 0, 0);
  const sleep    = Math.min(Math.max(parseInt(answers.sleep)    || 0, 0), 10);

  const woundRaw = answers.wound;
  const wound = woundRaw === true
    || woundRaw === 1
    || (typeof woundRaw === 'string' && ['yes','true'].includes(woundRaw.toLowerCase()));

  const swellingSide = (answers.swelling_side || '').toLowerCase();
  const swelling_unilateral = swellingSide === 'left' || swellingSide === 'right';

  const flags = [];

  // HARD OVERRIDE
  if (wound) {
    return {
      total: 100,
      tier: 'critical',
      trajectory: 'escalate',
      hardOverride: true,
      flags: ['wound_detected'],
      breakdown: {}
    };
  }

  const prev_numbness = last7DaysScores?.[0]?.numbness ?? 0;

  if (numbness - prev_numbness >= 4) {
    return {
      total: 75,
      tier: 'severe',
      trajectory: 'worsening',
      hardOverride: true,
      flags: ['numbness_spike'],
      breakdown: {}
    };
  }

  const prev_walking = last7DaysScores?.[0]?.walking ?? walking;
  if (walking === 0 && prev_walking >= 2) {
    flags.push('sudden_walking_loss');
  }

  if (missedDays >= 7) {
    flags.push('health_coach_escalation');
  }

  const base = burning + tingling + numbness;
  const function_score = (4 - walking) * 2 + (10 - sleep);
  const engagement_penalty = Math.min(missedDays * 2, 10);
  const glucose_bonus = glucose > 250 ? 5 : 0;

  const risk_mult = swelling_unilateral ? 1.3 : 1.0;

  const raw = (base + function_score + engagement_penalty + glucose_bonus) * risk_mult;
  const total = Math.min(Math.round(raw), 100);

  const tier =
    total <= 25 ? 'mild' :
    total <= 50 ? 'moderate' :
    total <= 74 ? 'severe' : 'critical';

  const avg7day = last7DaysScores?.length
    ? last7DaysScores.reduce((s, r) => s + (r.total_score || 0), 0) / last7DaysScores.length
    : total;

  const delta = total - avg7day;

  const trajectory =
    delta < -3 ? 'improving' :
    delta > 3 ? 'worsening' : 'stable';

  if (tier === 'critical' || tier === 'severe') {
    flags.push(`${tier}_active`);
  }

  return {
    total,
    tier,
    trajectory,
    hardOverride: false,
    flags,
    breakdown: {
      base,
      function_score,
      engagement_penalty,
      glucose_bonus,
      risk_mult,
      inputs: {
        burning, tingling, numbness, walking,
        glucose, sleep, wound, swelling_unilateral, missedDays
      }
    }
  };
}

module.exports = { calculateVPNSS };