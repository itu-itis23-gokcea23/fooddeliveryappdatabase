import { Router, Request, Response } from 'express';
import { query, getClient } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

/**
 * @openapi
 * /restaurants/list:
 *   get:
 *     summary: List all active restaurants
 *     tags: [Restaurants]
 *     responses:
 *       200:
 *         description: List of restaurants
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, ra.city, ra.street 
       FROM restaurants r 
       LEFT JOIN restaurant_addresses ra ON r.id = ra.restaurant_id 
       WHERE r.is_active = true`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /restaurants/my:
 *   get:
 *     summary: List my restaurants (RESTAURANT/ADMIN)
 *     tags: [Restaurants]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/my', requireAuth, requireRole(['RESTAURANT', 'ADMIN']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const isAdmin = Array.isArray(user.roles) && user.roles.includes('ADMIN');
  try {
    const result = isAdmin
      ? await query(
          `SELECT r.*, ra.city, ra.street
           FROM restaurants r
           LEFT JOIN restaurant_addresses ra ON r.id = ra.restaurant_id
           ORDER BY r.id DESC`
        )
      : await query(
          `SELECT r.*, ra.city, ra.street
           FROM restaurants r
           LEFT JOIN restaurant_addresses ra ON r.id = ra.restaurant_id
           WHERE r.owner_id = $1
           ORDER BY r.id DESC`,
          [user.id]
        );
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /restaurants/{id}:
 *   get:
 *     summary: Get a single restaurant by ID
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, ra.city, ra.street, ra.postal_code, ra.state
       FROM restaurants r 
       LEFT JOIN restaurant_addresses ra ON r.id = ra.restaurant_id 
       WHERE r.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /restaurants/add:
 *   post:
 *     summary: Add restaurant (owner/admin)
 *     tags: [Restaurants]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/add', requireAuth, requireRole(['RESTAURANT', 'ADMIN']), async (req: Request, res: Response) => {
  const { name, description } = req.body;
  const user = (req as any).user as any;
  const owner_id = user.id;

  if (!name) return res.status(400).json({ error: 'Restaurant name is required' });
  try {
    const result = await query(
      'INSERT INTO restaurants (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, owner_id]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /restaurants/{id}/update:
 *   put:
 *     summary: Update restaurant (owner/admin)
 *     tags: [Restaurants]
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
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               is_active: { type: boolean }
 *     responses:
 *       200: { description: OK }
 */
router.put('/:id/update', requireAuth, async (req: Request, res: Response) => {
  const { name, description, is_active } = req.body;
  const restaurantId = req.params.id;
  const user = (req as any).user as any;
  const userId = user.id;
  const isAdmin = user.roles.includes('ADMIN');

  try {
    const checkRes = await query('SELECT owner_id FROM restaurants WHERE id = $1', [restaurantId]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
    if (checkRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      'UPDATE restaurants SET name = COALESCE($1, name), description = COALESCE($2, description), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING *',
      [name, description, is_active, restaurantId]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /restaurants/{id}/address/add:
 *   post:
 *     summary: Add/update restaurant address (owner/admin)
 *     tags: [Restaurants]
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
 *             required: [street, city]
 *             properties:
 *               street: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               postal_code: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/address/add', requireAuth, async (req: Request, res: Response) => {
  const { street, city, state, postal_code, latitude, longitude } = req.body;
  const restaurantId = req.params.id;
  const user = (req as any).user as any;
  const userId = user.id;
  const isAdmin = user.roles.includes('ADMIN');

  try {
    const checkRes = await query('SELECT owner_id FROM restaurants WHERE id = $1', [restaurantId]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
    if (checkRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      `INSERT INTO restaurant_addresses (restaurant_id, street, city, state, postal_code, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (restaurant_id)
       DO UPDATE SET street = $2, city = $3, state = $4, postal_code = $5, latitude = $6, longitude = $7
       RETURNING *`,
      [restaurantId, street, city, state, postal_code, latitude, longitude]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /restaurants/{id}/delete:
 *   delete:
 *     summary: Soft-delete restaurant (sets is_active=false) (owner/admin)
 *     tags: [Restaurants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id/delete', requireAuth, async (req: Request, res: Response) => {
  const restaurantId = req.params.id;
  const user = (req as any).user as any;
  const userId = user.id;
  const isAdmin = user.roles.includes('ADMIN');

  try {
    const checkRes = await query('SELECT owner_id FROM restaurants WHERE id = $1', [restaurantId]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
    if (checkRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      'UPDATE restaurants SET is_active = FALSE WHERE id = $1 RETURNING *',
      [restaurantId]
    );
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

