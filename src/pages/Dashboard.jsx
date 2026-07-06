import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import KPICard from '../components/KPICard';
import VendedorTable from '../components/VendedorTable';
import SemanalChart from '../components/SemanalChart';
import VelocidadChart from '../components/VelocidadChart';
import MensualChart from '../components/MensualChart';

const SEMANAS_OPTIONS = [1, 4, 8, 12];

export default function Dashboard({ onLogout }) {
  const [data,        setData]        = useState(null);
  const [mensual,     setMensual]     = useState(null);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [semanas,     setSemanas]     = useState(4);
  const [ownerFiltro, setOwnerFiltro] = useState('todos');
  const [lastUpdate,  setLastUpdate]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [resumen, men] = await Promise.all([api.resumen(semanas), api.mensual(6)]);
      setData(resumen);
      setMensual(men);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [semanas]);

  useEffect(() => { load(); }, [load]);

  const semanaActual = data?.semanas?.[0];
  const owners       = data?.owners || [];
  const todos        = semanaActual?.porVendedor || [];
  const ownerNombre  = ownerFiltro === 'todos' ? null : owners.find(o => o.id === ownerFiltro)?.name;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="https://tropera.cl/wp-content/uploads/2025/09/logo-tropera-2025-1.svg" alt="Tropera" className="h-10 w-auto" />
          <h1 className="text-lg font-bold">Reporte CRM Tropera</h1>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && <span className="text-xs text-gray-500">Actualizado: {lastUpdate.toLocaleTimeString('es-CL')}</span>}
          <button onClick={load} disabled={loading} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
          <button onClick={onLogout} className="text-xs text-gray-400 hover:text-white transition-colors">Salir</button>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8 max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Selector de semanas */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Semanas:</span>
          {SEMANAS_OPTIONS.map(n => (
            <button key={n} onClick={() => setSemanas(n)}
              className={`px-3 py-1 rounded text-sm transition-colors ${semanas === n ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {n}
            </button>
          ))}
        </div>

        {/* ── RESUMEN GENERAL — siempre los totales ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Resumen semana actual
            {semanaActual?.label && <span className="text-orange-400 normal-case ml-2">({semanaActual.label})</span>}
          </h2>
          {loading && !data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="bg-gray-900 rounded-xl h-24 animate-pulse border border-gray-800" />)}
            </div>
          ) : semanaActual ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Contactos Creados"  value={semanaActual.contactosCreados} icon="👤" color="blue" />
              <KPICard label="Deals Creados"      value={semanaActual.dealsCreados}     icon="📋" color="indigo" />
              <KPICard label="Deals Visitados"    value={semanaActual.dealsVisitados}   icon="🏃" color="yellow" />
              <KPICard label="Deals Ganados"      value={semanaActual.dealsGanados}     icon="🏆" color="green" />
              <KPICard label="Tasa de Éxito"      value={`${semanaActual.tasaExito}%`}  icon="🎯" color="orange" />
              <KPICard label="Llamadas"           value={semanaActual.llamadas}         icon="📞" color="purple" />
              <KPICard label="Reuniones"          value={semanaActual.reuniones}        icon="🤝" color="teal" />
              <KPICard label="Tareas Completadas" value={semanaActual.tareas}           icon="✅" color="emerald" />
            </div>
          ) : null}
        </section>

        {/* ── TABLA VENDEDORES — siempre todos ── */}
        {todos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Por vendedor — semana actual
              </h2>
              {/* Filtro para gráficos */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Ver gráficos de:</span>
                <select
                  value={ownerFiltro}
                  onChange={e => setOwnerFiltro(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500"
                >
                  <option value="todos">Todos</option>
                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {ownerFiltro !== 'todos' && (
                  <button onClick={() => setOwnerFiltro('todos')} className="text-xs text-gray-500 hover:text-white">✕</button>
                )}
              </div>
            </div>
            <VendedorTable vendedores={todos} destacado={ownerFiltro} />
          </section>
        )}

        {/* ── GRÁFICOS — respetan el filtro ── */}
        {data?.semanas?.length > 1 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Evolución semanal
              {ownerNombre && <span className="text-blue-400 normal-case ml-2">— {ownerNombre}</span>}
            </h2>
            <SemanalChart semanas={data.semanas} ownerFiltro={ownerFiltro} />
          </section>
        )}

        {mensual && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Cierres ganados por mes
              {ownerNombre && <span className="text-blue-400 normal-case ml-2">— {ownerNombre}</span>}
            </h2>
            <MensualChart data={mensual.meses} vendedores={mensual.vendedores} ownerFiltro={ownerNombre} />
          </section>
        )}

        {todos.some(v => v.velocidadDias !== null) && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Velocidad de compra (días promedio)
            </h2>
            <VelocidadChart vendedores={todos} />
          </section>
        )}

        {/* ── HISTORIAL — respeta el filtro ── */}
        {data?.semanas?.length > 1 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Historial por semana
              {ownerNombre && <span className="text-blue-400 normal-case ml-2">— {ownerNombre}</span>}
            </h2>
            <HistorialTable semanas={data.semanas} ownerFiltro={ownerFiltro} />
          </section>
        )}
      </main>
    </div>
  );
}

function HistorialTable({ semanas, ownerFiltro }) {
  const filas = semanas.map(s => {
    if (ownerFiltro === 'todos') return s;
    const v = s.porVendedor?.find(v => v.id === ownerFiltro);
    return v ? { ...s, ...v } : { ...s, contactosCreados: 0, dealsCreados: 0, dealsVisitados: 0, dealsGanados: 0, tasaExito: 0, llamadas: 0, reuniones: 0, tareas: 0 };
  });

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Semana</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Contactos</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Deals</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Visitados</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Ganados</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Tasa</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Llamadas</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Reuniones</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Tareas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((s, i) => (
            <tr key={s.semana} className={`border-b border-gray-800/50 ${i === 0 ? 'bg-orange-900/10' : 'hover:bg-gray-800/20'}`}>
              <td className="px-4 py-3 font-medium">
                {i === 0 ? <span className="text-orange-400">Esta semana</span> : <span className="text-gray-300">Sem. {s.label}</span>}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{s.contactosCreados}</td>
              <td className="px-4 py-3 text-right text-gray-300">{s.dealsCreados}</td>
              <td className="px-4 py-3 text-right text-gray-300">{s.dealsVisitados}</td>
              <td className="px-4 py-3 text-right text-green-400 font-medium">{s.dealsGanados}</td>
              <td className="px-4 py-3 text-right">
                <span className={`font-medium ${s.tasaExito >= 50 ? 'text-green-400' : s.tasaExito >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {s.tasaExito}%
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{s.llamadas}</td>
              <td className="px-4 py-3 text-right text-gray-300">{s.reuniones}</td>
              <td className="px-4 py-3 text-right text-gray-300">{s.tareas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
