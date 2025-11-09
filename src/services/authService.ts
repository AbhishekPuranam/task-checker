import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // TODO: Replace with your actual database query
  // Example: const user = await User.findOne({ username, password: hashedPassword });
  
  // Mock user validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  // TODO: Verify credentials against database
  const isValid = true; // Replace with actual validation
  const isAdmin = checkIfUserIsAdmin(username); // Replace with actual admin check

  if (isValid) {
    const token = jwt.sign({ username, isAdmin }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      isAdmin,
      redirectUrl: isAdmin ? 'https://projects.sapcindia.com/admin/projects' : '/dashboard'
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
};

function checkIfUserIsAdmin(username: string): boolean {
  // TODO: Replace with actual database query to check admin role
  // Example: const user = await User.findOne({ username });
  // return user?.role === 'admin';
  return false; // Placeholder
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
