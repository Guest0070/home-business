import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

function createToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

export async function registerUser({ name, email, password, role = 'user', companyName }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, company_name)
     VALUES ($1, LOWER($2), $3, $4, $5)
     RETURNING id, name, email, role, company_name`,
    [name, email, passwordHash, role, companyName || null]
  );
  const user = result.rows[0];
  return { user, token: createToken(user) };
}

export async function loginUser({ email, password }) {
  const result = await query(
    `SELECT id, name, email, password_hash, role, company_name, is_active
     FROM users
     WHERE email = LOWER($1)`,
    [email]
  );

  const user = result.rows[0];
  if (!user || !user.is_active) throw new ApiError(401, 'Invalid credentials');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  delete user.password_hash;
  return { user, token: createToken(user) };
}

