import 'dotenv/config';
import { Redis } from '@upstash/redis';
import { getCollection, closeDB } from './db/connect.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let clientId = null;

  for (const arg of args) {
    if (arg.startsWith('--client=')) {
      clientId = arg.split('=')[1].trim();
    }
  }

  return { clientId };
}

async function reset() {
  const { clientId } = parseArgs();

  if (!clientId) {
    console.error('ERROR: You must specify a client_id via --client=<id>');
    console.error('Example: npm run reset -- --client=demo-brand');
    process.exit(1);
  }

  console.log('====================================================');
  console.log(`RESETTING DATA FOR CLIENT: [${clientId}]`);
  console.log('====================================================');

  try {
    // 1. Delete knowledge base documents for this client
    const kbCol = await getCollection('knowledge_base');
    const kbRes = await kbCol.deleteMany({ client_id: clientId });
    console.log(`[Reset] Deleted ${kbRes.deletedCount} knowledge_base documents for client "${clientId}".`);

    // 2. Delete conversations for this client
    const convCol = await getCollection('conversations');
    const convRes = await convCol.deleteMany({ client_id: clientId });
    console.log(`[Reset] Deleted ${convRes.deletedCount} conversation log documents for client "${clientId}".`);

    // 3. Clear Redis rate-limit and daily cap keys for this client
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        // Scan and delete keys matching ratelimit:*client:<client_id>* and daily:*<client_id>*
        const pattern = `*${clientId}*`;
        const keys = await redis.keys(pattern);
        if (keys && keys.length > 0) {
          for (const key of keys) {
            await redis.del(key);
          }
          console.log(`[Reset] Flushed ${keys.length} Redis keys matching pattern "*${clientId}*".`);
        } else {
          console.log(`[Reset] No Redis keys found matching pattern "*${clientId}*".`);
        }
      } catch (redisErr) {
        console.warn('[Reset] Notice: Redis cleanup skipped or returned an error:', redisErr.message);
      }
    }

    console.log('====================================================');
    console.log(`Reset completed for client "${clientId}".`);
    console.log('====================================================');
  } catch (err) {
    console.error('[Reset Error]:', err.message);
    process.exit(1);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

reset();
