import React from 'react';

export default function VendedorTable({ vendedores, destacado }) {
  const sorted = [...vendedores].sort((a, b) => b.dealsGanados - a.dealsGanados);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendedor</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Contactos</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Deals</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Visitados</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Ganados</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Tasa</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Velocidad</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Llamadas</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Reuniones</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Tareas</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(v => {
            const isDestacado = destacado && destacado !== 'todos' && v.id === destacado;
            return (
              <tr key={v.id} className={`border-b border-gray-800/50 transition-colors ${isDestacado ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/20'}`}>
                <td className="px-4 py-3 font-medium text-white">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDestacado ? 'bg-blue-500/30 border border-blue-500/50 text-blue-300' : 'bg-orange-500/20 border border-orange-500/30 text-orange-400'}`}>
                      {v.nombre.charAt(0).toUpperCase()}
                    </div>
                    {v.nombre}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{v.contactosCreados}</td>
                <td className="px-4 py-3 text-right text-gray-300">{v.dealsCreados}</td>
                <td className="px-4 py-3 text-right text-gray-300">{v.dealsVisitados}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${v.dealsGanados > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {v.dealsGanados}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${v.tasaExito >= 50 ? 'text-green-400' : v.tasaExito >= 25 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {v.tasaExito}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {v.velocidadDias !== null
                    ? <span className="text-yellow-400 font-medium">{v.velocidadDias}d</span>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-purple-400">{v.llamadas}</td>
                <td className="px-4 py-3 text-right text-teal-400">{v.reuniones}</td>
                <td className="px-4 py-3 text-right text-emerald-400">{v.tareas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
