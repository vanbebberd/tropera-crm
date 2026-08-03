import React from 'react';

function shortName(nombre, allNames) {
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0];
  const hasDupe = allNames.filter(n => n.trim().split(/\s+/)[0] === first).length > 1;
  if (!hasDupe || parts.length < 2) return first;
  return `${first} ${parts[parts.length - 1].charAt(0)}.`;
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#14b8a6'];

export default function ClientesInsights({ vendedores, ownerFiltro, ownerNombre }) {
  if (!vendedores?.length) return null;

  const allNombres = vendedores.map(v => v.nombre);

  // Filtrar vendedor si hay filtro activo
  const sinMatchExcel = ownerNombre && ownerFiltro !== 'todos' &&
    !vendedores.some(v => {
      const needle = ownerNombre.trim().toLowerCase();
      return v.nombre.trim().toLowerCase().includes(needle) ||
        needle.split(/\s+/).every(w => v.nombre.trim().toLowerCase().includes(w));
    });

  const vList = (() => {
    if (!ownerNombre || ownerFiltro === 'todos') return vendedores;
    const needle = ownerNombre.trim().toLowerCase();
    return vendedores.filter(v => v.nombre.trim().toLowerCase().includes(needle) ||
      needle.split(/\s+/).every(w => v.nombre.trim().toLowerCase().includes(w)));
  })();

  if (sinMatchExcel) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
        <p className="text-sm text-gray-500">Sin datos de Excel para <span className="text-gray-300">{ownerNombre}</span></p>
        <p className="text-xs text-gray-600 mt-1">El nombre en el Excel puede ser diferente al de HubSpot</p>
      </div>
    );
  }

  const tieneTop     = vList.some(v => v.clientesTop?.length);
  const tieneRiesgo  = vList.some(v => v.clientesEnRiesgo?.length);
  if (!tieneTop && !tieneRiesgo) return null;

  // Top 10 global (suma litros por cliente entre todos los vendedores filtrados)
  const topGlobal = (() => {
    const mapa = {};
    vList.forEach((v, vi) => {
      (v.clientesTop || []).forEach(c => {
        if (!mapa[c.nombre]) mapa[c.nombre] = { nombre: c.nombre, litros: 0, vendedor: v.nombre, colorIdx: vi };
        mapa[c.nombre].litros += c.litros;
      });
    });
    return Object.values(mapa).sort((a, b) => b.litros - a.litros).slice(0, 10);
  })();

  const maxLitros = topGlobal[0]?.litros || 1;

  // Clientes en riesgo (unión de todos los vendedores filtrados)
  const enRiesgo = (() => {
    const vistos = new Set();
    const lista  = [];
    vList.forEach((v, vi) => {
      (v.clientesEnRiesgo || []).forEach(c => {
        if (!vistos.has(c.nombre)) {
          vistos.add(c.nombre);
          lista.push({ ...c, vendedor: v.nombre, colorIdx: vi });
        }
      });
    });
    return lista.sort((a, b) => b.litros - a.litros);
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Top 10 clientes */}
      {topGlobal.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Top clientes por litros
            </span>
            {ownerNombre && ownerFiltro !== 'todos' && (
              <span className="text-blue-400 text-xs ml-2 normal-case font-normal">— {ownerNombre}</span>
            )}
          </div>
          <div className="px-4 py-2 space-y-2">
            {topGlobal.map((c, i) => {
              const pct = Math.round((c.litros / maxLitros) * 100);
              return (
                <div key={c.nombre} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-300 truncate">{c.nombre}</span>
                      <span className="text-xs text-orange-400 font-semibold ml-2 shrink-0">
                        {c.litros.toLocaleString('es-CL', { maximumFractionDigits: 0 })} L
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[c.colorIdx % COLORS.length] }}
                      />
                    </div>
                  </div>
                  {ownerFiltro === 'todos' && (
                    <span className="text-xs shrink-0" style={{ color: COLORS[c.colorIdx % COLORS.length] }}>
                      {shortName(c.vendedor, allNombres)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clientes en riesgo */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Clientes en riesgo
          </span>
          <span className="text-gray-600 text-xs ml-2 normal-case font-normal">
            — sin compras en los últimos 14 días
          </span>
        </div>
        {enRiesgo.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-green-400">Sin clientes en riesgo esta semana</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {enRiesgo.map(c => (
              <div key={c.nombre} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-800/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-xs text-gray-300 truncate">{c.nombre}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  {c.litros > 0 && (
                    <span className="text-xs text-gray-500">
                      {c.litros.toLocaleString('es-CL', { maximumFractionDigits: 0 })} L
                    </span>
                  )}
                  {ownerFiltro === 'todos' && (
                    <span className="text-xs font-medium" style={{ color: COLORS[c.colorIdx % COLORS.length] }}>
                      {shortName(c.vendedor, allNombres)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
