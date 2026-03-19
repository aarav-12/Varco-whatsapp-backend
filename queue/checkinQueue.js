/* eslint-disable no-undef */
// const { Queue } = require('bullmq');
// const IORedis = require('ioredis');

// if (!process.env.REDIS_URL) {
//   throw new Error('Missing REDIS_URL. Add it to your .env before starting API/worker.');
// }

// const connection = new IORedis(process.env.REDIS_URL, {
//   maxRetriesPerRequest: null
// });

// const checkinQueue = new Queue('checkinQueue', { connection });

// module.exports = { checkinQueue, connection };