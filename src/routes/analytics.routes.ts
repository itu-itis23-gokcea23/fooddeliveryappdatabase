import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * @openapi
 * /analytics/top-restaurants:
 *   get:
 *     summary: Top restaurants by average rating
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: minRatings
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of top restaurants
 */
router.get('/top-restaurants', async (req: Request, res: Response) => {
  const minRatings = req.query.minRatings || 1;
  const limit = req.query.limit || 10;

  try {
    const result = await query(
      `SELECT r.id, r.name, AVG(rt.score) as avg_rating, COUNT(rt.id) as rating_count
       FROM restaurants r
       JOIN ratings rt ON r.id = rt.restaurant_id
       GROUP BY r.id, r.name
       HAVING COUNT(rt.id) >= $1
       ORDER BY avg_rating DESC
       LIMIT $2`,
      [minRatings, limit]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /analytics/me/order-history:
 *   get:
 *     summary: My order history with totals + item count (CUSTOMER)
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/me/order-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as any;
    const result = await query(
      `SELECT o.id, o.created_at, o.status, o.total_amount, r.name as restaurant_name,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
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
 * /analytics/restaurants/{id}/popular-items:
 *   get:
 *     summary: Most popular menu items for a restaurant (nested query)
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/restaurants/:id/popular-items', async (req: Request, res: Response) => {
  const restaurantId = req.params.id;
  const limit = req.query.limit || 5;

  try {
    const result = await query(
      `SELECT mi.id, mi.name, mi.price, item_stats.total_sold
       FROM menu_items mi
       JOIN (
           SELECT menu_item_id, SUM(quantity) as total_sold
           FROM order_items
           WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = $1)
           GROUP BY menu_item_id
       ) as item_stats ON mi.id = item_stats.menu_item_id
       WHERE mi.restaurant_id = $1
       ORDER BY item_stats.total_sold DESC
       LIMIT $2`,
      [restaurantId, limit]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

