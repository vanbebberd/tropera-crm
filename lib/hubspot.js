const BASE = 'https://api.hubapi.com';

function token() {
  const t = process.env.HUBSPOT_TOKEN;
  if (!t) throw new Error('HUBSPOT_TOKEN no configurado en .env');
  return t;
}

function headers() {
  return { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
}

async function get(path, params = {}) {
  const fetch = (await import('node-fetch')).default;
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${BASE}${path}${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`HubSpot ${res.status} ${path}: ${await res.text()}`);
  return res.json();
}

// filtersInput: array plano de filtros (un grupo) O array de arrays (múltiples grupos = OR)
async function search(objectType, filtersInput, properties) {
  const fetch = (await import('node-fetch')).default;
  const results = [];
  let after = undefined;

  const filterGroups = filtersInput.length > 0 && Array.isArray(filtersInput[0])
    ? filtersInput.map(f => ({ filters: f }))
    : [{ filters: filtersInput }];

  do {
    const body = JSON.stringify({
      filterGroups,
      properties,
      limit: 200,
      ...(after ? { after } : {}),
    });
    const res = await fetch(`${BASE}/crm/v3/objects/${objectType}/search`, {
      method: 'POST', headers: headers(), body,
    });
    if (!res.ok) throw new Error(`HubSpot search ${objectType} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    results.push(...(data.results || []));
    after = data.paging?.next?.after;
  } while (after);

  return results;
}

function dateFilter(prop, start, end) {
  return [
    { propertyName: prop, operator: 'GTE', value: String(start) },
    { propertyName: prop, operator: 'LTE', value: String(end) },
  ];
}

async function getOwners() {
  const data = await get('/crm/v3/owners', { limit: 100 });
  return (data.results || []).map(o => ({
    id: String(o.id),
    name: `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email || `Owner ${o.id}`,
    email: o.email || '',
  }));
}

function weekRange(weeksAgo = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day) - weeksAgo * 7;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  return {
    start: mon.getTime(),
    end: sun.getTime(),
    label: mon.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
  };
}

// Cache de stage IDs por pipeline (se resuelve una vez por proceso)
// Devuelve { all, tropera, bennies } cada uno con { closedWonIds, visitadoIds }
let _stageCache = null;
async function getDealStages() {
  if (_stageCache) return _stageCache;
  const data = await get('/crm/v3/pipelines/deals');
  const allClosed = [], allVisitado = [];
  const byPipeline = {};

  (data.results || []).forEach(p => {
    const closed = [], visitado = [];
    (p.stages || []).forEach(s => {
      const prob = parseFloat(s.metadata?.probability || 0);
      if (prob >= 0.99)                    { closed.push(s.id);  allClosed.push(s.id); }
      else if (prob >= 0.3 && prob < 0.99) { visitado.push(s.id); allVisitado.push(s.id); }
    });
    const lbl = (p.label || '').toLowerCase();
    const key = lbl.includes('beni') ? 'bennies' : lbl.includes('tropera') ? 'tropera' : p.id;
    byPipeline[key] = { closedWonIds: closed, visitadoIds: visitado };
  });

  _stageCache = { ...byPipeline, all: { closedWonIds: allClosed, visitadoIds: allVisitado } };
  return _stageCache;
}

module.exports = { get, search, dateFilter, getOwners, weekRange, getDealStages };
