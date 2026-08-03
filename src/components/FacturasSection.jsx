import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function fmtRatio(va) {
  if (va == null) return '—';
  return va.toFixed(2) + 'x';
}

function variacion(curr, prev) {
  if (prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function DeltaBadge({ curr, prev }) {
  const pct = variacion(curr, prev);
  if (pct == null) return null;
  const positive = pct >= 0;
  return (
    <span className={`text-xs font-medium ml-1 ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, prev, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {prev != null && <DeltaBadge curr={parseNum(value)} prev={prev} />}
      </div>
      {prev != null && (
        <span className="text-xs text-gray-400">Anterior: {fmt(prev)}</span>
      )}
    </div>
  );
}

function parseNum(s) {
  if (typeof s === 'number') return s;
  return parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
}

export default function FacturasSection({ onUploaded }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const inputRef = useRef();

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.facturas();
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.uploadFacturas(file);
      if (res.error) throw new Error(res.error);
      // Recargar y actualizar cache localStorage
      const fresh = await api.facturas();
      setData(fresh);
      onUploaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }

  const current  = data?.current;
  const previous = data?.previous;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Facturas del Mes</h2>
        <div className="flex items-center gap-3">
          {current?.updatedAt && (
            <span className="text-xs text-gray-400">
              Actualizado {new Date(current.updatedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Cargando…' : current ? 'Actualizar Excel' : 'Subir Excel'}
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      {!current && !loading && !error && (
        <div className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          Sube un Excel con columnas: Nombre, Recaudado, Vencido, Abierto, V/A
        </div>
      )}

      {current && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Recaudado</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-green-600">{fmt(current.totales.recaudado)}</span>
                <DeltaBadge curr={current.totales.recaudado} prev={previous?.totales.recaudado} />
              </div>
              {previous && <span className="text-xs text-gray-400">Anterior: {fmt(previous.totales.recaudado)}</span>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Vencido</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-red-500">{fmt(current.totales.vencido)}</span>
                <DeltaBadge curr={current.totales.vencido} prev={previous?.totales.vencido} />
              </div>
              {previous && <span className="text-xs text-gray-400">Anterior: {fmt(previous.totales.vencido)}</span>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Abierto</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-yellow-500">{fmt(current.totales.abierto)}</span>
                <DeltaBadge curr={current.totales.abierto} prev={previous?.totales.abierto} />
              </div>
              {previous && <span className="text-xs text-gray-400">Anterior: {fmt(previous.totales.abierto)}</span>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 uppercase tracking-wide">V/A (Abierto ÷ Vencido)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-purple-500">
                  {fmtRatio(current.totales.va)}
                </span>
              </div>
              {previous && previous.totales.va != null && (
                <span className="text-xs text-gray-400">Anterior: {fmtRatio(previous.totales.va)}</span>
              )}
            </div>
          </div>

          {/* Tabla por cliente */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-right px-4 py-3">Recaudado</th>
                  <th className="text-right px-4 py-3">Vencido</th>
                  <th className="text-right px-4 py-3">Abierto</th>
                  <th className="text-right px-4 py-3">V/A</th>
                </tr>
              </thead>
              <tbody>
                {current.clientes.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{c.nombre}</td>
                    <td className="px-4 py-2 text-right text-green-600">{fmt(c.recaudado)}</td>
                    <td className="px-4 py-2 text-right text-red-500 font-semibold">{fmt(c.vencido)}</td>
                    <td className="px-4 py-2 text-right text-yellow-600">{fmt(c.abierto)}</td>
                    <td className="px-4 py-2 text-right text-purple-500">{fmtRatio(c.va)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-700/40 font-semibold">
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">Total</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmt(current.totales.recaudado)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmt(current.totales.vencido)}</td>
                  <td className="px-4 py-2 text-right text-yellow-700">{fmt(current.totales.abierto)}</td>
                  <td className="px-4 py-2 text-right text-purple-600">{fmtRatio(current.totales.va)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
