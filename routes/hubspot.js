const express = require('express');
const { search, dateFilter, getOwners, weekRange } = require('../lib/hubspot');
const router = express.Router();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function countByOwner(items, ownerProp) {
  return items.reduce((acc, item) => {
    const id = String(item.properties?.[ownerProp] || 'sin_asignar');
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

function inRange(ts, start, end) {
  if (!ts) return false;
  const t = typeof ts === 'string' && ts.includes('-') ? new Date(ts).getTime() : parseInt(ts);
  return t >= start && t <= end;
}

// ── GET /api/hubspot/resumen?semanas=4 ───────────────────────────────────────
router.get('/resumen', async (req, res) => {
  try {
    const semanas = Math.min(parseInt(req.query.semanas) || 4, 12);
    const oldest  = weekRange(semanas - 1);
    const newest  = weekRange(0);
    const rangeStart = oldest.start;
    const rangeEnd   = newest.end;

    const owners = await getOwners();
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));

    // 7 queries secuenciales con 300 ms de pausa (rate limit HubSpot: 5 req/s)
    const contactosAll = await search('contacts', dateFilter('createdate', rangeStart, rangeEnd),
      ['createdate', 'hubspot_owner_id', 'firstname', 'lastname']);
    await sleep(300);

    const dealsCreadosAll = await search('deals', dateFilter('createdate', rangeStart, rangeEnd),
      ['createdate', 'closedate', 'dealstage', 'hubspot_owner_id', 'dealname', 'amount']);
    await sleep(300);

    const dealsGanadosAll = await search('deals', [
      ...dateFilter('closedate', rangeStart, rangeEnd),
      { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' },
    ], ['createdate', 'closedate', 'hubspot_owner_id', 'amount']);
    await sleep(300);

    const dealsVisitadosAll = await search('deals', [
      ...dateFilter('createdate', rangeStart, rangeEnd),
      { propertyName: 'dealstage', operator: 'CONTAINS_TOKEN', value: 'visit' },
    ], ['createdate', 'dealstage', 'hubspot_owner_id']);
    await sleep(300);

    const llamadasAll = await search('calls', dateFilter('hs_createdate', rangeStart, rangeEnd),
      ['hs_createdate', 'hubspot_owner_id', 'hs_call_status']);
    await sleep(300);

    const reunionesAll = await search('meetings', dateFilter('hs_createdate', rangeStart, rangeEnd),
      ['hs_createdate', 'hubspot_owner_id']);
    await sleep(300);

    const tareasAll = await search('tasks', [
      ...dateFilter('hs_createdate', rangeStart, rangeEnd),
      { propertyName: 'hs_task_status', operator: 'EQ', value: 'COMPLETED' },
    ], ['hs_createdate', 'hubspot_owner_id', 'hs_task_status']);

    // Filtrar por semana y calcular métricas en JS
    const result = [];

    for (let w = 0; w < semanas; w++) {
      const { start, end, label } = weekRange(w);

      const contactosCreados = contactosAll.filter(c => inRange(c.properties?.createdate,    start, end));
      const dealsCreados     = dealsCreadosAll.filter(d => inRange(d.properties?.createdate,  start, end));
      const dealsGanados     = dealsGanadosAll.filter(d => inRange(d.properties?.closedate,   start, end));
      const dealsVisitados   = dealsVisitadosAll.filter(d => inRange(d.properties?.createdate, start, end));
      const llamadas         = llamadasAll.filter(l => inRange(l.properties?.hs_createdate,   start, end));
      const reuniones        = reunionesAll.filter(r => inRange(r.properties?.hs_createdate,  start, end));
      const tareas           = tareasAll.filter(t   => inRange(t.properties?.hs_createdate,   start, end));

      // Velocidad de compra por owner
      const velocidad = {};
      dealsGanados.forEach(d => {
        const oid     = String(d.properties?.hubspot_owner_id || 'sin_asignar');
        const name    = ownerMap[oid] || oid;
        const created = new Date(d.properties?.createdate || 0).getTime();
        const closed  = new Date(d.properties?.closedate  || 0).getTime();
        if (created && closed > created) {
          const days = Math.round((closed - created) / 86400000);
          if (!velocidad[name]) velocidad[name] = { total: 0, count: 0 };
          velocidad[name].total += days;
          velocidad[name].count += 1;
        }
      });

      const ganByOwner  = countByOwner(dealsGanados,    'hubspot_owner_id');
      const creaByOwner = countByOwner(contactosCreados, 'hubspot_owner_id');
      const visByOwner  = countByOwner(dealsVisitados,   'hubspot_owner_id');
      const dcreByOwner = countByOwner(dealsCreados,     'hubspot_owner_id');
      const llamByOwner = countByOwner(llamadas,         'hubspot_owner_id');
      const reunByOwner = countByOwner(reuniones,        'hubspot_owner_id');
      const tarByOwner  = countByOwner(tareas,           'hubspot_owner_id');

      const porVendedor = owners.map(o => {
        const vel = velocidad[o.name];
        const dc  = dcreByOwner[o.id] || 0;
        const dg  = ganByOwner[o.id]  || 0;
        return {
          id: o.id,
          nombre: o.name,
          contactosCreados: creaByOwner[o.id] || 0,
          dealsCreados:     dc,
          dealsVisitados:   visByOwner[o.id]  || 0,
          dealsGanados:     dg,
          tasaExito: dc > 0 ? Math.round((dg / dc) * 100) : 0,
          llamadas:         llamByOwner[o.id] || 0,
          reuniones:        reunByOwner[o.id] || 0,
          tareas:           tarByOwner[o.id]  || 0,
          velocidadDias: vel ? Math.round(vel.total / vel.count) : null,
        };
      }).filter(v => v.dealsGanados + v.contactosCreados + v.llamadas + v.reuniones + v.tareas > 0);

      const totalCreados = dealsCreados.length;
      const totalGanados = dealsGanados.length;

      result.push({
        semana: w, label,
        contactosCreados: contactosCreados.length,
        dealsCreados:     totalCreados,
        dealsGanados:     totalGanados,
        dealsVisitados:   dealsVisitados.length,
        tasaExito: totalCreados > 0 ? Math.round((totalGanados / totalCreados) * 100) : 0,
        llamadas:  llamadas.length,
        reuniones: reuniones.length,
        tareas:    tareas.length,
        porVendedor,
      });
    }

    res.json({ semanas: result, owners });
  } catch (err) {
    console.error('[hubspot] resumen error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hubspot/mensual?meses=6 ─────────────────────────────────────────
router.get('/mensual', async (req, res) => {
  try {
    const meses = Math.min(parseInt(req.query.meses) || 6, 12);
    const owners = await getOwners();
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - meses + 1, 1).getTime();
    const end   = now.getTime();

    const deals = await search('deals', [
      ...dateFilter('closedate', start, end),
      { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' },
    ], ['closedate', 'hubspot_owner_id', 'amount', 'dealname']);

    // Agrupar por mes (YYYY-MM)
    const byMonth = {};
    deals.forEach(d => {
      const ts    = parseInt(d.properties?.closedate || 0);
      const oid   = String(d.properties?.hubspot_owner_id || 'sin_asignar');
      const name  = ownerMap[oid] || oid;
      const date  = new Date(ts);
      const key   = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
      if (!byMonth[key]) byMonth[key] = { key, label, total: 0, porVendedor: {} };
      byMonth[key].total += 1;
      byMonth[key].porVendedor[name] = (byMonth[key].porVendedor[name] || 0) + 1;
    });

    // Rellenar meses sin datos y ordenar
    const result = [];
    for (let m = meses - 1; m >= 0; m--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
      result.push(byMonth[key] || { key, label: lbl, total: 0, porVendedor: {} });
    }

    const vendedores = [...new Set(deals.map(d => ownerMap[String(d.properties?.hubspot_owner_id)] || 'Sin asignar'))];
    res.json({ meses: result, vendedores, owners });
  } catch (err) {
    console.error('[hubspot] mensual error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/owners', async (req, res) => {
  try { res.json(await getOwners()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
