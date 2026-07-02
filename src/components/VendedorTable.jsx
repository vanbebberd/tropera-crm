import React from 'react';

export default function VendedorTable({ vendedores }) {
  const sorted = [...vendedores].sort((a, b) => b.dealsGanados - a.dealsGanados);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendedor</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Contactos</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Ganados</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Velocidad</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Llamadas</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Reuniones</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Tareas</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(v => (
            <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
              <td className="px-4 py-3 font-medium text-white">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-xs font-bold">
                    {v.nombre.charAt(0).toUpperCase()}
                  </div>
                  {v.nombre}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{v.contactosCreados}</td>
              <td className="px-4 py-3 text-right">
                <span className={`font-semibold ${v.dealsGanados > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {v.dealsGanados}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
