import React from 'react';

export default function VendedorCards({ vendedores, onSelect }) {
  if (!vendedores?.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {vendedores.map((v, i) => (
        <div
          key={v.id}
          onClick={() => onSelect?.(v.id)}
          className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3 cursor-pointer hover:border-orange-500/50 hover:bg-gray-800/60 transition-colors"
        >
          {/* Nombre */}
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-sm">
              {v.nombre.charAt(0)}
            </div>
            <span className="font-semibold text-white text-sm">{v.nombre}</span>
          </div>

          {/* Métricas en grid 3x2 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Contactos" value={v.contactosCreados} color="text-blue-400" />
            <Stat label="Deals"     value={v.dealsCreados}     color="text-indigo-400" />
            <Stat label="Visitados" value={v.dealsVisitados}   color="text-yellow-400" />
            <Stat label="Ganados"   value={v.dealsGanados}     color="text-green-400" />
            <Stat label="Tasa"      value={`${v.tasaExito}%`}  color={v.tasaExito >= 50 ? 'text-green-400' : v.tasaExito >= 25 ? 'text-yellow-400' : 'text-red-400'} />
            <Stat label="Velocidad" value={v.velocidadDias != null ? `${v.velocidadDias}d` : '—'} color={v.velocidadDias != null ? 'text-yellow-400' : 'text-gray-600'} sub={v.velocidadDias != null && v.velocidadDeals ? `${v.velocidadDeals} deal${v.velocidadDeals !== 1 ? 's' : ''}` : null} />
          </div>

          {/* Actividades */}
          <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-800 pt-3">
            <Stat label="Llamadas"  value={v.llamadas}  color="text-purple-400" />
            <Stat label="Reuniones" value={v.reuniones} color="text-teal-400" />
            <Stat label="Tareas"    value={v.tareas}    color="text-emerald-400" />
          </div>

          {/* Tareas vencidas */}
          {v.tareasVencidas > 0 && (
            <div className="flex items-center justify-between bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              <span className="text-xs text-red-400 font-medium">⏰ Tareas vencidas</span>
              <span className="text-sm font-bold text-red-400">{v.tareasVencidas}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color, sub }) {
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  );
}
