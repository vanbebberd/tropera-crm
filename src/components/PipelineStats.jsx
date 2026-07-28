import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

function diasColor(d) {
  if (d === null) return 'text-gray-500';
  if (d <= 3)  return 'text-green-400';
  if (d <= 7)  return 'text-yellow-400';
  if (d <= 14) return 'text-orange-400';
  return 'text-red-400';
}

function diasBadge(d) {
  if (d === null) return 'bg-gray-700/50 text-gray-500 border border-gray-700';
  if (d <= 3)  return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (d <= 7)  return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (d <= 14) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border border-red-500/30';
}

export default function PipelineStats({ data, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { dealsInactivos = [], tiempoPorEtapa = [], umbralDias = 7 } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Deals sin actividad */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Deals sin actividad
          </span>
          <span className="text-xs text-gray-600">+{umbralDias} días</span>
        </div>
        {dealsInactivos.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-green-400">Todos los deals con actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50 max-h-72 overflow-y-auto">
            {dealsInactivos.map(d => (
              <div key={d.id} className="px-4 py-2.5 flex items-start justify-between gap-2 hover:bg-gray-800/20">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-300 truncate font-medium">{d.nombre}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{d.etapa} · {d.owner.split(' ')[0]}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${diasBadge(d.diasSinActividad)}`}>
                  {d.diasSinActividad !== null ? `${d.diasSinActividad}d` : 'sin act.'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tiempo promedio por etapa */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Tiempo promedio por etapa
          </span>
          <span className="text-gray-600 text-xs ml-2 normal-case font-normal">— días promedio en cada etapa (deals abiertos)</span>
        </div>
        {tiempoPorEtapa.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">Sin datos de etapas disponibles</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tiempoPorEtapa}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} unit="d" />
                  <YAxis
                    type="category"
                    dataKey="etapa"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    width={90}
                    tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#f9fafb', fontSize: 12 }}
                    formatter={(value, name, props) => [`${value} días (${props.payload.deals} deals)`, 'Promedio']}
                  />
                  <Bar dataKey="promedioDias" radius={[0, 3, 3, 0]}>
                    {tiempoPorEtapa.map((entry, i) => (
                      <Cell
                        key={entry.etapa}
                        fill={entry.promedioDias > 14 ? '#ef4444' : entry.promedioDias > 7 ? '#f97316' : '#22c55e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-4 justify-end">
              <span className="flex items-center gap-1 text-xs text-gray-600"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block"/>≤7d</span>
              <span className="flex items-center gap-1 text-xs text-gray-600"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block"/>8-14d</span>
              <span className="flex items-center gap-1 text-xs text-gray-600"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"/>&gt;14d</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
