import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import KPICard from '../components/KPICard';
import VendedorTable from '../components/VendedorTable';
import SemanalChart from '../components/SemanalChart';
import VelocidadChart from '../components/VelocidadChart';
import MensualChart from '../components/MensualChart';
import VentasSection from '../components/VentasSection';
import VendedorCards from '../components/VendedorCards';
import ClientesInsights from '../components/ClientesInsights';
import PipelineStats from '../components/PipelineStats';

const PERIODO_OPTIONS = [
  { id: 'esta_semana',  label: 'Esta semana' },
  { id: 'sem_pasada',   label: 'Sem. pasada' },
  { id: 'mes_en_curso', label: 'Mes en curso' },
];

function primerDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// Suma todas las semanas en un solo objeto de KPIs (para "Mes en curso")
function sumSemanas(semanas) {
  if (!semanas?.length) return null;
  const week0 = semanas[0]; // más reciente: para snapshots (tareasVencidas, velocidad)
  const totalCreados = semanas.reduce((s, w) => s + (w.dealsCreados   || 0), 0);
  const totalGanados = semanas.reduce((s, w) => s + (w.dealsGanados   || 0), 0);

  // Suma métricas por vendedor a través de todas las semanas
  const vMap = {};
  semanas.forEach(w => {
    (w.porVendedor || []).forEach(v => {
      if (!vMap[v.id]) vMap[v.id] = { ...v, dealsCreados: 0, dealsGanados: 0, dealsVisitados: 0, llamadas: 0, reuniones: 0, tareas: 0 };
      vMap[v.id].dealsCreados   += v.dealsCreados   || 0;
      vMap[v.id].dealsGanados   += v.dealsGanados   || 0;
      vMap[v.id].dealsVisitados += v.dealsVisitados || 0;
      vMap[v.id].llamadas       += v.llamadas       || 0;
      vMap[v.id].reuniones      += v.reuniones      || 0;
      vMap[v.id].tareas         += v.tareas         || 0;
      // snapshots de la semana más reciente
      vMap[v.id].tareasVencidas = week0.porVendedor?.find(p => p.id === v.id)?.tareasVencidas ?? vMap[v.id].tareasVencidas;
      if (v.velocidadDias !== null) { vMap[v.id].velocidadDias = v.velocidadDias; vMap[v.id].velocidadDeals = v.velocidadDeals; }
    });
  });
  const porVendedor = Object.values(vMap).map(v => ({
    ...v, tasaExito: v.dealsCreados > 0 ? Math.round((v.dealsGanados / v.dealsCreados) * 100) : 0,
  }));

  return {
    ...week0,
    dealsCreados:   totalCreados,
    dealsGanados:   totalGanados,
    dealsVisitados: semanas.reduce((s, w) => s + (w.dealsVisitados || 0), 0),
    llamadas:       semanas.reduce((s, w) => s + (w.llamadas       || 0), 0),
    reuniones:      semanas.reduce((s, w) => s + (w.reuniones      || 0), 0),
    tareas:         semanas.reduce((s, w) => s + (w.tareas         || 0), 0),
    tasaExito: totalCreados > 0 ? Math.round((totalGanados / totalCreados) * 100) : 0,
    tareasVencidas: week0.tareasVencidas,
    porVendedor,
  };
}

export default function Dashboard({ onLogout }) {
  const [data,          setData]          = useState(null);
  const [mensual,       setMensual]       = useState(null);
  const [ventas,        setVentas]        = useState(null);
  const [pipeStats,     setPipeStats]     = useState(null);
  const [pipeLoading,   setPipeLoading]   = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [periodo,       setPeriodo]       = useState('esta_semana');
  const [pipeline,      setPipeline]      = useState('all');
  const [ownerFiltro,   setOwnerFiltro]   = useState('todos');
  const [lastUpdate,    setLastUpdate]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const desde = periodo === 'mes_en_curso' ? primerDiaMes() : null;
      const semanas = periodo === 'sem_pasada' ? 2 : 1;
      const resumen = await api.resumen(semanas, pipeline, desde);
      setData(resumen);
      const [men, ven] = await Promise.all([api.mensual(6, pipeline), api.ventas()]);
      setMensual(men);
      setVentas(ven);
      setLastUpdate(new Date());
      // Pipeline stats se carga aparte para no bloquear la UI principal
      setPipeLoading(true);
      api.pipelineStats(pipeline, 14).then(ps => { setPipeStats(ps); setPipeLoading(false); })
        .catch(() => setPipeLoading(false));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [periodo, pipeline]);

  useEffect(() => { load(); }, [load]);

  // semanaActual: semana 0 (esta sem), semana 1 (sem pasada), o suma del mes
  const semanaActual = (() => {
    if (!data?.semanas?.length) return null;
    if (periodo === 'mes_en_curso') return sumSemanas(data.semanas);
    if (periodo === 'sem_pasada')   return data.semanas[1] || data.semanas[0];
    return data.semanas[0];
  })();

  const owners     = data?.owners || [];
  const allVendors = semanaActual?.porVendedor || [];
  const todos      = allVendors.filter(v =>
    v.dealsGanados + v.dealsCreados + v.dealsVisitados + v.llamadas + v.reuniones + v.tareas + v.tareasVencidas > 0
  );
  const ownerNombre = ownerFiltro === 'todos' ? null : owners.find(o => o.id === ownerFiltro)?.name;

  const kpis = (() => {
    if (!semanaActual) return null;
    if (ownerFiltro === 'todos') return semanaActual;
    const v = allVendors.find(v => String(v.id) === String(ownerFiltro));
    return v ? { ...semanaActual, ...v } : semanaActual;
  })();

  const velocidadInfo = (() => {
    const conDatos = allVendors.filter(v => v.velocidadDias !== null);
    if (!conDatos.length) return null;
    const promedio = Math.round(conDatos.reduce((s, v) => s + v.velocidadDias, 0) / conDatos.length);
    return { promedio, count: conDatos.length, nombre: conDatos.length === 1 ? conDatos[0].nombre.split(' ')[0] : null };
  })();

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

        {/* Controles: pipeline + semanas + filtro propietario */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Toggle de pipeline */}
          <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg p-0.5 gap-0.5">
            {[
              { key: 'all',     label: 'Ambas' },
              { key: 'tropera', label: 'Tropera' },
              { key: 'bennies', label: "Beni's" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => { setPipeline(key); setOwnerFiltro('todos'); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pipeline === key ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg p-0.5 gap-0.5">
            {PERIODO_OPTIONS.map(({ id, label }) => (
              <button key={id} onClick={() => { setPeriodo(id); setOwnerFiltro('todos'); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${periodo === id ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-400">Vendedor:</span>
            <select
              value={ownerFiltro}
              onChange={e => setOwnerFiltro(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-500"
            >
              <option value="todos">Todos</option>
              {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {ownerFiltro !== 'todos' && (
              <button onClick={() => setOwnerFiltro('todos')} className="text-xs text-gray-500 hover:text-white">✕</button>
            )}
          </div>
        </div>

        {/* ── KPIs — totales o por vendedor si hay filtro ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {periodo === 'mes_en_curso' ? 'Resumen mes en curso' : periodo === 'sem_pasada' ? 'Resumen semana pasada' : 'Resumen semana actual'}
            {periodo !== 'mes_en_curso' && semanaActual?.label && <span className="text-orange-400 normal-case ml-2">({semanaActual.label})</span>}
            {periodo === 'mes_en_curso' && <span className="text-orange-400 normal-case ml-2">({new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })})</span>}
            {ownerNombre && <span className="text-blue-400 normal-case ml-2">— {ownerNombre}</span>}
          </h2>
          {loading && !data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="bg-gray-900 rounded-xl h-24 animate-pulse border border-gray-800" />)}
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Deals Creados"      value={kpis.dealsCreados}     icon="📋" color="indigo" />
              <KPICard label="Deals Visitados"    value={kpis.dealsVisitados}   icon="🏃" color="yellow" />
              <KPICard label="Deals Ganados"      value={kpis.dealsGanados}     icon="🏆" color="green" />
              <KPICard label="Tasa de Éxito"      value={`${kpis.tasaExito}%`}  icon="🎯" color="orange" />
              <KPICard label="Llamadas"           value={kpis.llamadas}         icon="📞" color="purple" />
              <KPICard label="Reuniones"          value={kpis.reuniones}        icon="🤝" color="teal" />
              <KPICard label="Tareas Completadas" value={kpis.tareas}           icon="✅" color="emerald" />
              {ownerFiltro === 'todos'
                ? (velocidadInfo != null && (
                    <KPICard
                      label="Velocidad de Cierre"
                      value={`${velocidadInfo.promedio}d`}
                      icon="⚡"
                      color="yellow"
                      sub={velocidadInfo.nombre
                        ? `solo ${velocidadInfo.nombre} · 90d`
                        : `${velocidadInfo.count} vendedores · 90d`}
                    />
                  ))
                : (kpis.velocidadDias != null && <KPICard label="Velocidad de Cierre" value={`${kpis.velocidadDias}d`} icon="⚡" color="yellow" sub={kpis.velocidadDeals ? `${kpis.velocidadDeals} deals · 90d` : '90d'} />)
              }
              {semanaActual?.tareasVencidas != null && (
                <KPICard label="Tareas Vencidas" value={ownerFiltro === 'todos' ? semanaActual.tareasVencidas : (kpis.tareasVencidas ?? 0)} icon="⏰" color="red" />
              )}
            </div>
          ) : null}

          {/* Tarjetas por vendedor — solo cuando se ven todos */}
          {ownerFiltro === 'todos' && todos.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                Actividades por vendedor — semana actual
                <span className="ml-2 text-gray-600 normal-case font-normal">· haz clic en una tarjeta para filtrar</span>
              </p>
              <VendedorCards vendedores={todos} onSelect={setOwnerFiltro} />
            </div>
          )}
        </section>

        {/* ── TABLA VENDEDORES — siempre todos ── */}
        {todos.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Por vendedor — semana actual
            </h2>
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

        {/* ── VENTAS DESDE EXCEL — solo Tropera o Ambas ── */}
        {pipeline !== 'bennies' && (
          <section>
            <VentasSection
              data={ventas}
              onRefresh={() => api.ventas().then(setVentas)}
              ownerFiltro={ownerFiltro}
              ownerNombre={ownerNombre}
            />
          </section>
        )}

        {/* ── TOP CLIENTES + EN RIESGO — solo si hay datos Excel ── */}
        {pipeline !== 'bennies' && ventas?.vendedores?.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Clientes
              {ownerNombre && <span className="text-blue-400 normal-case ml-2">— {ownerNombre}</span>}
            </h2>
            <ClientesInsights
              vendedores={ventas.vendedores}
              ownerFiltro={ownerFiltro}
              ownerNombre={ownerNombre}
            />
          </section>
        )}

        {/* ── PIPELINE STATS — deals inactivos + tiempo por etapa ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Pipeline — actividad y tiempos
            {ownerNombre && <span className="text-blue-400 normal-case ml-2">— {ownerNombre}</span>}
          </h2>
          <PipelineStats data={pipeStats} loading={pipeLoading} ownerFiltro={ownerFiltro} />
        </section>

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
    return v ? { ...s, ...v } : { ...s, dealsCreados: 0, dealsVisitados: 0, dealsGanados: 0, tasaExito: 0, llamadas: 0, reuniones: 0, tareas: 0 };
  });

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Semana</th>
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
