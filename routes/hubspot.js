const express = require('express');
const { search, dateFilter, getOwners, weekRange, getDealStages } = require('../lib/hubspot');
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

    const [owners, stages] = await Promise.all([getOwners(), getDealStages()]);
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));

    // filterGroups = array de arrays → HubSpot los une con OR (un grupo por stage)
    const closedWonGroups = stages.closedWonIds.length
      ? stages.closedWonIds.map(id => [
          ...dateFilter('closedate', rangeStart, rangeEnd),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
        ])
      : [[...dateFilter('closedate', rangeStart, rangeEnd), { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }]];

    const visitadoGroups = stages.visitadoIds.length
      ? stages.visitadoIds.map(id => [
          ...dateFilter('createdate', rangeStart, rangeEnd),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
        ])
      : [[...dateFilter('createdate', rangeStart, rangeEnd)]];

    await sleep(300);

    const contactosAll = await search('contacts', dateFilter('createdate', rangeStart, rangeEnd),
      ['createdate', 'hubspot_owner_id', 'firstname', 'lastname']);
    await sleep(300);

    const dealsCreadosAll = await search('deals', dateFilter('createdate', rangeStart, rangeEnd),
      ['createdate', 'closedate', 'dealstage', 'hubspot_owner_id', 'dealname', 'amount']);
    await sleep(300);

    const dealsGanadosAll = await search('deals', closedWonGroups,
      ['createdate', 'closedate', 'hubspot_owner_id', 'amount']);
    await sleep(300);

    const dealsVisitadosAll = await search('deals', visitadoGroups,
      ['createdate', 'dealstage', 'hubspot_owner_id']);
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
    await sleep(300);

    // Deals ganados últimos 90 días — ventana fija para calcular velocidad estable
    const vel90Start = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const vel90Groups = stages.closedWonIds.length
      ? stages.closedWonIds.map(id => [
          ...dateFilter('closedate', vel90Start, Date.now()),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
        ])
      : [[...dateFilter('closedate', vel90Start, Date.now()), { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }]];
    const dealsVel90 = await search('deals', vel90Groups,
      ['createdate', 'closedate', 'hubspot_owner_id']);
    await sleep(300);

    // Velocidad rolling 90d por owner (días promedio creación → cierre)
    // closedate en HubSpot es medianoche UTC del día, createdate es timestamp exacto
    // → closedate puede ser < createdate si se cerró el mismo día de creación → usamos Math.max(0, days)
    const velocidadRolling = {};
    dealsVel90.forEach(d => {
      const oid     = String(d.properties?.hubspot_owner_id || 'sin_asignar');
      const created = new Date(d.properties?.createdate || 0).getTime();
      const closed  = new Date(d.properties?.closedate  || 0).getTime();
      if (created && closed) {
        const days = Math.max(0, Math.round((closed - created) / 86400000));
        if (!velocidadRolling[oid]) velocidadRolling[oid] = { total: 0, count: 0 };
        velocidadRolling[oid].total += days;
        velocidadRolling[oid].count += 1;
      }
    });

    // Tareas vencidas: snapshot actual (sin filtro de fecha, no completadas con fecha pasada)
    const tareasVencidasAll = await search('tasks', [
      { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' },
      { propertyName: 'hs_timestamp', operator: 'LT', value: String(Date.now()) },
    ], ['hs_timestamp', 'hubspot_owner_id', 'hs_task_status', 'hs_task_subject']);

    const tarVenByOwner = countByOwner(tareasVencidasAll, 'hubspot_owner_id');

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

      const ganByOwner  = countByOwner(dealsGanados,    'hubspot_owner_id');
      const creaByOwner = countByOwner(contactosCreados, 'hubspot_owner_id');
      const visByOwner  = countByOwner(dealsVisitados,   'hubspot_owner_id');
      const dcreByOwner = countByOwner(dealsCreados,     'hubspot_owner_id');
      const llamByOwner = countByOwner(llamadas,         'hubspot_owner_id');
      const reunByOwner = countByOwner(reuniones,        'hubspot_owner_id');
      const tarByOwner  = countByOwner(tareas,           'hubspot_owner_id');

      const porVendedor = owners.map(o => {
        const vel = velocidadRolling[o.id];
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
          tareasVencidas:   tarVenByOwner[o.id] || 0,
          velocidadDias: vel ? Math.round(vel.total / vel.count) : null,
          velocidadDeals:   vel ? vel.count : 0,
        };
      }); // sin filtro — todos los owners quedan para que el lookup por ID siempre funcione

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
        tareasVencidas: w === 0 ? tareasVencidasAll.length : null,
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
    const [owners, stages] = await Promise.all([getOwners(), getDealStages()]);
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - meses + 1, 1).getTime();
    const end   = now.getTime();

    const mensualGroups = stages.closedWonIds.length
      ? stages.closedWonIds.map(id => [
          ...dateFilter('closedate', start, end),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
        ])
      : [[...dateFilter('closedate', start, end), { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }]];

    const deals = await search('deals', mensualGroups,
      ['closedate', 'hubspot_owner_id', 'amount', 'dealname']);

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

// ── GET /api/hubspot/debug — diagnóstico de stages y deals recientes ──────────
router.get('/debug', async (req, res) => {
  try {
    const { get, getDealStages, getOwners } = require('../lib/hubspot');
    const [stages, owners, pipelines] = await Promise.all([
      getDealStages(), getOwners(), get('/crm/v3/pipelines/deals'),
    ]);
    res.json({
      stages,
      owners,
      pipelines: (pipelines.results || []).map(p => ({
        id: p.id, label: p.label,
        stages: (p.stages || []).map(s => ({ id: s.id, label: s.label, probability: s.metadata?.probability }))
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
