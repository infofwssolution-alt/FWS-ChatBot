import { Router } from 'express';
import { getCollection } from '../db/connect.js';

const router = Router();

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
  } catch (err) {
    console.warn(`[Webhook Error] Failed to dispatch ${eventType}:`, err.message);
  }
}

/**
 * POST /booking
 * Records appointment / consultation booking request.
 * Payload: { name, contact, service, preferred_time, notes, client_id, session_id }
 */
router.post('/', async (req, res) => {
  const { name, contact, phone, email, service, preferred_time, date, message, notes, client_id, session_id } = req.body || {};

  const cleanName = name ? String(name).trim() : '';
  const cleanContact = (contact || phone || email || '').trim();

  if (!cleanName || !cleanContact) {
    return res.status(400).json({ error: 'Name and contact info (phone or email) are required.' });
  }

  const clientId = (client_id && typeof client_id === 'string' && client_id.trim())
    ? client_id.trim()
    : 'default';

  try {
    const bookingsCollection = await getCollection('bookings');
    const bookingDoc = {
      client_id: clientId,
      name: cleanName,
      contact: cleanContact,
      service: (service || 'Consultation').trim(),
      preferred_time: (preferred_time || date || 'Flexible').trim(),
      notes: (notes || message || '').trim(),
      session_id: session_id || null,
      status: 'pending_confirmation',
      created_at: new Date(),
    };

    const result = await bookingsCollection.insertOne(bookingDoc);

    // Forward to webhook asynchronously
    dispatchWebhook('booking.created', bookingDoc);

    return res.status(201).json({
      success: true,
      message: 'Booking request recorded! Please note this is not yet confirmed; our team will contact you directly to confirm your time slot.',
      id: result.insertedId,
    });
  } catch (err) {
    console.error('[Booking Error]:', err);
    return res.status(500).json({ error: 'Failed to record booking request.' });
  }
});

export default router;
