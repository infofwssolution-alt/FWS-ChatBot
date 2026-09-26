import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, closeDB } from './db/connect.js';
import { createOriginCheckMiddleware } from './middleware/originCheck.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';
import chatRouter from './routes/chat.js';

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
app.use('/widget', express.static(widgetDir));

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ============================================================================
// CHAT ENDPOINT PIPELINE
// Strict order:
// 1. Origin Check (rejects 403 before touching Redis or LLM)
// 2. Rate Limiting (rejects 429 if cap reached)
// 3. Chat Router (RAG retrieval -> Groq streaming -> DB logging)
// ============================================================================
const originCheck = createOriginCheckMiddleware();
const rateLimit = createRateLimitMiddleware();

app.use('/chat', originCheck, rateLimit, chatRouter);

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
    // Validate database connection on boot
    await connectDB();

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
    console.error('FATAL: Could not initialize database connection at startup:', error.message);
    process.exit(1);
  }
}

startServer();
