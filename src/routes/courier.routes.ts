import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

const COURIER_ASSIGNMENT_STATUSES = ['ASSIGNED', 'PICKED_UP', 'DELIVERED'] as const;
type CourierAssignmentStatus = (typeof COURIER_ASSIGNMENT_STATUSES)[number];
function isCourierAssignmentStatus(v: unknown): v is CourierAssignmentStatus {
  return typeof v === 'string' && (COURIER_ASSIGNMENT_STATUSES as readonly string[]).includes(v);
}

/**
 * @openapi
 * /courier/assign-courier:
 *   post:
 *     summary: Assign courier (clear endpoint; order_id in body)
 *     description: order_id refers to orders.id
 *     tags: [Courier]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, courier_id]
 *             properties:
 *               order_id: { type: integer }
 *               courier_id: { type: integer }
 *     responses:
 *       201: { description: Created }
 */
router.post('/assign-courier', requireAuth, requireRole(['RESTAURANT', 'ADMIN']), async (req: Request, res: Response) => {
  const { order_id, courier_id } = req.body ?? {};
  if (!order_id || !courier_id) return res.status(400).json({ error: 'order_id and courier_id are required' });

  try {
    const orderRes = await query('SELECT status FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const result = await query(
      `INSERT INTO courier_assignments (order_id, courier_id, status)
       VALUES ($1, $2, 'ASSIGNED')
       ON CONFLICT (order_id) DO UPDATE SET courier_id = $2, status = 'ASSIGNED'
       RETURNING *`,
      [order_id, courier_id]
    );
    return res.status(201).json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /courier/assignments:
 *   get:
 *     summary: Get assigned orders for the current courier
 *     tags: [Courier]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/assignments', requireAuth, requireRole(['COURIER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as any;
    const result = await query(
      `SELECT ca.*, o.total_amount, r.name as restaurant_name, ra.street as restaurant_street, ra.city as restaurant_city
       FROM courier_assignments ca
       JOIN orders o ON ca.order_id = o.id
       JOIN restaurants r ON o.restaurant_id = r.id
       JOIN restaurant_addresses ra ON r.id = ra.restaurant_id
       WHERE ca.courier_id = $1 AND ca.status != 'DELIVERED'`,
      [user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /courier/assignments/{id}:
 *   get:
 *     summary: Get assignment by id (courier/admin)
 *     tags: [Courier]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/assignments/:id', requireAuth, requireRole(['COURIER', 'ADMIN']), async (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const isAdmin = Array.isArray(user.roles) && user.roles.includes('ADMIN');
  const id = req.params.id;
  try {
    const result = isAdmin
      ? await query('SELECT * FROM courier_assignments WHERE id = $1', [id])
      : await query('SELECT * FROM courier_assignments WHERE id = $1 AND courier_id = $2', [id, user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /courier/assignments/list:
 *   get:
 *     summary: List all courier assignments (ADMIN only)
 *     tags: [Courier]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/assignments/list', requireAuth, requireRole(['ADMIN']), async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM courier_assignments ORDER BY id DESC');
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /courier/assignments/{id}/delete:
 *   delete:
 *     summary: Delete assignment (ADMIN only)
 *     tags: [Courier]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/assignments/:id/delete', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM courier_assignments WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    return res.json({ message: 'Assignment deleted', id: result.rows[0].id });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /courier/assignments/{id}/update-status:
 *   put:
 *     summary: Update assignment status (courier/admin)
 *     tags: [Courier]
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
 *               status: { type: string, enum: [ASSIGNED, PICKED_UP, DELIVERED] }
 *     responses:
 *       200: { description: OK }
 */
router.put('/assignments/:id/update-status', requireAuth, requireRole(['COURIER', 'ADMIN']), async (req: Request, res: Response) => {
  const { status } = req.body; // PICKED_UP, DELIVERED
  const assignmentId = req.params.id;
  const user = (req as any).user as any;
  const isAdmin = Array.isArray(user.roles) && user.roles.includes('ADMIN');

  if (!isCourierAssignmentStatus(status)) {
    return res.status(400).json({ error: 'Invalid status', allowed: COURIER_ASSIGNMENT_STATUSES });
  }

  try {
    let updateFields = 'status = $1';

    if (status === 'PICKED_UP') {
      updateFields += ', picked_at = CURRENT_TIMESTAMP';
    } else if (status === 'DELIVERED') {
      updateFields += ', delivered_at = CURRENT_TIMESTAMP';
    }

    const result = isAdmin
      ? await query(`UPDATE courier_assignments SET ${updateFields} WHERE id = $2 RETURNING *`, [status, assignmentId])
      : await query(`UPDATE courier_assignments SET ${updateFields} WHERE id = $2 AND courier_id = $3 RETURNING *`, [
          status,
          assignmentId,
          user.id,
        ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found or not yours' });

    // Keep orders.status in sync
    if (status === 'DELIVERED') {
      await query('UPDATE orders SET status = $1 WHERE id = $2', ['DELIVERED', result.rows[0].order_id]);
    } else if (status === 'PICKED_UP') {
      await query('UPDATE orders SET status = $1 WHERE id = $2', ['PICKED_UP', result.rows[0].order_id]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

