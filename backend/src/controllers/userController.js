import { query } from '../config/db.js';
import { registerUser } from '../services/authService.js';

export async function listUsers(_req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, email, role, company_name, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

