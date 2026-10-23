import { Router } from 'express';
import { getCollection } from '../db/connect.js';

const router = Router();

/**
 * Helper to optionally dispatch lead payload to LEAD_WEBHOOK_URL
 */
async function dispatchWebhook(eventType, payload) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });
    console.log(`[Webhook] Successfully dispatched ${eventType} to ${webhookUrl}`);
  } catch (err) {
    console.warn(`[Webhook Error] Failed to dispatch to ${webhookUrl}:`, err.message);
  }
}

/**
 * POST /lead
 * Collects escalation contact details when a human handoff is requested.
 * Payload: { name, contact, message, client_id, session_id }
 */
router.post('/', async (req, res) => {
  const { name, contact, message, client_id, session_id } = req.body || {};

  if (!name || !contact) {
    return res.status(400).json({ error: 'Name and contact info (phone/email) are required.' });
  }

  const clientId = (client_id && typeof client_id === 'string' && client_id.trim())
    ? client_id.trim()
    : 'default';

  try {
    const leadsCollection = await getCollection('leads');
    const leadDoc = {
      client_id: clientId,
      name: String(name).trim(),
      contact: String(contact).trim(),
      message: message ? String(message).trim() : '',
      session_id: session_id || null,
      status: 'new',
      created_at: new Date(),
    };

    const result = await leadsCollection.insertOne(leadDoc);

    // Forward to webhook asynchronously
    dispatchWebhook('lead.created', leadDoc);

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your contact details have been received. Our team will get in touch shortly.',
      id: result.insertedId,
    });
  } catch (err) {
    console.error('[Lead Error]:', err);
    return res.status(500).json({ error: 'Failed to record contact request.' });
  }
});

export default router;
