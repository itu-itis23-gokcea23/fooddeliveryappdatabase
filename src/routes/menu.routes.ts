import { Router, Request, Response } from 'express';
import { query, getClient } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

/**
 * @openapi
 * /menu/categories:
 *   get:
 *     summary: List all categories
 *     tags: [Menu]
 *     responses:
 *       200: { description: OK }
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM categories');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /menu/categories:
 *   post:
 *     summary: Create a category (ADMIN only)
 *     tags: [Menu]
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
 *     responses:
 *       201: { description: Created }
 */
router.post('/categories', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /menu/categories/{categoryId}/update:
 *   put:
 *     summary: Update category (ADMIN only)
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.put('/categories/:categoryId/update', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const { name } = req.body ?? {};
  const categoryId = req.params.categoryId;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [name, categoryId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /menu/categories/{categoryId}/delete:
 *   delete:
 *     summary: Delete category (ADMIN only)
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/categories/:categoryId/delete', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const categoryId = req.params.categoryId;
  try {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [categoryId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    return res.json({ message: 'Category deleted', id: result.rows[0].id });
  } catch (e: any) {
    return res.status(400).json({ error: 'Cannot delete category (in use?)', message: e?.message });
  }
});

/**
 * @openapi
 * /menu/menu-items/by-restaurant/{restaurantId}:
 *   get:
 *     summary: List menu items by restaurantId
 *     tags: [Menu]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/menu-items/by-restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT mi.*, array_agg(c.name) as categories
       FROM menu_items mi
       LEFT JOIN menu_item_categories mic ON mi.id = mic.menu_item_id
       LEFT JOIN categories c ON mic.category_id = c.id
       WHERE mi.restaurant_id = $1
       GROUP BY mi.id`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /menu/menu-items/add:
 *   post:
 *     summary: Add menu item (uses restaurant_id) + optionally link categories in same request
 *     description: |
 *       Clear "add" endpoint.
 *       - restaurant_id refers to restaurants.id
 *       - category_ids (optional) refers to categories.id[]
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurant_id, name, price]
 *             properties:
 *               restaurant_id: { type: integer }
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               category_ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       201: { description: Created }
 */
router.post('/menu-items/add', requireAuth, async (req: Request, res: Response) => {
  const { restaurant_id, name, description, price, category_ids } = req.body ?? {};
  const user = (req as any).user as any;
  const userId = user?.id;
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('ADMIN');

  if (!restaurant_id || !name || price === undefined || price === null) {
    return res.status(400).json({ error: 'restaurant_id, name and price are required' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query('SELECT owner_id FROM restaurants WHERE id = $1', [restaurant_id]);
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (checkRes.rows[0].owner_id !== userId && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const itemRes = await client.query(
      'INSERT INTO menu_items (restaurant_id, name, description, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [restaurant_id, name, description, price]
    );

    const menuItem = itemRes.rows[0];

    const ids: number[] = Array.isArray(category_ids) ? category_ids : [];
    for (const cid of ids) {
      await client.query(
        'INSERT INTO menu_item_categories (menu_item_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [menuItem.id, cid]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Menu item created',
      menu_item: menuItem,
      linked_category_ids: ids,
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error', message: e?.message });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /menu/menu-items/{menuItemId}/update:
 *   put:
 *     summary: Update menu item by menuItemId (owner/admin)
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: menuItemId
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
 *               price: { type: number }
 *               is_available: { type: boolean }
 *     responses:
 *       200: { description: OK }
 */
router.put('/menu-items/:menuItemId/update', requireAuth, async (req: Request, res: Response) => {
  // Just reuse the same logic by calling the existing handler via redirect-like behavior:
  // (kept simple: duplicate minimal logic by invoking the same DB update)
  const { name, description, price, is_available } = req.body ?? {};
  const menuItemId = req.params.menuItemId;

  const user = (req as any).user as any;
  const userId = user?.id;
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('ADMIN');

  try {
    const ownerRes = await query(
      `SELECT r.owner_id
       FROM menu_items mi
       JOIN restaurants r ON r.id = mi.restaurant_id
       WHERE mi.id = $1`,
      [menuItemId]
    );
    if (ownerRes.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });
    if (ownerRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      `UPDATE menu_items
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           is_available = COALESCE($4, is_available)
       WHERE id = $5
       RETURNING *`,
      [name, description, price, is_available, menuItemId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /menu/menu-items/{menuItemId}/delete:
 *   delete:
 *     summary: Delete menu item (owner/admin)
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: menuItemId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/menu-items/:menuItemId/delete', requireAuth, async (req: Request, res: Response) => {
  const menuItemId = req.params.menuItemId;
  const user = (req as any).user as any;
  const userId = user?.id;
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('ADMIN');

  try {
    const ownerRes = await query(
      `SELECT r.owner_id
       FROM menu_items mi
       JOIN restaurants r ON r.id = mi.restaurant_id
       WHERE mi.id = $1`,
      [menuItemId]
    );
    if (ownerRes.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });
    if (ownerRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const result = await query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [menuItemId]);
    return res.json({ message: 'Menu item deleted', id: result.rows[0].id });
  } catch (e: any) {
    return res.status(400).json({ error: 'Cannot delete menu item', message: e?.message });
  }
});

/**
 * @openapi
 * /menu/menu-items/{menuItemId}/categories/add:
 *   post:
 *     summary: Add/link category to menu item (owner/admin)
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: menuItemId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category_id]
 *             properties:
 *               category_id: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
async function linkMenuItemCategory(req: Request, res: Response) {
  const { category_id } = req.body;
  const menuItemId = req.params.menuItemId ?? req.params.id;
  const user = (req as any).user as any;
  const userId = user?.id;
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('ADMIN');

  if (!category_id) return res.status(400).json({ error: 'category_id is required' });

  try {
    const checkRes = await query(
      'SELECT r.owner_id FROM menu_items mi JOIN restaurants r ON mi.restaurant_id = r.id WHERE mi.id = $1',
      [menuItemId]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });
    if (checkRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await query('INSERT INTO menu_item_categories (menu_item_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      menuItemId,
      category_id,
    ]);
    res.json({ message: 'Category linked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

router.post('/menu-items/:menuItemId/categories/add', requireAuth, linkMenuItemCategory);

/**
 * @openapi
 * /menu/menu-items/{menuItemId}/categories/{categoryId}/delete:
 *   delete:
 *     summary: Unlink category from menu item (owner/admin)
 *     tags: [Menu]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: menuItemId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/menu-items/:menuItemId/categories/:categoryId/delete', requireAuth, async (req: Request, res: Response) => {
  const { menuItemId, categoryId } = req.params;
  const user = (req as any).user as any;
  const userId = user?.id;
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('ADMIN');

  try {
    const ownerRes = await query(
      `SELECT r.owner_id
       FROM menu_items mi
       JOIN restaurants r ON r.id = mi.restaurant_id
       WHERE mi.id = $1`,
      [menuItemId]
    );
    if (ownerRes.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });
    if (ownerRes.rows[0].owner_id !== userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await query('DELETE FROM menu_item_categories WHERE menu_item_id = $1 AND category_id = $2', [menuItemId, categoryId]);
    return res.json({ message: 'Unlinked', menuItemId: Number(menuItemId), categoryId: Number(categoryId) });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

