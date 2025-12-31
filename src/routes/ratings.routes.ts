import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

/**
 * @openapi
 * /ratings/add:
 *   post:
 *     summary: Add rating (clear endpoint; order_id in body)
 *     description: order_id refers to orders.id. Only allowed if order.status=DELIVERED.
 *     tags: [Ratings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, score]
 *             properties:
 *               order_id: { type: integer }
 *               score: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/add', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const { order_id, score, comment } = req.body ?? {};
  const user = (req as any).user as any;

  if (!order_id || !score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'order_id and score(1-5) are required' });
  }

  try {
    const orderRes = await query('SELECT restaurant_id, customer_id, status FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (orderRes.rows[0].customer_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    if (orderRes.rows[0].status !== 'DELIVERED') return res.status(400).json({ error: 'Can only rate delivered orders' });

    const restaurantId = orderRes.rows[0].restaurant_id;
    const result = await query(
      `INSERT INTO ratings (order_id, user_id, restaurant_id, score, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO UPDATE SET score = $4, comment = $5
       RETURNING *`,
      [order_id, user.id, restaurantId, score, comment]
    );
    return res.status(201).json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /ratings/{id}/delete:
 *   delete:
 *     summary: Delete my rating (CUSTOMER only)
 *     tags: [Ratings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id/delete', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const ratingId = req.params.id;
  try {
    const result = await query('DELETE FROM ratings WHERE id = $1 AND user_id = $2 RETURNING id', [ratingId, user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rating not found' });
    return res.json({ message: 'Rating deleted', id: result.rows[0].id });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /ratings/by-restaurant/{restaurantId}:
 *   get:
 *     summary: Get all ratings for a restaurant (restaurantId)
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/by-restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, u.full_name as customer_name 
       FROM ratings r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.restaurant_id = $1`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

