import { Router, Request, Response } from 'express';
import { query, getClient } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

const VALID_ROLES = ['ADMIN', 'RESTAURANT', 'COURIER', 'CUSTOMER'] as const;
type RoleName = (typeof VALID_ROLES)[number];

function normalizeRole(role: unknown): RoleName | null {
  if (typeof role !== 'string') return null;
  const r = role.toUpperCase().trim();
  return (VALID_ROLES as readonly string[]).includes(r) ? (r as RoleName) : null;
}

/**
 * @openapi
 * /admin/seed-roles:
 *   post:
 *     summary: Seed roles (ADMIN only, idempotent)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles seeded
 */
router.post('/seed-roles', requireAuth, requireRole(['ADMIN']), async (_req: Request, res: Response) => {
  try {
    await query(
      `INSERT INTO roles (name)
       VALUES ('ADMIN'), ('RESTAURANT'), ('COURIER'), ('CUSTOMER')
       ON CONFLICT (name) DO NOTHING`
    );
    return res.json({ message: 'Roles seeded (idempotent)' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal server error', message: e?.message });
  }
});

/**
 * @openapi
 * /admin/assign-role:
 *   post:
 *     summary: Assign a role to a user by email (ADMIN only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string }
 *               role: { type: string, enum: [ADMIN, RESTAURANT, COURIER, CUSTOMER] }
 *     responses:
 *       200:
 *         description: Role assigned
 */
router.post('/assign-role', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const { email, role } = req.body ?? {};
  const roleName = normalizeRole(role);

  if (!email || !roleName) {
    return res.status(400).json({ error: 'Invalid input', message: 'email and valid role are required' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (roleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Role not found', message: 'Run /admin/seed-roles first.' });
    }

    const userId = userRes.rows[0].id;
    const roleId = roleRes.rows[0].id;

    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      userId,
      roleId,
    ]);

    await client.query('COMMIT');
    return res.json({ message: 'Role assigned (idempotent)', email, role: roleName });
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error', message: e?.message });
  } finally {
    client.release();
  }
});

export default router;


