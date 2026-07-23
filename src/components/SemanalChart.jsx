import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function SemanalChart({ semanas, ownerFiltro }) {
  const reversed = [...semanas].reverse();

  const dealsData = reversed.map((s, i) => {
    const label = i === semanas.length - 1 ? 'Esta sem.' : `Sem. ${s.label}`;
    if (ownerFiltro && ownerFiltro !== 'todos') {
      const v = s.porVendedor?.find(v => v.id === ownerFiltro);
      return {
        semana: label,
        'Deals creados': v?.dealsCreados || 0,
        'Visitados': v?.dealsVisitados || 0,
        'Ganados': v?.dealsGanados || 0,
      };
    }
    return {
      semana: label,
      'Deals creados': s.dealsCreados,
      'Visitados': s.dealsVisitados,
      'Ganados': s.dealsGanados,
    };
  });

  const actData = reversed.map((s, i) => {
    const label = i === semanas.length - 1 ? 'Esta sem.' : `Sem. ${s.label}`;
    if (ownerFiltro && ownerFiltro !== 'todos') {
      const v = s.porVendedor?.find(v => v.id === ownerFiltro);
      return { semana: label, 'Llamadas': v?.llamadas || 0, 'Reuniones': v?.reuniones || 0, 'Tareas': v?.tareas || 0 };
    }
    return { semana: label, 'Llamadas': s.llamadas, 'Reuniones': s.reuniones, 'Tareas': s.tareas };
  });

  const tooltipStyle = { contentStyle: { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }, labelStyle: { color: '#f9fafb' } };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-6">
      <div>
        <p className="text-xs text-gray-500 mb-2">Deals por semana</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dealsData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="semana" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Deals creados" fill="#6366f1" radius={[3,3,0,0]} />
              <Bar dataKey="Visitados"     fill="#eab308" radius={[3,3,0,0]} />
              <Bar dataKey="Ganados"       fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Actividades por semana</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={actData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="semana" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Llamadas"  fill="#a855f7" radius={[3,3,0,0]} />
              <Bar dataKey="Reuniones" fill="#14b8a6" radius={[3,3,0,0]} />
              <Bar dataKey="Tareas"    fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
