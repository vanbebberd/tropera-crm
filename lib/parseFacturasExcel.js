const XLSX = require('xlsx');

function parseFacturasExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Normaliza un texto: minúsculas, sin tildes, sin caracteres especiales
  function norm(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quita tildes
      .replace(/[^a-z0-9\s]/g, ' ')                       // solo letras y números
      .replace(/\s+/g, ' ')
      .trim();
  }

  const ALIAS = {
    nombre:    ['nombre', 'cliente', 'razon social', 'empresa', 'razon'],
    recaudado: ['recaudado', 'recaud', 'cobrado', 'pagado', 'facturado'],
    vencido:   ['vencido', 'vencida', 'vencidos', 'mora', 'deuda'],
    abierto:   ['abierto', 'abierta', 'abiertos', 'pendiente', 'por cobrar', 'por vencer', 'corriente'],
    va:        ['v a', 'va', 'variacion', 'variacion', 'indice'],
  };

  let headerIdx = -1;
  let cols = {};

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const found = {};
    rows[i].forEach((raw, j) => {
      const cell = norm(raw);
      if (!cell) return;
      for (const [key, aliases] of Object.entries(ALIAS)) {
        if (found[key] !== undefined) continue;
        if (aliases.some(a => cell === a || cell.startsWith(a) || cell.includes(a))) {
          found[key] = j;
        }
      }
    });

    // Requiere al menos recaudado + vencido (los dos más distintivos)
    if (found.recaudado !== undefined && found.vencido !== undefined) {
      headerIdx = i;
      cols = found;
      break;
    }
  }

  if (headerIdx === -1) {
    // Debug: mostrar las primeras filas para ayudar a diagnosticar
    const preview = rows.slice(0, 5).map((r, i) =>
      `Fila ${i + 1}: ${r.map(c => String(c).trim()).filter(Boolean).join(' | ')}`
    ).join('\n');
    throw new Error(
      `No se encontraron columnas Recaudado y Vencido en las primeras 30 filas.\n\nContenido detectado:\n${preview}`
    );
  }

  function parseNum(val) {
    if (typeof val === 'number') return val;
    const s = String(val)
      .replace(/\./g, '')   // separador de miles chileno
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    return parseFloat(s) || 0;
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

    const esTotal = /^total/i.test(nombreRaw);
    if (esTotal) {
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

  // V/A = Abierto / Vencido por cliente y total
  for (const c of clientes) {
    c.va = c.vencido > 0 ? c.abierto / c.vencido : null;
  }
  totales.va = totales.vencido > 0 ? totales.abierto / totales.vencido : null;

  clientes.sort((a, b) => b.vencido - a.vencido || b.abierto - a.abierto);

  return { clientes, totales, updatedAt: new Date().toISOString() };
}

module.exports = { parseFacturasExcel };
