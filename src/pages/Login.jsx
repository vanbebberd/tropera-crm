import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    const data = await api.login(user, pass);
    setLoading(false);
    if (data.token) { localStorage.setItem('hs_token', data.token); onLogin(); }
    else setError(data.error || 'Error al iniciar sesión');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <form onSubmit={submit} className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm shadow-xl border border-gray-800 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <img src="https://tropera.cl/wp-content/uploads/2025/09/logo-tropera-2025-1.svg" alt="Tropera" className="h-12 w-auto" />
          <h1 className="text-lg font-bold text-white">Reporte CRM Tropera</h1>
        </div>
        {error && <p className="text-red-400 text-sm bg-red-900/30 rounded px-3 py-2">{error}</p>}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Usuario</label>
          <input value={user} onChange={e => setUser(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" required />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Contraseña</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 font-medium transition-colors disabled:opacity-50">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
