require('dotenv').config();
const express = require('express');
const { router: authRouter, authMiddleware } = require('../routes/auth');

const app = express();
app.use(express.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth',    authRouter);
app.use('/api/hubspot', authMiddleware, require('../routes/hubspot'));

module.exports = app;
