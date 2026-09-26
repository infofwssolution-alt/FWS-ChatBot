import { Router } from 'express';
import { getCollection } from '../db/connect.js';

const router = Router();

/**
 * POST /appointments
 * Books an appointment / consultation for custom bulk sourcing or corporate orders.
 * Payload: { name, phone, email, date, message, session_id }
 */
router.post('/', async (req, res) => {
  const { name, phone, email, date, message, session_id } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and Phone / WhatsApp number are required.' });
  }

  try {
    const appointmentsCollection = await getCollection('appointments');
    const appointmentDoc = {
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : null,
      preferred_date: date ? String(date).trim() : null,
      message: message ? String(message).trim() : null,
      session_id: session_id || null,
      status: 'pending',
      created_at: new Date(),
    };

    const result = await appointmentsCollection.insertOne(appointmentDoc);

    // Create a pre-filled WhatsApp link to Notebloom's official number: 03373876846 (923373876846)
    const waText = encodeURIComponent(
      `Hi Notebloom! 🌸 I just submitted an appointment request on your website.\nName: ${name}\nPhone: ${phone}\nDate: ${date || 'Flexible'}\nTopic: ${message || 'Custom sourcing / Stationery inquiry'}`
    );
    const whatsappUrl = `https://wa.me/923373876846?text=${waText}`;

    return res.status(201).json({
      success: true,
      message: 'Appointment request received! Our team will contact you shortly.',
      id: result.insertedId,
      whatsappUrl,
    });
  } catch (err) {
    console.error('[Appointments Error]:', err);
    return res.status(500).json({ error: 'Failed to save appointment request.' });
  }
});

export default router;
