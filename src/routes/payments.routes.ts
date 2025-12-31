import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

const PAYMENT_METHODS = ['CREDIT_CARD', 'CASH', 'WALLET'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v);
}

/**
 * @openapi
 * /payments/pay:
 *   post:
 *     summary: Pay for an order (clear endpoint; order_id in body)
 *     description: order_id refers to orders.id
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, payment_method]
 *             properties:
 *               order_id: { type: integer }
 *               payment_method: { type: string, enum: [CREDIT_CARD, CASH, WALLET] }
 *     responses:
 *       201: { description: Created }
 */
router.post('/pay', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const { order_id, payment_method } = req.body ?? {};
  const user = (req as any).user as any;

  if (!order_id || !payment_method) {
    return res.status(400).json({ error: 'order_id and payment_method are required' });
  }

  if (!isPaymentMethod(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment_method', allowed: PAYMENT_METHODS });
  }

  try {
    const orderRes = await query('SELECT total_amount, customer_id FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (orderRes.rows[0].customer_id !== user.id) return res.status(403).json({ error: 'Forbidden' });

    const amount = orderRes.rows[0].total_amount;

    // Payment is created at order-time. Here we COMPLETE it.
    const existing = await query('SELECT id, status FROM payments WHERE order_id = $1', [order_id]);
    if (existing.rows.length === 0) {
      // Fallback (should not happen): create then complete
      const created = await query(
        `INSERT INTO payments (order_id, amount, payment_method, status)
         VALUES ($1, $2, $3, 'COMPLETED')
         RETURNING *`,
        [order_id, amount, payment_method]
      );
      return res.status(201).json(created.rows[0]);
    }

    if (existing.rows[0].status === 'COMPLETED') {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    const updated = await query(
      `UPDATE payments
       SET payment_method = $2,
           status = 'COMPLETED'
       WHERE order_id = $1
       RETURNING *`,
      [order_id, payment_method]
    );

    return res.status(200).json(updated.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /payments/by-order/{orderId}:
 *   get:
 *     summary: Get payment details by orderId
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/by-order/:orderId', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM payments WHERE order_id = $1', [req.params.orderId]);
    res.json(result.rows[0] || {});
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /payments/by-order/{orderId}/delete:
 *   delete:
 *     summary: Delete payment by orderId (ADMIN only)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/by-order/:orderId/delete', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM payments WHERE order_id = $1 RETURNING id', [req.params.orderId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    return res.json({ message: 'Payment deleted', id: result.rows[0].id });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

