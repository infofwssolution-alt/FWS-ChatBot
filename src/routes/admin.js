import { Router } from 'express';
import { getCollection } from '../db/connect.js';

const router = Router();

/**
 * GET /admin/conversations
 * Protected by Bearer token in Authorization header against ADMIN_TOKEN env var.
 * Query params:
 *   ?client_id=<id>
 *   ?limit=<n>
 *   ?since=<iso-date>
 *   ?format=csv | json (default json)
 */
router.get('/conversations', async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({ error: 'ADMIN_TOKEN is not configured on the server.' });
  }

  const authHeader = req.headers.authorization || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch ? tokenMatch[1].trim() : '';

  if (!token || token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin token.' });
  }

  const { client_id, limit, since, format } = req.query;

  const query = {};
  if (client_id && typeof client_id === 'string' && client_id.trim()) {
    query.client_id = client_id.trim();
  }

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      query.timestamp = { $gte: sinceDate };
    }
  }

  const maxLimit = Math.min(parseInt(limit || '50', 10), 500);

  try {
    const convCollection = await getCollection('conversations');
    const logs = await convCollection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(maxLimit)
      .toArray();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="conversations.csv"');

      const headers = ['id', 'client_id', 'session_id', 'timestamp', 'message', 'reply'];
      const rows = logs.map((log) => [
        `"${String(log._id || '')}"`,
        `"${String(log.client_id || 'default').replace(/"/g, '""')}"`,
        `"${String(log.session_id || '').replace(/"/g, '""')}"`,
        `"${log.timestamp ? new Date(log.timestamp).toISOString() : ''}"`,
        `"${String(log.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${String(log.reply || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      ]);

      return res.status(200).send([headers.join(','), ...rows.map((r) => r.join(','))].join('\n'));
    }

    return res.status(200).json({
      count: logs.length,
      conversations: logs,
    });
  } catch (err) {
    console.error('[Admin Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve conversation logs.' });
  }
});

export default router;
