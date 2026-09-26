/**
 * ============================================================================
 * ORIGIN VALIDATION MIDDLEWARE
 * ============================================================================
 * 
 * WHY THIS CHECK MUST RUN FIRST (Before Rate Limiter & LLM Calls):
 * ----------------------------------------------------------------------------
 * 1. Attack & Financial Drain Prevention:
 *    The downstream services (Upstash Redis and Groq LLM) incur real resource 
 *    usage and potential financial costs per API call or token. If an unapproved 
 *    external site or attacker spams requests, letting those requests reach the 
 *    rate limiter or LLM burns Redis quota/credits and LLM tokens. Rejecting 
 *    at the origin check immediately drops unauthorized traffic with zero 
 *    downstream API consumption.
 * 
 * 2. DDoS & Resource Protection:
 *    A malicious actor could easily forge or randomize `session_id`s to bypass 
 *    rate limits. Checking and rejecting unauthorized origins at the very front 
 *    door prevents unnecessary database lookups, vector embedding computation, 
 *    and socket allocations.
 * 
 * 3. Strict Multi-Tenant Isolation & License Enforcement:
 *    Businesses deploying this chatbot widget pay for their specific domains. 
 *    Validating the origin ensures that unauthorized third-party websites 
 *    cannot hotlink the widget or siphon chatbot services on someone else's bill.
 * ============================================================================
 */

export function createOriginCheckMiddleware() {
  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
  
  // Parse comma-separated origins, trim whitespace, and discard empty entries.
  // No wildcard support as required.
  const allowedOrigins = rawAllowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  console.log(`[Security] Allowed origins configured:`, allowedOrigins);

  return function originCheck(req, res, next) {
    const origin = req.headers.origin || req.headers.referer;

    // Normalize origin: if it's a full referer URL, extract protocol + host
    let requestOrigin = null;
    if (origin) {
      try {
        const parsed = new URL(origin);
        requestOrigin = parsed.origin;
      } catch {
        requestOrigin = origin;
      }
    }

    // If no origin/referer header is supplied, or if it does not match allowed list
    if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
      return res.status(403).json({
        error: 'Forbidden: Access denied from this origin.',
        message: 'This chatbot service is restricted to authorized websites only.',
      });
    }

    // Set CORS headers for valid origins
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS requests immediately
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
}
