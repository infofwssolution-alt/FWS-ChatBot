# Deployment & Operations Guide

## Hosting on Render or Railway

This Express.js backend can be deployed cleanly to Render (using `render.yaml`) or Railway as a long-running Node.js web service.

### 1. Build and Start Commands
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- The server dynamically listens on the port supplied in the `PORT` environment variable by Render/Railway (fallback to `3000` locally).

### 2. Startup Optimization: Model Warmup
The local sentence embedding model (`all-MiniLM-L6-v2`) is pre-warmed on server boot inside `src/index.js`. This guarantees that the first user interaction has near-zero latency and does not suffer a cold-start embedding lag.

### 3. Preventing Free-Tier Sleep & Latency
To prevent cloud hosting free-tier instances (such as Render) from spinning down during inactivity:
- Point an uptime monitoring service (such as BetterStack, UptimeRobot, or Cron-job.org) to ping `GET /health` every 5 to 10 minutes.
- The `/health` endpoint performs an active MongoDB ping (`{ ping: 1 }`), ensuring both the web process and database connections remain warm and responsive.

### 4. Required Environment Variables

Configure these in your Render or Railway dashboard under **Environment Variables**:

| Variable | Description |
| :--- | :--- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `GROQ_API_KEY` | Groq Cloud API key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins (e.g. `https://yourdomain.com,http://localhost:3000`) |
| `RATE_LIMIT_PER_HOUR` | Max allowed messages per session per hour (default: `20`) |
| `RATE_LIMIT_PER_IP_HOUR` | Max allowed requests per IP per hour (default: `60`) |
| `DAILY_CAP_PER_CLIENT` | Max global messages per client_id per day (default: `500`) |
| `ADMIN_TOKEN` | Secret Bearer token to protect `GET /admin/conversations` |
| `LEAD_WEBHOOK_URL` | *(Optional)* Outgoing webhook for real-time lead and booking capture |
| `GROQ_MODEL` | *(Optional)* LLM model (default: `openai/gpt-oss-120b`) |

---

## Widget Integration into Next.js Storefront

In your Next.js App Router root layout (`app/layout.tsx`):

```tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Embeddable AI Chat Widget */}
        <Script
          src="https://REPLACE_WITH_REAL_DEPLOYED_URL/widget/widget.js"
          data-api-url="https://REPLACE_WITH_REAL_DEPLOYED_URL"
          data-client-id="yourclient"
          data-title="Customer Support"
          data-color="#2563eb"
          data-greeting="Hi! How can we assist you today?"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

### Why `strategy="lazyOnload"`?
`lazyOnload` tells Next.js to inject and execute the chat widget script after all page critical resources have loaded during idle browser time. This guarantees that the widget never blocks First Contentful Paint (FCP) or Largest Contentful Paint (LCP) for your main storefront.