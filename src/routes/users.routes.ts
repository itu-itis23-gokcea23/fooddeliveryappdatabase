import { Router, Request, Response } from 'express';
import { getClient, query } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

/**
 * @openapi
 * /users/addresses/me:
 *   get:
 *     summary: List my saved addresses
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/addresses/me', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  try {
    const result = await query('SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC', [
      user.id,
    ]);
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /users/addresses/add:
 *   post:
 *     summary: Add an address for the current user
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [street, city]
 *             properties:
 *               title: { type: string, example: Home }
 *               street: { type: string }
 *               city: { type: string }
 *               postal_code: { type: string }
 *               is_default: { type: boolean }
 *     responses:
 *       201: { description: Created }
 */
router.post('/addresses/add', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const { title, street, city, postal_code, is_default } = req.body ?? {};

  if (!street || !city) {
    return res.status(400).json({ error: 'street and city are required' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (is_default === true) {
      await client.query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
    }

    const result = await client.query(
      `INSERT INTO user_addresses (user_id, title, street, city, postal_code, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, title || 'Home', street, city, postal_code || null, is_default === true]
    );

    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error', message: e?.message });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /users/addresses/{id}/update:
 *   put:
 *     summary: Update one of my addresses (CUSTOMER only)
 *     tags: [Users]
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
 *               title: { type: string }
 *               street: { type: string }
 *               city: { type: string }
 *               postal_code: { type: string }
 *               is_default: { type: boolean }
 *     responses:
 *       200: { description: OK }
 */
router.put('/addresses/:id/update', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const addressId = req.params.id;
  const { title, street, city, postal_code, is_default } = req.body ?? {};

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (is_default === true) {
      await client.query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
    }

    const result = await client.query(
      `UPDATE user_addresses
       SET title = COALESCE($1, title),
           street = COALESCE($2, street),
           city = COALESCE($3, city),
           postal_code = COALESCE($4, postal_code),
           is_default = COALESCE($5, is_default)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, street, city, postal_code, is_default, addressId, user.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Address not found' });
    }

    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error', message: e?.message });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /users/addresses/{id}/delete:
 *   delete:
 *     summary: Delete one of my addresses (CUSTOMER only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/addresses/:id/delete', requireAuth, requireRole(['CUSTOMER']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const addressId = req.params.id;
  try {
    const result = await query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING id', [addressId, user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Address not found' });
    return res.json({ message: 'Address deleted', id: result.rows[0].id });
  } catch (e: any) {
    return res.status(400).json({ error: 'Cannot delete address (used by orders?)', message: e?.message });
  }
});

export default router;


