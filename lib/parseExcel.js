const XLSX = require('xlsx');

function parseVentasExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Buscar fila con encabezados de semana (ej: "W23 2026")
  let headerRowIdx = -1;
  let weekCols = [];

  for (let i = 0; i < rows.length; i++) {
    const matches = rows[i]
      .map((cell, j) => ({ j, label: String(cell).trim() }))
      .filter(x => /^W\d{2}\s+\d{4}$/.test(x.label));
    if (matches.length >= 2) {
      headerRowIdx = i;
      weekCols = matches;
      break;
    }
  }

  if (headerRowIdx === -1) throw new Error('No se encontraron columnas de semana. Asegúrate de que el Excel tenga encabezados tipo "W23 2026".');

  const semanas = weekCols.map(w => w.label);

  // Detectar nivel de jerarquía por espacios iniciales o estilo de celda
  function getLevel(cellValue, cellRef) {
    const val = String(cellValue || '');
    const spaces = val.length - val.trimStart().length;
    if (spaces >= 15) return 3; // cliente
    if (spaces >= 10) return 2; // categoría
    if (spaces >= 3)  return 1; // vendedor
    // Intentar con estilo de Excel
    if (cellRef) {
      const cell = ws[cellRef];
      const indent = cell?.s?.alignment?.indent || 0;
      if (indent >= 3) return 3;
      if (indent >= 2) return 2;
      if (indent >= 1) return 1;
    }
    return 0;
  }

  function parseNum(val) {
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(',', '.')) || 0;
  }

  const vendedores = {};
  let currentVendedor = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawName = String(row[0] || '');
    if (!rawName.trim()) continue;

    const cellRef = XLSX.utils.encode_cell({ r: i, c: 0 });
    const level = getLevel(rawName, cellRef);
    const name = rawName.trim();

    // Ignorar fila "Total" general
    if (level === 0) continue;

    const weekValues = weekCols.map(w => parseNum(row[w.j]));

    if (level === 1) {
      // Vendedor
      currentVendedor = name;
      if (!vendedores[name]) {
        vendedores[name] = {
          nombre: name,
          litros: weekValues,
          clientesPorSemana: semanas.map(() => new Set()),
        };
      } else {
        vendedores[name].litros = weekValues;
      }
    } else if (level === 3 && currentVendedor) {
      // Cliente — contar cuántas semanas tuvo compra
      weekValues.forEach((v, idx) => {
        if (v !== 0) vendedores[currentVendedor].clientesPorSemana[idx].add(name);
      });
    }
  }

  const resultado = Object.values(vendedores).map(v => ({
    nombre: v.nombre,
    litros:   v.litros,
    clientes: v.clientesPorSemana.map(s => s.size),
    cierres:  v.clientesPorSemana.map(s => s.size),
  }));

  return {
    semanas,
    vendedores: resultado,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { parseVentasExcel };
