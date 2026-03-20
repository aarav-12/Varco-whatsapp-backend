/* eslint-disable no-undef */
const axios = require("axios");

const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function triggerVapiCall({ phone, message }) {
  try {
    console.log("[VAPI] Triggering call to:", phone);

    const response = await axios.post(
      "https://api.vapi.ai/call",
      {
        customer: {
          number: phone
        },
        assistant: {
          // you will get this from VAPI dashboard
          id: process.env.VAPI_ASSISTANT_ID
        },
        metadata: {
          message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("[VAPI SUCCESS]", response.data);
  } catch (err) {
    console.error("[VAPI ERROR]", err.response?.data || err.message);
  }
}
console.log("[VAPI KEY CHECK]", process.env.VAPI_API_KEY?.slice(0, 10));
console.log("[VAPI ASSISTANT ID CHECK]", process.env.VAPI_ASSISTANT_ID?.slice(0, 10));

module.exports = { triggerVapiCall };