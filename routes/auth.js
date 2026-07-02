const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const USERS = [
  { username: process.env.DASH_USER || 'admin', password: process.env.DASH_PASS || 'epv2024' },
];

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = jwt.sign({ username }, process.env.JWT_SECRET || 'secret123', { expiresIn: '12h' });
  res.json({ token });
});

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Sin token' });
  try {
    jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET || 'secret123');
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { router, authMiddleware };
