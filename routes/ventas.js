const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const { parseVentasExcel } = require('../lib/parseExcel');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const DATA_FILE = path.join(__dirname, '../data/ventas.json');

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return null; }
}

function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET /api/ventas — devuelve los datos actuales
router.get('/', (req, res) => {
  const data = readData();
  if (!data) return res.json({ semanas: [], vendedores: [], updatedAt: null });
  res.json(data);
});

// POST /api/ventas/upload — sube y parsea el Excel
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const data = parseVentasExcel(req.file.buffer);
    saveData(data);
    res.json({ ok: true, semanas: data.semanas, vendedores: data.vendedores.length });
  } catch (err) {
    console.error('[ventas] upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
