const XLSX = require('xlsx');

function parseFacturasExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Buscar fila de encabezado con columnas conocidas
  let headerIdx = -1;
  let cols = {};

  const ALIAS = {
    nombre:    ['nombre', 'cliente', 'razon social', 'razón social', 'empresa'],
    recaudado: ['recaudado', 'cobrado', 'pagado'],
    vencido:   ['vencido', 'vencida', 'mora'],
    abierto:   ['abierto', 'pendiente', 'por cobrar', 'por vencer'],
    va:        ['v/a', 'v / a', 'vencido/abierto'],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map(c => String(c).trim().toLowerCase());
    const found = {};
    row.forEach((cell, j) => {
      for (const [key, aliases] of Object.entries(ALIAS)) {
        if (!found[key] && aliases.some(a => cell.includes(a))) found[key] = j;
      }
    });
    if (found.recaudado !== undefined && found.vencido !== undefined) {
      headerIdx = i;
      cols = found;
      break;
    }
  }

  if (headerIdx === -1) throw new Error('No se encontraron columnas Recaudado/Vencido. Verificar encabezados del Excel.');

  function parseNum(val) {
    if (typeof val === 'number') return val;
    const s = String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    return parseFloat(s) || 0;
  }

  const clientes = [];
  let totalRow = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const nombre = String(row[cols.nombre ?? 0] || '').trim();
    if (!nombre) continue;

    const recaudado = parseNum(row[cols.recaudado]);
    const vencido   = parseNum(row[cols.vencido]);
    const abierto   = parseNum(row[cols.abierto]);

    // Detectar fila de totales
    const esTotal = /^total/i.test(nombre);
    if (esTotal) {
      totalRow = { recaudado, vencido, abierto };
      continue;
    }

    if (recaudado + vencido + abierto === 0) continue;
    clientes.push({ nombre, recaudado, vencido, abierto });
  }

  // Si no hay fila de totales, sumar
  const totales = totalRow || {
    recaudado: clientes.reduce((s, c) => s + c.recaudado, 0),
    vencido:   clientes.reduce((s, c) => s + c.vencido,   0),
    abierto:   clientes.reduce((s, c) => s + c.abierto,   0),
  };

  // Calcular V/A = abierto / vencido por cliente
  for (const c of clientes) {
    c.va = c.vencido > 0 ? c.abierto / c.vencido : null;
  }
  totales.va = totales.vencido > 0 ? totales.abierto / totales.vencido : null;

  // Ordenar por mayor deuda vencida
  clientes.sort((a, b) => b.vencido - a.vencido || b.abierto - a.abierto);

  return { clientes, totales, updatedAt: new Date().toISOString() };
}

module.exports = { parseFacturasExcel };
