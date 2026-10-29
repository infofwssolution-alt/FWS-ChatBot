import { Redis } from '@upstash/redis';

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('FATAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be defined.');
    }

    redisClient = new Redis({
      url,
      token,
    });
  }
  return redisClient;
}

/**
 * Multi-layer rate limiter:
 * 1. Session-based limit (RATE_LIMIT_PER_HOUR, default 20/hr)
 * 2. IP-based limit (60 requests per hour per IP)
 * 3. Daily global message cap per client_id (DAILY_CAP_PER_CLIENT, default 500/day)
 */
export function createRateLimitMiddleware() {
  const sessionLimit = parseInt(process.env.RATE_LIMIT_PER_HOUR || '20', 10);
  const ipLimit = parseInt(process.env.RATE_LIMIT_PER_IP_HOUR || '60', 10);
  const dailyClientCap = parseInt(process.env.DAILY_CAP_PER_CLIENT || '500', 10);

  const WINDOW_SECONDS = 3600; // 1 hour rolling window
  const DAY_SECONDS = 86400; // 24 hour rolling window

  return async function rateLimit(req, res, next) {
    const sessionId = req.body?.session_id;
    const clientId = (req.body?.client_id || 'default').trim();

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required field: session_id is required in the request body.',
      });
    }

    // Determine client IP safely (support proxies like Render, Cloudflare)
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1';

    try {
      const redis = getRedisClient();

      const prefix = process.env.REDIS_KEY_PREFIX || '';

      // 1. Session Rate Limit Key
      const sessionKey = `${prefix}ratelimit:session:${sessionId}`;
      const sessionCount = await redis.incr(sessionKey);
      if (sessionCount === 1) {
        await redis.expire(sessionKey, WINDOW_SECONDS);
      }

      // Check session limit
      if (sessionCount > sessionLimit) {
        const ttl = await redis.ttl(sessionKey);
        res.setHeader('X-RateLimit-Limit', sessionLimit);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', ttl > 0 ? ttl : WINDOW_SECONDS);
        return res.status(429).json({
          error: "You've reached the message limit for this session, please try again later.",
        });
      }

      // 2. IP Rate Limit Key
      const cleanIp = clientIp.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const ipKey = `${prefix}ratelimit:ip:${cleanIp}`;
      const ipCount = await redis.incr(ipKey);
      if (ipCount === 1) {
        await redis.expire(ipKey, WINDOW_SECONDS);
      }

      // Check IP limit
      if (ipCount > ipLimit) {
        return res.status(429).json({
          error: "Too many requests from your IP address. Please slow down and try again later.",
        });
      }

      // 3. Daily Client Global Cap
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const clientDailyKey = `${prefix}ratelimit:daily:${clientId}:${today}`;
      const clientCount = await redis.incr(clientDailyKey);
      if (clientCount === 1) {
        await redis.expire(clientDailyKey, DAY_SECONDS);
      }

      // Check daily client cap
      if (clientCount > dailyClientCap) {
        return res.status(429).json({
          error: "This demo assistant has reached its daily quota limit. Please try again tomorrow.",
        });
      }

      const ttl = await redis.ttl(sessionKey);
      res.setHeader('X-RateLimit-Limit', sessionLimit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, sessionLimit - sessionCount));
      res.setHeader('X-RateLimit-Reset', ttl > 0 ? ttl : WINDOW_SECONDS);

      next();
    } catch (error) {
      console.error('[RateLimit Error] Redis unreachable or threw error:', error.message);
      // In production, fallback open so transient network issues don't take down demo completely
      next();
    }
  };
}
