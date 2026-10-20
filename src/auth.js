import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { addTeacherToken, isValidTeacherToken, removeTeacherToken } from './store.js';

export function login(username, password) {
  if (username !== config.teacherUser || password !== config.teacherPassword) {
    return null;
  }
  const token = randomUUID();
  addTeacherToken(token);
  return token;
}

export function logout(token) {
  removeTeacherToken(token);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = header.slice(7);
  if (!isValidTeacherToken(token)) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  req.teacherToken = token;
  next();
}
