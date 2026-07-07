const BASE = '/api';

function getToken() { return localStorage.getItem('hs_token') || ''; }

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (res.status === 401) { localStorage.removeItem('hs_token'); window.location.href = '/login'; }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  login:   (username, password) =>
    fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      .then(r => r.json()),
  resumen: (semanas = 4) => req(`/hubspot/resumen?semanas=${semanas}&_=${Date.now()}`),
  mensual: (meses = 6)   => req(`/hubspot/mensual?meses=${meses}&_=${Date.now()}`),
  owners:  ()            => req('/hubspot/owners'),
  ventas: async () => {
    const data = await req('/ventas');
    if (data?.vendedores?.length) {
      localStorage.setItem('ventas_cache', JSON.stringify(data));
      return data;
    }
    const cached = localStorage.getItem('ventas_cache');
    return cached ? JSON.parse(cached) : data;
  },
  uploadVentas: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/ventas/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(r => r.json());
    if (res.ok && res.data) {
      localStorage.setItem('ventas_cache', JSON.stringify(res.data));
    }
    return res;
  },
};
