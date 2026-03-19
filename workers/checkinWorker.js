// /* eslint-disable no-undef */
// const { Worker } = require('bullmq');
// const { connection } = require('../queue/checkinQueue');
// const { processCheckin } = require('../services/checkinService');
// const { createClient } = require('@supabase/supabase-js');

// if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
//   throw new Error(
//     'Missing SUPABASE_URL or SUPABASE_KEY. Add them to your .env before starting the worker.'
//   );
// }

// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_KEY
// );

// const worker = new Worker(
//   'checkinQueue',
//   async (job) => {
//     const { phone, answers } = job.data;

//     console.log('[WORKER START]', phone);

//     await processCheckin(supabase, phone, answers);

//     console.log('[WORKER DONE]', phone);
//   },
//   {
//     connection,
//     attempts: 3, // retry
//     backoff: {
//       type: 'exponential',
//       delay: 5000
//     }
//   }
// );

// worker.on('failed', (job, err) => {
//   console.error('[JOB FAILED]', job.id, err.message);
// });

// module.exports = worker;