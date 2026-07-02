import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function VelocidadChart({ vendedores }) {
  const data = vendedores
    .filter(v => v.velocidadDias !== null)
    .sort((a, b) => a.velocidadDias - b.velocidadDias)
    .map(v => ({ nombre: v.nombre.split(' ')[0], dias: v.velocidadDias }));

  if (!data.length) return null;

  const avg = Math.round(data.reduce((s, d) => s + d.dias, 0) / data.length);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">Días promedio desde creación hasta cierre del deal</p>
        <span className="text-xs text-yellow-400 font-medium">Promedio: {avg}d</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="d" />
            <YAxis dataKey="nombre" type="category" tick={{ fill: '#d1d5db', fontSize: 12 }} width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v) => [`${v} días`, 'Velocidad']}
            />
            <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.dias <= avg ? '#22c55e' : d.dias <= avg * 1.5 ? '#eab308' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-600 mt-2">Verde = bajo el promedio · Amarillo = hasta 1.5× · Rojo = sobre 1.5×</p>
    </div>
  );
}
