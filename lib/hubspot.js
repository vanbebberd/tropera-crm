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

async function search(objectType, filters, properties) {
  const fetch = (await import('node-fetch')).default;
  const results = [];
  let after = undefined;

  do {
    const body = JSON.stringify({
      filterGroups: [{ filters }],
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

module.exports = { get, search, dateFilter, getOwners, weekRange };
