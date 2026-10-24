import { Router } from 'express';
import { retrieveRelevantChunks } from '../rag/retrieve.js';
import { streamGroqReply } from '../rag/groq.js';
import { getCollection } from '../db/connect.js';

const router = Router();
const MAX_MESSAGE_LENGTH = 500;

/**
 * POST /chat
 * Accepts: { message: string, session_id: string, client_id?: string }
 * Responds: Server-Sent Events (SSE) stream of tokens
 */
router.post('/', async (req, res) => {
  const { message, session_id, client_id } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
  }

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'Field "session_id" is required.' });
  }

  const cleanMessage = message.trim();

  // Enforce Max Message Length (abuse and cost protection)
  if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Your message is a bit too long (${cleanMessage.length} characters). Please keep messages under ${MAX_MESSAGE_LENGTH} characters so I can best assist you.`,
    });
  }

  const clientId = (client_id && typeof client_id === 'string' && client_id.trim())
    ? client_id.trim()
    : 'default';

  let fullReply = '';
  let streamStarted = false;

  try {
    // 1. Fetch recent conversation history from MongoDB (last 6 turns for this session_id)
    const historyTurns = [];
    try {
      const convCollection = await getCollection('conversations');
      const recentLogs = await convCollection
        .find({ session_id })
        .sort({ timestamp: -1 })
        .limit(3) // 3 document pairs = 6 turns (user + assistant)
        .toArray();

      // Reverse so oldest of the recent comes first
      recentLogs.reverse().forEach((log) => {
        if (log.message) historyTurns.push({ role: 'user', content: log.message });
        if (log.reply) historyTurns.push({ role: 'assistant', content: log.reply });
      });
    } catch (histErr) {
      console.warn('[Chat History Warning] Could not retrieve history:', histErr.message);
    }

    // 2. Retrieve top 4 relevant chunks scoped strictly to clientId
    const relevantChunks = await retrieveRelevantChunks(cleanMessage, 4, clientId);

    // 3. Initiate Groq streaming completion with client system prompt and conversation history
    const groqStream = await streamGroqReply(cleanMessage, relevantChunks, clientId, historyTurns);

    // 4. Set SSE response headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    streamStarted = true;

    // Handle client disconnect
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    // 5. Stream tokens to client
    for await (const chunk of groqStream) {
      if (clientDisconnected) break;

      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullReply += token;
        res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
      }
    }

    // 6. Signal stream completion
    if (!clientDisconnected) {
      res.write('data: [DONE]\n\n');
      res.end();
    }

    // 7. Persist conversation turn with client_id to MongoDB
    try {
      const conversationsCollection = await getCollection('conversations');
      await conversationsCollection.insertOne({
        client_id: clientId,
        session_id,
        message: cleanMessage,
        reply: fullReply,
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error('[Chat Log Error] Failed to persist conversation log:', logErr.message);
    }

  } catch (error) {
    console.error('[Chat Handler Error]:', error);

    if (streamStarted) {
      res.write(`data: ${JSON.stringify({ error: 'An error occurred during generation.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json({
        error: 'Failed to process chat message.',
        details: error.message,
      });
    }
  }
});

export default router;
