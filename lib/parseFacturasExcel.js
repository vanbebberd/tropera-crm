const XLSX = require('xlsx');

function parseFacturasExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // Probar todas las hojas hasta encontrar datos
  let rows = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const r = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (r.length > 1) { rows = r; break; }
  }

  function norm(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function parseNum(val) {
    if (typeof val === 'number') return val;
    const s = String(val)
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    return parseFloat(s) || 0;
  }

  const ALIAS = {
    nombre:    ['nombre', 'cliente', 'empresa', 'razon social', 'razon', 'vendedor', 'name'],
    recaudado: ['recaudado', 'cobrado', 'pagado', 'facturado', 'cobradas', 'recaudadas'],
    vencido:   ['vencido', 'vencida', 'vencidos', 'vencidas', 'mora', 'deuda'],
    abierto:   ['abierto', 'abierta', 'abiertos', 'abiertas', 'pendiente', 'corriente', 'por cobrar'],
    va:        ['v/a', 'v / a', 'va', 'variacion', 'v-a'],
  };

  // ── Intento 1: detección por nombre de columna ──────────────────────────────
  let headerIdx = -1;
  let cols = {};

  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const found = {};
    rows[i].forEach((raw, j) => {
      const cell = norm(raw);
      if (!cell || typeof raw === 'number') return;
      for (const [key, aliases] of Object.entries(ALIAS)) {
        if (found[key] !== undefined) continue;
        if (aliases.some(a => cell === a || cell.includes(a))) found[key] = j;
      }
    });
    if (found.recaudado !== undefined && found.vencido !== undefined) {
      headerIdx = i;
      cols = found;
      break;
    }
  }

  // ── Intento 2: detección posicional ────────────────────────────────────────
  // Busca la primera fila donde col 0 es texto y cols 1-4 tienen valores numéricos
  if (headerIdx === -1) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const row = rows[i];
      const col0IsText = typeof row[0] === 'string' && row[0].trim().length > 0 && isNaN(Number(row[0]));
      // Verificar que la fila siguiente tiene números en las mismas posiciones
      const nextRow = rows[i + 1];
      if (!col0IsText || !nextRow) continue;
      const numCols = [1, 2, 3].filter(j => nextRow[j] !== undefined && nextRow[j] !== '' && !isNaN(parseNum(nextRow[j]))).length;
      if (numCols >= 2) {
        headerIdx = i;
        // Asignar posicionalmente: 0=nombre, 1=recaudado, 2=vencido, 3=abierto, 4=va
        cols = { nombre: 0, recaudado: 1, vencido: 2, abierto: 3, va: 4 };
        break;
      }
    }
  }

  if (headerIdx === -1) {
    const preview = rows.slice(0, 6).map((r, i) =>
      `Fila ${i + 1}: ${r.map(c => JSON.stringify(c)).join(' | ')}`
    ).join('\n');
    throw new Error(`No se pudo detectar la estructura del Excel.\n\nContenido:\n${preview}`);
  }

  const clientes = [];
  let totalRow = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const nombreRaw = String(row[cols.nombre ?? 0] || '').trim();
    if (!nombreRaw) continue;

    const recaudado = parseNum(row[cols.recaudado]);
    const vencido   = parseNum(row[cols.vencido]);
    const abierto   = cols.abierto !== undefined ? parseNum(row[cols.abierto]) : 0;

    if (/^total/i.test(nombreRaw)) {
      totalRow = { recaudado, vencido, abierto };
      continue;
    }

    if (recaudado + vencido + abierto === 0) continue;
    clientes.push({ nombre: nombreRaw, recaudado, vencido, abierto });
  }

  const totales = totalRow || {
    recaudado: clientes.reduce((s, c) => s + c.recaudado, 0),
    vencido:   clientes.reduce((s, c) => s + c.vencido,   0),
    abierto:   clientes.reduce((s, c) => s + c.abierto,   0),
  };

  for (const c of clientes) {
    c.va = c.vencido > 0 ? c.abierto / c.vencido : null;
  }
  totales.va = totales.vencido > 0 ? totales.abierto / totales.vencido : null;

  clientes.sort((a, b) => b.vencido - a.vencido || b.abierto - a.abierto);

  return { clientes, totales, updatedAt: new Date().toISOString() };
}

module.exports = { parseFacturasExcel };
