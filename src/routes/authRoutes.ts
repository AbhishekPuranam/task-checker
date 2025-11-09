import { Router } from 'express';
import { login, authenticateToken, requireAdmin } from '../services/authService';

const router = Router();

router.post('/login', login);

// Protected route example
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Admin-only route example
router.get('/admin/check', authenticateToken, requireAdmin, (req, res) => {
  res.json({ message: 'Admin access granted' });
});

export default router;
