require('dotenv').config();
const express = require('express');
const path    = require('path');
const { router: authRouter, authMiddleware } = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth',     authRouter);
app.use('/api/hubspot',  authMiddleware, require('./routes/hubspot'));
app.use('/api/ventas',   authMiddleware, require('./routes/ventas'));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`HubSpot Dashboard corriendo en puerto ${PORT}`));
