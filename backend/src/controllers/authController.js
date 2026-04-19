import { loginUser, registerUser } from '../services/authService.js';

export async function register(req, res, next) {
  try {
    const payload = { ...req.body, role: req.body.role || 'user' };
    const result = await registerUser(payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    res.json(await loginUser(req.body));
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  res.json({ user: req.user });
}

