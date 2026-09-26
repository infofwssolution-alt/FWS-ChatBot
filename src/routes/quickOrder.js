import { Router } from 'express';
import { getCollection } from '../db/connect.js';

const router = Router();

/**
 * POST /quick-order
 * Accepts an in-chat quick order request.
 * Payload: { name, phone, address, city, items, paymentMethod, session_id }
 */
router.post('/', async (req, res) => {
  const { name, phone, address, city, items, paymentMethod, session_id } = req.body || {};

  if (!name || !phone || !address || !items) {
    return res.status(400).json({ error: 'Name, phone number, address, and items are required.' });
  }

  try {
    const ordersCollection = await getCollection('quick_orders');
    const orderCode = 'NB-Q' + Math.floor(1000 + Math.random() * 9000);

    const orderDoc = {
      order_code: orderCode,
      name: String(name).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      city: String(city || 'Karachi').trim(),
      items: String(items).trim(),
      payment_method: paymentMethod || 'Cash on Delivery (COD)',
      session_id: session_id || null,
      status: 'pending_confirmation',
      created_at: new Date(),
    };

    const result = await ordersCollection.insertOne(orderDoc);

    const waText = encodeURIComponent(
      `Hi Notebloom! 🌸 I placed a quick order (#${orderCode}) via your chat assistant:\nName: ${name}\nPhone: ${phone}\nAddress: ${address}, ${city || 'Karachi'}\nItems: ${items}\nPayment: ${paymentMethod || 'Cash on Delivery (COD)'}`
    );
    const whatsappUrl = `https://wa.me/923373876846?text=${waText}`;

    return res.status(201).json({
      success: true,
      message: `Your order #${orderCode} has been recorded! We will confirm it via WhatsApp / phone shortly.`,
      orderCode,
      id: result.insertedId,
      whatsappUrl,
    });
  } catch (err) {
    console.error('[Quick Order Error]:', err);
    return res.status(500).json({ error: 'Failed to process quick order.' });
  }
});

export default router;
