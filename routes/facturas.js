const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const { parseFacturasExcel } = require('../lib/parseFacturasExcel');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const FILE_CURRENT  = process.env.VERCEL ? '/tmp/facturas_current.json'  : path.join(__dirname, '../data/facturas_current.json');
const FILE_PREVIOUS = process.env.VERCEL ? '/tmp/facturas_previous.json' : path.join(__dirname, '../data/facturas_previous.json');

function readFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function saveFile(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// GET /api/facturas — devuelve datos actuales y anteriores
router.get('/', (req, res) => {
  const current  = readFile(FILE_CURRENT);
  const previous = readFile(FILE_PREVIOUS);
  res.json({ current: current || null, previous: previous || null });
});

// POST /api/facturas/upload — nuevo upload: actual pasa a anterior
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const data = parseFacturasExcel(req.file.buffer);

    // Rotar: actual → anterior
    const existing = readFile(FILE_CURRENT);
    if (existing) saveFile(FILE_PREVIOUS, existing);

    saveFile(FILE_CURRENT, data);
    res.json({ ok: true, clientes: data.clientes.length, totales: data.totales });
  } catch (err) {
    console.error('[facturas] upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
