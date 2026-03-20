/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const axios = require('axios');

const generateMessage = async (score, answers) => {
  try {
    // 🔥 STEP 1: If no Claude key → use stub (today’s mode)
    if (!process.env.CLAUDE_API_KEY) {
      console.log("[AI MODE] Using STUB (no Claude API key)");

      return {
        text: `Test message:
Tier: ${score.tier}
Trajectory: ${score.trajectory}
Stay consistent with your care routine today.`,
        isFallback: true,
        error: null
      };
    }

    // 🔥 STEP 2: Real Claude call (future-ready)
    const prompt = `
You are a healthcare assistant.

Patient condition:
- Tier: ${score.tier}
- Trajectory: ${score.trajectory}
- Symptoms: ${JSON.stringify(answers)}

Give a short, supportive, actionable message.
`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    console.log("[CLAUDE SUCCESS]");

    return {
      text: response.data.content[0].text,
      isFallback: false,
      error: null
    };

  } catch (err) {
    console.error('[AI ERROR]', err.response?.data || err.message);

    return {
      text: 'Please take care today and follow your routine.',
      isFallback: true,
      error: err.response?.data || err.message
    };
  }
};

module.exports = { generateMessage };