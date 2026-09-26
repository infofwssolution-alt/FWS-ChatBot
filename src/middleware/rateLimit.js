import { Redis } from '@upstash/redis';

let redisClient = null;

/**
 * Lazy initialization of the Upstash Redis REST client.
 */
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
 * Creates the rate limiting middleware.
 * Keys request volume by `session_id` using a 1-hour (3600s) rolling window.
 */
export function createRateLimitMiddleware() {
  const maxLimit = parseInt(process.env.RATE_LIMIT_PER_HOUR || '20', 10);
  const WINDOW_SECONDS = 3600; // 1 hour rolling window

  return async function rateLimit(req, res, next) {
    const sessionId = req.body?.session_id;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required field: session_id is required in the request body.',
      });
    }

    try {
      const redis = getRedisClient();
      const rateLimitKey = `ratelimit:session:${sessionId}`;

      // Increment count atomically in Redis
      const count = await redis.incr(rateLimitKey);

      // If this is the first request in the window, set the expiration
      if (count === 1) {
        await redis.expire(rateLimitKey, WINDOW_SECONDS);
      }

      // Read TTL to set standard rate limit headers
      const ttl = await redis.ttl(rateLimitKey);
      res.setHeader('X-RateLimit-Limit', maxLimit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxLimit - count));
      res.setHeader('X-RateLimit-Reset', ttl > 0 ? ttl : WINDOW_SECONDS);

      // Check if threshold exceeded
      if (count > maxLimit) {
        return res.status(429).json({
          error: "You've reached the message limit, please try again later",
        });
      }

      next();
    } catch (error) {
      console.error('[RateLimit Error] Failed to evaluate rate limit with Redis:', error.message);
      // In production, we don't want a transient Redis network blip to take down all chat completely,
      // but we log heavily. If needed, can allow or fail-closed. Failing open here ensures availability.
      next();
    }
  };
}
