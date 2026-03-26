/* eslint-disable no-undef */
// const sendWhatsAppMessage = async (phone, message) => {
//   console.log('[MOCK WHATSAPP]', phone, message);
// };

// module.exports = { sendWhatsAppMessage };
const axios = require('axios');

const sendWhatsAppMessage = async (to, message) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("[WHATSAPP API SUCCESS]", response.data);
    return response.data; // ✅ optional but clean

  } catch (error) {
    console.error(
      "[WHATSAPP API ERROR]",
      error.response?.data || error.message
    );

    throw error; // 🔥 CRITICAL FIX
  }
};

module.exports = { sendWhatsAppMessage };