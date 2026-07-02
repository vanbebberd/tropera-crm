import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#14b8a6','#eab308','#ef4444','#06b6d4'];

export default function MensualChart({ data, vendedores, ownerFiltro }) {
  if (!data?.length) return null;

  const chartData = data.map(m => {
    const row = { mes: m.label, Total: m.total };
    vendedores.forEach(v => { row[v] = m.porVendedor[v] || 0; });
    return row;
  });

  const mostrarVendedores = ownerFiltro
    ? vendedores.filter(v => v === ownerFiltro)
    : vendedores;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {ownerFiltro ? (
              mostrarVendedores.map((v, i) => (
                <Bar key={v} dataKey={v} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
              ))
            ) : (
              <Bar dataKey="Total" fill="#f97316" radius={[3, 3, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla resumen mensual */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400">Mes</th>
              {ownerFiltro
                ? <th className="text-right py-2 px-3 text-gray-400">{ownerFiltro}</th>
                : <>
                    {vendedores.map(v => <th key={v} className="text-right py-2 px-3 text-gray-400">{v.split(' ')[0]}</th>)}
                    <th className="text-right py-2 px-3 text-orange-400 font-semibold">Total</th>
                  </>
              }
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr key={m.key} className={`border-b border-gray-800/40 ${i === data.length - 1 ? 'bg-orange-900/10' : 'hover:bg-gray-800/20'}`}>
                <td className="py-2 px-3 text-gray-300 font-medium">
                  {i === data.length - 1 ? <span className="text-orange-400">{m.label}</span> : m.label}
                </td>
                {ownerFiltro
                  ? <td className="py-2 px-3 text-right text-green-400 font-semibold">{m.porVendedor[ownerFiltro] || 0}</td>
                  : <>
                      {vendedores.map(v => (
                        <td key={v} className="py-2 px-3 text-right text-gray-300">{m.porVendedor[v] || 0}</td>
                      ))}
                      <td className="py-2 px-3 text-right text-orange-400 font-bold">{m.total}</td>
                    </>
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
