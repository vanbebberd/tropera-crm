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

  if (headerRowIdx === -1) throw new Error('No se encontraron columnas de semana. Asegurate de que el Excel tenga encabezados tipo "W23 2026".');

  const semanas = weekCols.map(w => w.label);

  function getLevel(cellValue, cellRef) {
    const val = String(cellValue || '');
    const spaces = val.length - val.trimStart().length;
    if (spaces >= 15) return 3;
    if (spaces >= 10) return 2;
    if (spaces >= 3)  return 1;
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
  let currentCategoria = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawName = String(row[0] || '');
    if (!rawName.trim()) continue;

    const cellRef = XLSX.utils.encode_cell({ r: i, c: 0 });
    const level = getLevel(rawName, cellRef);
    const name = rawName.trim();

    if (level === 0) continue;

    const weekValues = weekCols.map(w => parseNum(row[w.j]));

    if (level === 1) {
      currentVendedor = name;
      currentCategoria = null;
      if (!vendedores[name]) {
        vendedores[name] = {
          nombre: name,
          litros: weekValues,
          clientesPorSemana: semanas.map(() => new Set()),
          litrosPorCliente: {},
          semanasPorClienteCat: {},
        };
      } else {
        vendedores[name].litros = weekValues;
      }
    } else if (level === 2 && currentVendedor) {
      currentCategoria = name;
    } else if (level === 3 && currentVendedor) {
      weekValues.forEach((v, idx) => {
        if (v !== 0) {
          // Nivel cliente (agregado, sin formato) — para riesgo y top
          vendedores[currentVendedor].clientesPorSemana[idx].add(name);
          vendedores[currentVendedor].litrosPorCliente[name] =
            (vendedores[currentVendedor].litrosPorCliente[name] || 0) + v;

          // Nivel cliente+formato — para velocidad con filtro
          const key = name + '||' + (currentCategoria || '');
          if (!vendedores[currentVendedor].semanasPorClienteCat[key]) {
            vendedores[currentVendedor].semanasPorClienteCat[key] = {
              nombre: name,
              formato: currentCategoria || '',
              semanasSet: new Set(),
            };
          }
          vendedores[currentVendedor].semanasPorClienteCat[key].semanasSet.add(idx);
        }
      });
    }
  }

  const resultado = Object.values(vendedores).map(v => {
    const todosClientes = new Set();
    v.clientesPorSemana.forEach(s => s.forEach(c => todosClientes.add(c)));

    // Velocidad por cliente+formato
    const clientesVelocidad = Object.values(v.semanasPorClienteCat).map(({ nombre, formato, semanasSet }) => {
      const sems = [...semanasSet].sort((a, b) => a - b);
      let velocidad = null;
      if (sems.length >= 2) {
        const gaps = [];
        for (let i = 1; i < sems.length; i++) gaps.push(sems[i] - sems[i - 1]);
        velocidad = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
      }
      return { nombre, formato, apariciones: sems.length, velocidad };
    }).sort((a, b) => {
      if (a.velocidad !== null && b.velocidad !== null) return a.velocidad - b.velocidad;
      if (a.velocidad !== null) return -1;
      if (b.velocidad !== null) return 1;
      return a.nombre.localeCompare(b.nombre);
    });

    // Top 10 clientes por litros totales (agregado sin formato)
    const clientesTop = Object.entries(v.litrosPorCliente)
      .map(([nombre, litros]) => ({ nombre, litros: Math.round(litros * 10) / 10 }))
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 10);

    // Clientes en riesgo: sin compras en las ultimas 2 semanas
    const nSem = v.clientesPorSemana.length;
    const compraronReciente = new Set();
    for (let i = Math.max(0, nSem - 2); i < nSem; i++) {
      v.clientesPorSemana[i].forEach(c => compraronReciente.add(c));
    }
    const compraronAntes = new Set();
    for (let i = 0; i < Math.max(0, nSem - 2); i++) {
      v.clientesPorSemana[i].forEach(c => compraronAntes.add(c));
    }
    const clientesEnRiesgo = [...compraronAntes]
      .filter(c => !compraronReciente.has(c))
      .map(c => ({ nombre: c, litros: Math.round((v.litrosPorCliente[c] || 0) * 10) / 10 }))
      .sort((a, b) => b.litros - a.litros);

    return {
      nombre: v.nombre,
      litros:         v.litros,
      clientes:       v.clientesPorSemana.map(s => s.size),
      cierres:        v.clientesPorSemana.map(s => s.size),
      clientesUnicos: todosClientes.size,
      clientesVelocidad,
      clientesTop,
      clientesEnRiesgo,
    };
  });

  return {
    semanas,
    vendedores: resultado,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { parseVentasExcel };
