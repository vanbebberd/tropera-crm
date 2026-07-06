import React, { useState, useRef } from 'react';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#14b8a6'];

export default function VentasSection({ data, onRefresh, ownerFiltro, ownerNombre }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg('');
    const res = await api.uploadVentas(file);
    setUploading(false);
    if (res.ok) {
      setMsg(`✓ Cargado: ${res.semanas?.join(', ')} — ${res.vendedores} vendedores`);
      onRefresh();
    } else {
      setMsg(`Error: ${res.error}`);
    }
    e.target.value = '';
  }

  const semanas = data?.semanas || [];
  const todosVendedores = data?.vendedores || [];

  // Filtrar vendedores Excel por nombre cuando hay un filtro activo
  const vendedores = (() => {
    if (!ownerNombre || ownerFiltro === 'todos') return todosVendedores;
    const needle = ownerNombre.trim().toLowerCase();
    const found = todosVendedores.filter(v =>
      v.nombre.toLowerCase().includes(needle) ||
      needle.includes(v.nombre.toLowerCase().split(' ')[0])
    );
    return found.length > 0 ? found : todosVendedores;
  })();

  // Datos para gráfico de litros por semana
  const litrosChart = semanas.map((sem, i) => {
    const row = { semana: sem.replace(' 2026', '') };
    vendedores.forEach(v => { row[v.nombre.split(' ')[0]] = Math.round(v.litros[i] * 100) / 100; });
    return row;
  });

  // Datos para gráfico de clientes por semana
  const clientesChart = semanas.map((sem, i) => {
    const row = { semana: sem.replace(' 2026', '') };
    vendedores.forEach(v => { row[v.nombre.split(' ')[0]] = v.clientes[i]; });
    return row;
  });

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 },
    labelStyle: { color: '#f9fafb' },
  };

  return (
    <div className="space-y-6">
      {/* Header + Upload */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Ventas por semana — Excel
            {ownerNombre && ownerFiltro !== 'todos' && (
              <span className="text-blue-400 normal-case ml-2 font-normal">— {ownerNombre}</span>
            )}
          </h2>
          {data?.updatedAt && (
            <p className="text-xs text-gray-600 mt-1">
              Actualizado: {new Date(data.updatedAt).toLocaleString('es-CL')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button
            onClick={() => inputRef.current.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? 'Procesando...' : '↑ Subir Excel'}
          </button>
        </div>
      </div>

      {!vendedores.length ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">Sube el Excel de ventas para ver los datos aquí</p>
          <p className="text-gray-600 text-xs mt-1">Formato esperado: vendedor → categoría → cliente por semana</p>
        </div>
      ) : (
        <>
          {/* Tabla resumen por vendedor */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendedor</th>
                  {semanas.map(s => (
                    <th key={s} colSpan={3} className="text-center px-2 py-3 text-gray-400 font-medium border-l border-gray-800">
                      {s.replace(' 2026', '')}
                    </th>
                  ))}
                  <th colSpan={3} className="text-center px-2 py-3 text-orange-400 font-medium border-l border-gray-800">Total</th>
                </tr>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-2"></th>
                  {semanas.map(s => (
                    <React.Fragment key={s}>
                      <th className="text-right px-2 py-2 text-gray-500 text-xs font-normal border-l border-gray-800/50">Clientes</th>
                      <th className="text-right px-2 py-2 text-gray-500 text-xs font-normal">Cierres</th>
                      <th className="text-right px-2 py-2 text-gray-500 text-xs font-normal">Litros</th>
                    </React.Fragment>
                  ))}
                  <th className="text-right px-2 py-2 text-gray-500 text-xs font-normal border-l border-gray-800/50">Clientes</th>
                  <th className="text-right px-2 py-2 text-gray-500 text-xs font-normal">Cierres</th>
                  <th className="text-right px-2 py-2 text-gray-500 text-xs font-normal">Litros</th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v, vi) => {
                  const totalLitros   = v.litros.reduce((a, b) => a + b, 0);
                  const allClientes   = new Set();
                  v.clientes.forEach((c, i) => allClientes.add(c));
                  const totalClientes = v.clientes.reduce((a, b) => a + b, 0);
                  const totalCierres  = v.cierres.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={v.nombre} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: COLORS[vi % COLORS.length] + '33', color: COLORS[vi % COLORS.length] }}>
                            {v.nombre.charAt(0)}
                          </div>
                          {v.nombre}
                        </div>
                      </td>
                      {semanas.map((s, i) => (
                        <React.Fragment key={s}>
                          <td className="px-2 py-3 text-right text-blue-400 border-l border-gray-800/30">{v.clientes[i]}</td>
                          <td className="px-2 py-3 text-right text-green-400">{v.cierres[i]}</td>
                          <td className="px-2 py-3 text-right text-gray-300">{v.litros[i] ? v.litros[i].toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '—'}</td>
                        </React.Fragment>
                      ))}
                      <td className="px-2 py-3 text-right text-blue-300 font-medium border-l border-gray-800/50">{totalClientes}</td>
                      <td className="px-2 py-3 text-right text-green-300 font-medium">{totalCierres}</td>
                      <td className="px-2 py-3 text-right text-orange-400 font-bold">{totalLitros.toLocaleString('es-CL', { maximumFractionDigits: 1 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Gráfico litros por semana */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-3">Litros por vendedor por semana</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={litrosChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="semana" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {vendedores.map((v, i) => (
                    <Bar key={v.nombre} dataKey={v.nombre.split(' ')[0]} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico clientes por semana */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-3">Clientes activos por vendedor por semana</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientesChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="semana" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {vendedores.map((v, i) => (
                    <Bar key={v.nombre} dataKey={v.nombre.split(' ')[0]} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
