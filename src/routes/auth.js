import { Router } from 'express';
import { login, logout, authMiddleware } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  const token = login(username, password);
  if (!token) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  res.json({ token, username });
});

authRouter.post('/logout', authMiddleware, (req, res) => {
  logout(req.teacherToken);
  res.json({ success: true });
});
