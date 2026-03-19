/* eslint-disable no-undef */
const normalizePhone = (phone) => {
  if (!phone) return null;

  // remove spaces, dashes, etc
  let p = phone.toString().replace(/\D/g, '');

  // Case 1: starts with 91 (India country code)
  if (p.startsWith('91') && p.length === 12) {
    return `+${p}`;
  }

  // Case 2: starts with 0 (local format)
  if (p.startsWith('0') && p.length === 11) {
    return `+91${p.slice(1)}`;
  }

  // Case 3: plain 10-digit number
  if (p.length === 10) {
    return `+91${p}`;
  }

  // fallback
  return `+${p}`;
};

module.exports = { normalizePhone };