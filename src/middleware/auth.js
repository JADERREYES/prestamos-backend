const { verifyToken } = require('../utils/jwt');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
};

module.exports = { authMiddleware, adminOnly };
