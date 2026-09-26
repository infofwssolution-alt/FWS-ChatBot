import { Router } from 'express';
import { retrieveRelevantChunks } from '../rag/retrieve.js';
import { streamGroqReply } from '../rag/groq.js';
import { getCollection } from '../db/connect.js';

const router = Router();

/**
 * POST /chat
 * Accepts: { message: string, session_id: string }
 * Responds: Server-Sent Events (SSE) stream of tokens
 */
router.post('/', async (req, res) => {
  const { message, session_id } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
  }

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'Field "session_id" is required.' });
  }

  const cleanMessage = message.trim();
  let fullReply = '';
  let streamStarted = false;

  try {
    // 1. Retrieve top 3 relevant chunks from MongoDB knowledge base
    const relevantChunks = await retrieveRelevantChunks(cleanMessage, 3);

    // 2. Initiate Groq streaming completion
    const groqStream = await streamGroqReply(cleanMessage, relevantChunks);

    // 3. Set SSE response headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable response buffering for proxy servers (e.g. Nginx)
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    streamStarted = true;

    // Handle premature client disconnection
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    // 4. Stream tokens to client
    for await (const chunk of groqStream) {
      if (clientDisconnected) break;

      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullReply += token;
        res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
      }
    }

    // 5. Signal stream completion
    if (!clientDisconnected) {
      res.write('data: [DONE]\n\n');
      res.end();
    }

    // 6. Asynchronously log conversation to MongoDB
    // Per requirement: (session_id, message, reply, timestamp) — no PII
    try {
      const conversationsCollection = await getCollection('conversations');
      await conversationsCollection.insertOne({
        session_id,
        message: cleanMessage,
        reply: fullReply,
        timestamp: new Date(),
      });
      console.log(`[Chat Log] Recorded exchange for session: ${session_id}`);
    } catch (logErr) {
      console.error('[Chat Log Error] Failed to persist conversation log:', logErr.message);
    }

  } catch (error) {
    console.error('[Chat Handler Error]:', error);

    if (streamStarted) {
      // If SSE stream already commenced, send error event before closing
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
