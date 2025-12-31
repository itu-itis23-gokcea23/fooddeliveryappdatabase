import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../db';

const router = Router();

async function registerWithRole(req: Request, res: Response, roleName: 'CUSTOMER' | 'RESTAURANT' | 'COURIER') {
  const { full_name, email, password, phone } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User already exists' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await client.query(
      'INSERT INTO users (full_name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email',
      [full_name, email, hashedPassword, phone]
    );

    const userId = newUser.rows[0].id;

    const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (roleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Role not found', message: 'Run /admin/seed-roles first.' });
    }
    const roleId = roleRes.rows[0].id;

    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    await client.query('COMMIT');

    return res.status(201).json({
      message: `${roleName} registered successfully`,
      user: newUser.rows[0],
      role: roleName,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function loginWithOptionalRole(req: Request, res: Response, requiredRole?: 'CUSTOMER' | 'RESTAURANT' | 'ADMIN' | 'COURIER') {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRes = await query(
      `SELECT u.id, u.email, u.password, array_agg(r.name) as roles
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.email = $1
       GROUP BY u.id`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    if (requiredRole && !roles.includes(requiredRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This login endpoint is for role=${requiredRole}. Your roles: ${roles.join(', ')}`,
      });
    }

    const payload = {
      id: user.id,
      email: user.email,
      roles,
    };

    const token = jwt.sign(payload, (process.env.JWT_SECRET as string) || 'change_this_secret', {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @openapi
 * /auth/register/customer:
 *   post:
 *     summary: Register CUSTOMER
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, email, password]
 *             properties:
 *               full_name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: User registered
 */
router.post('/register/customer', async (req: Request, res: Response) => registerWithRole(req, res, 'CUSTOMER'));

/**
 * @openapi
 * /auth/register/restaurant:
 *   post:
 *     summary: Register RESTAURANT owner (role is assigned automatically)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, email, password]
 *             properties:
 *               full_name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: User registered
 */
router.post('/register/restaurant', async (req: Request, res: Response) => registerWithRole(req, res, 'RESTAURANT'));

/**
 * @openapi
 * /auth/register/courier:
 *   post:
 *     summary: Register COURIER (role is assigned automatically)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, email, password]
 *             properties:
 *               full_name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: User registered
 */
router.post('/register/courier', async (req: Request, res: Response) => registerWithRole(req, res, 'COURIER'));

/**
 * @openapi
 * /auth/login/customer:
 *   post:
 *     summary: Login CUSTOMER (fails if user is not CUSTOMER)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/login/customer', async (req: Request, res: Response) => loginWithOptionalRole(req, res, 'CUSTOMER'));

/**
 * @openapi
 * /auth/login/restaurant:
 *   post:
 *     summary: Login RESTAURANT owner (fails if user is not RESTAURANT)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/login/restaurant', async (req: Request, res: Response) => loginWithOptionalRole(req, res, 'RESTAURANT'));

/**
 * @openapi
 * /auth/login/admin:
 *   post:
 *     summary: Login ADMIN (fails if user is not ADMIN)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/login/admin', async (req: Request, res: Response) => loginWithOptionalRole(req, res, 'ADMIN'));

/**
 * @openapi
 * /auth/login/courier:
 *   post:
 *     summary: Login COURIER (fails if user is not COURIER)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/login/courier', async (req: Request, res: Response) => loginWithOptionalRole(req, res, 'COURIER'));

export default router;

