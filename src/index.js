import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, closeDB } from './db/connect.js';
import { generateEmbedding } from './rag/embeddings.js';
import { createOriginCheckMiddleware } from './middleware/originCheck.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';

import chatRouter from './routes/chat.js';
import leadRouter from './routes/lead.js';
import bookingRouter from './routes/booking.js';
import adminRouter from './routes/admin.js';
import appointmentsRouter from './routes/appointments.js';
import quickOrderRouter from './routes/quickOrder.js';

// Resolve directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// ENVIRONMENT VARIABLE VALIDATION (Crash early if any required variable is missing)
// ============================================================================
const REQUIRED_ENV_VARS = [
  'PORT',
  'MONGODB_URI',
  'GROQ_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ALLOWED_ORIGINS',
  'RATE_LIMIT_PER_HOUR',
  'ADMIN_TOKEN',
  'DAILY_CAP_PER_CLIENT',
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missingEnvVars.length > 0) {
  console.error('\n================================================================');
  console.error('FATAL ERROR: Missing required environment variables on startup:');
  missingEnvVars.forEach((v) => console.error(`  - ${v}`));
  console.error('Please configure these in your .env file before starting the server.');
  console.error('================================================================\n');
  process.exit(1);
}

// ============================================================================
// EXPRESS APP INITIALIZATION
// ============================================================================
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve widget files statically for testing & direct CDN-like delivery
const widgetDir = path.resolve(__dirname, '../widget');
app.use('/widget', express.static(widgetDir, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// ============================================================================
// HEALTH CHECK ENDPOINT
// Verifies HTTP server availability AND active MongoDB connectivity
// ============================================================================
app.get('/health', async (req, res) => {
  try {
    const db = await connectDB();
    await db.command({ ping: 1 });
    return res.status(200).json({
      status: 'ok',
      mongodb: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'degraded',
      mongodb: 'disconnected',
      error: err.message,
    });
  }
});

// ============================================================================
// PIPELINE MIDDLEWARE
// Strict order:
// 1. Origin Check (rejects 403 before touching Redis or LLM)
// 2. Rate Limiting (session + IP + client daily cap; rejects 429)
// ============================================================================
const originCheck = createOriginCheckMiddleware();
const rateLimit = createRateLimitMiddleware();

// Chatbot Core Routes
app.use('/chat', originCheck, rateLimit, chatRouter);
app.use('/lead', originCheck, rateLimit, leadRouter);
app.use('/booking', originCheck, rateLimit, bookingRouter);

// Backwards compatibility for legacy demo forms
app.use('/appointments', originCheck, rateLimit, appointmentsRouter);
app.use('/quick-order', originCheck, rateLimit, quickOrderRouter);

// Admin Routes (protected by Bearer ADMIN_TOKEN inside router)
app.use('/admin', adminRouter);

// 404 Catch-All
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ============================================================================
// SERVER STARTUP & GRACEFUL SHUTDOWN
// ============================================================================
async function startServer() {
  try {
    // 1. Validate database connection on boot
    try {
      await connectDB();
    } catch (dbErr) {
      console.warn('[Database] Initial connection attempt had warnings. Retrying on demand.');
    }

    // 2. Warm embedding model on boot so the first user message is not slow
    try {
      console.log('[Startup] Warming local embedding model...');
      await generateEmbedding('warmup text');
      console.log('[Startup] Embedding model warmed up and ready.');
    } catch (embErr) {
      console.warn('[Startup] Embedding warmup notice:', embErr.message);
    }

    const server = app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(` AI Chatbot Server running on http://localhost:${PORT}`);
      console.log(` Health check:  http://localhost:${PORT}/health`);
      console.log(` Demo Widget:   http://localhost:${PORT}/widget/demo.html`);
      console.log(`======================================================\n`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await closeDB();
        console.log('[Server] HTTP server and database connections closed cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('FATAL: Could not initialize server at startup:', error.message);
    process.exit(1);
  }
}

startServer();
