/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const axios = require('axios');

const generateMessage = async (score, answers) => {
  try {
    const prompt = `...`; // your existing prompt

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