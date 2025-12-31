import { Router, Request, Response } from 'express';
import { query, getClient } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

const PAYMENT_METHODS = ['CREDIT_CARD', 'CASH', 'WALLET'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v);
}

const ORDER_STATUSES = ['CREATED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v);
}

/**
 * @openapi
 * /orders/add:
 *   post:
 *     summary: Create order (CUSTOMER)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurant_id, address_id, items, payment_method]
 *             properties:
 *               restaurant_id: { type: integer }
 *               address_id: { type: integer }
 *               payment_method: { type: string, enum: [CREDIT_CARD, CASH, WALLET] }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [menu_item_id, quantity]
 *                   properties:
 *                     menu_item_id: { type: integer }
 *                     quantity: { type: integer }
 *     responses:
 *       201: { description: Created }
 */
router.post('/add', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const { restaurant_id, address_id, items, payment_method } = req.body;
  const user = (req as any).user as any;
  const customerId = user.id;

  if (!restaurant_id || !address_id || !items || !items.length) {
    return res.status(400).json({ error: 'Missing order details' });
  }

  if (!isPaymentMethod(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment_method', allowed: PAYMENT_METHODS });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Ensure address belongs to current customer
    const addrRes = await client.query('SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2', [
      address_id,
      customerId,
    ]);
    if (addrRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid address_id (not found or not yours)' });
    }

    const orderRes = await client.query(
      'INSERT INTO orders (customer_id, restaurant_id, address_id, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [customerId, restaurant_id, address_id, 'CREATED']
    );
    const orderId = orderRes.rows[0].id;

    let totalAmount = 0;
    for (const item of items) {
      const { menu_item_id, quantity } = item;
      if (!menu_item_id || !quantity || quantity <= 0) {
        throw new Error('Each item must include menu_item_id and quantity > 0');
      }
      const priceRes = await client.query('SELECT price FROM menu_items WHERE id = $1 AND restaurant_id = $2', [
        menu_item_id,
        restaurant_id,
      ]);
      if (priceRes.rows.length === 0) throw new Error(`Menu item ${menu_item_id} not found or not in this restaurant`);
      const unitPrice = priceRes.rows[0].price;
      totalAmount += unitPrice * quantity;
      await client.query('INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', [
        orderId,
        menu_item_id,
        quantity,
        unitPrice,
      ]);
    }
    // Instant demo: mark order as DELIVERED immediately
    await client.query('UPDATE orders SET total_amount = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [
      totalAmount,
      'DELIVERED',
      orderId,
    ]);

    // Auto assign an available courier:
    // A courier is "available" only if they have NO assignments with status ASSIGNED or PICKED_UP.
    const courierRes = await client.query(
      `SELECT u.id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'COURIER'
         AND NOT EXISTS (
           SELECT 1 FROM courier_assignments ca
           WHERE ca.courier_id = u.id
             AND ca.status IN ('ASSIGNED','PICKED_UP')
         )
       ORDER BY u.id ASC
       LIMIT 1`
    );

    if (courierRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No courier available' });
    }

    const courierId = courierRes.rows[0].id;
    // Instant demo: create courier assignment as DELIVERED immediately
    await client.query(
      `INSERT INTO courier_assignments (order_id, courier_id, status, delivered_at)
       VALUES ($1, $2, 'DELIVERED', CURRENT_TIMESTAMP)`,
      [orderId, courierId]
    );

    // Instant demo: create payment as COMPLETED immediately
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, status)
       VALUES ($1, $2, $3, 'COMPLETED')
       ON CONFLICT (order_id) DO UPDATE SET amount = EXCLUDED.amount, payment_method = EXCLUDED.payment_method, status = 'COMPLETED'
       RETURNING *`,
      [orderId, totalAmount, payment_method]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Order created successfully', orderId, totalAmount, courierId, status: 'DELIVERED', payment_status: 'COMPLETED' });
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: e?.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /orders/me:
 *   get:
 *     summary: Get order history for current user
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as any;
    const result = await query(
      `SELECT 
          o.*,
          r.name as restaurant_name,
          rt.id as rating_id,
          rt.score as rating_score,
          rt.comment as rating_comment
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN ratings rt ON rt.order_id = o.id
       WHERE o.customer_id = $1
       ORDER BY o.created_at DESC`,
      [user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /orders/{id}/cancel:
 *   put:
 *     summary: Cancel my order (CUSTOMER only)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.put('/:id/cancel', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const orderId = req.params.id;
  const user = (req as any).user as any;
  try {
    const check = await query('SELECT id, status FROM orders WHERE id = $1 AND customer_id = $2', [orderId, user.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (check.rows[0].status === 'DELIVERED') return res.status(400).json({ error: 'Cannot cancel delivered order' });

    const result = await query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND customer_id = $3 RETURNING *',
      ['CANCELLED', orderId, user.id]
    );
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /orders/{id}/update-status:
 *   put:
 *     summary: Update order status (restaurant owner/admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.put('/:id/update-status', requireAuth, async (req: Request, res: Response) => {
  const { status } = req.body;
  const orderId = req.params.id;
  const user = (req as any).user as any;
  const userId = user.id;
  const isAdmin = user.roles.includes('ADMIN');

  if (!isOrderStatus(status)) {
    return res.status(400).json({ error: 'Invalid status', allowed: ORDER_STATUSES });
  }

  try {
    const checkRes = await query(
      'SELECT r.owner_id FROM orders o JOIN restaurants r ON o.restaurant_id = r.id WHERE o.id = $1',
      [orderId]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (checkRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const result = await query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [
      status,
      orderId,
    ]);
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

