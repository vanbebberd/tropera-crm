const express = require('express');
const { search, dateFilter, getOwners, weekRange, weeksInRange, getDealStages } = require('../lib/hubspot');
const router = express.Router();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const SLEEP = 700; // ms entre llamadas a HubSpot search (límite: 4/seg)

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

// ── GET /api/hubspot/resumen?semanas=4&pipeline=all&desde=ts ────────────────
router.get('/resumen', async (req, res) => {
  try {
    const pipeline = req.query.pipeline || 'all';

    // Rango: modo explícito (desde) o por semanas
    let rangeStart, rangeEnd, weeksList;
    if (req.query.desde) {
      rangeStart = parseInt(req.query.desde);
      rangeEnd   = Date.now();
      weeksList  = weeksInRange(rangeStart, rangeEnd);
    } else {
      const semanas = Math.min(parseInt(req.query.semanas) || 4, 12);
      const oldest  = weekRange(semanas - 1);
      const newest  = weekRange(0);
      rangeStart = oldest.start;
      rangeEnd   = newest.end;
      weeksList  = Array.from({ length: semanas }, (_, w) => weekRange(w));
    }

    const [owners, allStages] = await Promise.all([getOwners(), getDealStages()]);
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));
    const stages = allStages[pipeline] || allStages.all;
    // Filtro extra por pipeline cuando se selecciona uno específico
    const pipelineFilter = stages.pipelineId
      ? [{ propertyName: 'pipeline', operator: 'EQ', value: stages.pipelineId }]
      : [];

    // Para won deals: ampliar el rango 30 días atrás como red de seguridad (deals con
    // closedate levemente desalineada) y usar hs_date_entered_* para el filtrado en JS
    const wonSafeStart = rangeStart - 30 * 24 * 60 * 60 * 1000;
    const wonDateProps  = stages.closedWonIds.map(id => `hs_date_entered_${id}`);

    const closedWonGroups = stages.closedWonIds.length
      ? stages.closedWonIds.map(id => [
          ...dateFilter('closedate', wonSafeStart, rangeEnd),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
        ])
      : [[...dateFilter('closedate', wonSafeStart, rangeEnd), { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }]];

    const visitadoGroups = stages.visitadoIds.length
      ? stages.visitadoIds.map(id => [
          ...dateFilter('createdate', rangeStart, rangeEnd),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
        ])
      : [[...dateFilter('createdate', rangeStart, rangeEnd)]];

    await sleep(SLEEP);

    const dealsCreadosAll = await search('deals',
      [...dateFilter('createdate', rangeStart, rangeEnd), ...pipelineFilter],
      ['createdate', 'closedate', 'dealstage', 'hubspot_owner_id', 'dealname', 'amount']);
    await sleep(SLEEP);

    const dealsGanadosAll = await search('deals', closedWonGroups,
      ['createdate', 'closedate', 'hubspot_owner_id', 'amount', ...wonDateProps]);
    await sleep(SLEEP);

    const dealsVisitadosAll = await search('deals', visitadoGroups,
      ['createdate', 'dealstage', 'hubspot_owner_id']);
    await sleep(SLEEP);

    const llamadasAll = await search('calls', dateFilter('hs_createdate', rangeStart, rangeEnd),
      ['hs_createdate', 'hubspot_owner_id', 'hs_call_status']);
    await sleep(SLEEP);

    const reunionesAll = await search('meetings', dateFilter('hs_createdate', rangeStart, rangeEnd),
      ['hs_createdate', 'hubspot_owner_id']);
    await sleep(SLEEP);

    const tareasAll = await search('tasks', [
      ...dateFilter('hs_createdate', rangeStart, rangeEnd),
      { propertyName: 'hs_task_status', operator: 'EQ', value: 'COMPLETED' },
    ], ['hs_createdate', 'hubspot_owner_id', 'hs_task_status']);
    await sleep(SLEEP);

    // Deals ganados últimos 90 días — ventana fija para calcular velocidad estable
    const vel90Start = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const vel90Groups = stages.closedWonIds.length
      ? stages.closedWonIds.map(id => [
          ...dateFilter('closedate', vel90Start, Date.now()),
          { propertyName: 'dealstage', operator: 'EQ', value: id },
          ...pipelineFilter,
        ])
      : [[...dateFilter('closedate', vel90Start, Date.now()), { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }]];
    const dealsVel90 = await search('deals', vel90Groups,
      ['createdate', 'closedate', 'hubspot_owner_id']);
    await sleep(SLEEP);

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

    // Fecha real de cierre: hs_date_entered_{stageId} → closedate (mismo criterio que /mensual)
    function getWonTs(d) {
      for (const id of stages.closedWonIds) {
        const raw = d.properties?.[`hs_date_entered_${id}`];
        if (raw) {
          const ts = typeof raw === 'string' && raw.includes('-') ? new Date(raw).getTime() : parseInt(raw);
          if (ts) return ts;
        }
      }
      return inRange(d.properties?.closedate, 0, Infinity)
        ? (typeof d.properties.closedate === 'string' && d.properties.closedate.includes('-')
            ? new Date(d.properties.closedate).getTime()
            : parseInt(d.properties.closedate))
        : null;
    }

    // En modo "desde" (mes en curso), la primera semana puede arrancar antes del día 1 del mes
    // → clampear su inicio al rangeStart real para que no cuente días del mes anterior
    if (req.query.desde && weeksList.length) {
      const oldest = weeksList[weeksList.length - 1];
      if (oldest.start < rangeStart) oldest.start = rangeStart;
    }

    // Filtrar por semana y calcular métricas en JS
    const result = [];

    weeksList.forEach(({ start, end, label }, i) => {
      const dealsCreados   = dealsCreadosAll.filter(d => inRange(d.properties?.createdate,  start, end));
      const dealsGanados   = dealsGanadosAll.filter(d => { const ts = getWonTs(d); return ts && ts >= start && ts <= end; });
      const dealsVisitados = dealsVisitadosAll.filter(d => inRange(d.properties?.createdate, start, end));
      const llamadas       = llamadasAll.filter(l => inRange(l.properties?.hs_createdate,   start, end));
      const reuniones      = reunionesAll.filter(r => inRange(r.properties?.hs_createdate,  start, end));
      const tareas         = tareasAll.filter(t   => inRange(t.properties?.hs_createdate,   start, end));

      const ganByOwner  = countByOwner(dealsGanados,   'hubspot_owner_id');
      const visByOwner  = countByOwner(dealsVisitados,  'hubspot_owner_id');
      const dcreByOwner = countByOwner(dealsCreados,    'hubspot_owner_id');
      const llamByOwner = countByOwner(llamadas,        'hubspot_owner_id');
      const reunByOwner = countByOwner(reuniones,       'hubspot_owner_id');
      const tarByOwner  = countByOwner(tareas,          'hubspot_owner_id');

      const porVendedor = owners.map(o => {
        const vel = velocidadRolling[o.id];
        const dc  = dcreByOwner[o.id] || 0;
        const dg  = ganByOwner[o.id]  || 0;
        return {
          id: o.id, nombre: o.name,
          dealsCreados:   dc,
          dealsVisitados: visByOwner[o.id]  || 0,
          dealsGanados:   dg,
          tasaExito: dc > 0 ? Math.round((dg / dc) * 100) : 0,
          llamadas:       llamByOwner[o.id] || 0,
          reuniones:      reunByOwner[o.id] || 0,
          tareas:         tarByOwner[o.id]  || 0,
          tareasVencidas: tarVenByOwner[o.id] || 0,
          velocidadDias:  vel ? Math.round(vel.total / vel.count) : null,
          velocidadDeals: vel ? vel.count : 0,
        };
      });

      const totalCreados = dealsCreados.length;
      const totalGanados = dealsGanados.length;

      result.push({
        semana: i, label, startTs: start, endTs: end,
        dealsCreados:   totalCreados,
        dealsGanados:   totalGanados,
        dealsVisitados: dealsVisitados.length,
        tasaExito: totalCreados > 0 ? Math.round((totalGanados / totalCreados) * 100) : 0,
        llamadas:  llamadas.length,
        reuniones: reuniones.length,
        tareas:    tareas.length,
        tareasVencidas: i === 0 ? tareasVencidasAll.length : null,
        porVendedor,
      });
    });

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
    const pipeline = req.query.pipeline || 'all';
    const [owners, allStages] = await Promise.all([getOwners(), getDealStages()]);
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));
    const stages = allStages[pipeline] || allStages.all;
    const pipelineFilter = stages.pipelineId
      ? [{ propertyName: 'pipeline', operator: 'EQ', value: stages.pipelineId }]
      : [];

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - meses + 1, 1).getTime();

    // Traer deals ganados por stage (sin filtro de fecha en HubSpot para no perder
    // deals con closedate mal configurada). Usamos hs_date_entered_{id} para saber
    // cuándo realmente pasó a ganado, con closedate como fallback.
    const wonDateProps = stages.closedWonIds.map(id => `hs_date_entered_${id}`);
    const mensualGroups = stages.closedWonIds.length
      ? stages.closedWonIds.map(id => [
          { propertyName: 'dealstage', operator: 'EQ', value: id },
          ...pipelineFilter,
        ])
      : [[{ propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }]];

    const deals = await search('deals', mensualGroups,
      ['closedate', 'hubspot_owner_id', 'amount', 'dealname', ...wonDateProps]);

    function parseTs(val) {
      if (!val) return null;
      return typeof val === 'string' && val.includes('-') ? new Date(val).getTime() : parseInt(val);
    }

    // Agrupar por mes usando la fecha de entrada al stage ganado (más confiable que closedate)
    const byMonth = {};
    deals.forEach(d => {
      // Elegir la mejor fecha disponible: hs_date_entered_* → closedate
      let ts = null;
      for (const id of stages.closedWonIds) {
        ts = parseTs(d.properties?.[`hs_date_entered_${id}`]);
        if (ts) break;
      }
      if (!ts) ts = parseTs(d.properties?.closedate);
      if (!ts || ts < start) return; // fuera del rango de visualización

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

// ── GET /api/hubspot/pipeline-stats?pipeline=all&diasInactividad=7 ────────────
router.get('/pipeline-stats', async (req, res) => {
  try {
    const pipeline = req.query.pipeline || 'all';
    const umbralDias = parseInt(req.query.diasInactividad) || 7;
    const umbralMs   = umbralDias * 24 * 60 * 60 * 1000;

    const [owners, allStages, pipelines] = await Promise.all([
      getOwners(),
      getDealStages(),
      require('../lib/hubspot').get('/crm/v3/pipelines/deals'),
    ]);
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));
    const stages   = allStages[pipeline] || allStages.all;

    // Mapa stage_id → label de etapa
    const stageLabels = {};
    (pipelines.results || []).forEach(p => {
      (p.stages || []).forEach(s => { stageLabels[s.id] = s.label; });
    });

    // IDs de todas las etapas no-cerradas (abiertas)
    const closedIds = new Set(stages.closedWonIds);
    const allOpenStageIds = Object.keys(stageLabels).filter(id => !closedIds.has(id));

    // Filtro de pipeline
    const pipelineFilter = stages.pipelineId
      ? [{ propertyName: 'pipeline', operator: 'EQ', value: stages.pipelineId }]
      : [];

    // ── Deals abiertos: inactividad + tiempo en etapa actual ─────────────────
    // hs_date_entered_{stageId} indica cuándo entró a esa etapa (más confiable que hs_time_in_*)
    const dateEnteredProps = allOpenStageIds.map(id => `hs_date_entered_${id}`);
    await sleep(SLEEP);
    const openDeals = await search('deals',
      [...pipelineFilter,
       { propertyName: 'hs_is_closed', operator: 'EQ', value: 'false' }],
      ['dealname', 'dealstage', 'hubspot_owner_id', 'hs_last_activity_date', 'createdate', ...dateEnteredProps]);

    const ahora = Date.now();

    function parseTs(val) {
      if (!val) return null;
      return typeof val === 'string' && val.includes('-') ? new Date(val).getTime() : parseInt(val);
    }

    // Deals sin actividad reciente
    const dealsInactivos = openDeals
      .filter(d => {
        const ts = parseTs(d.properties?.hs_last_activity_date);
        return !ts || (ahora - ts) > umbralMs;
      })
      .map(d => {
        const ts  = parseTs(d.properties?.hs_last_activity_date);
        const oid = String(d.properties?.hubspot_owner_id || '');
        return {
          id:    d.id,
          nombre: d.properties?.dealname || `Deal ${d.id}`,
          etapa:  stageLabels[d.properties?.dealstage] || d.properties?.dealstage || '—',
          owner:  ownerMap[oid] || oid || 'Sin asignar',
          ownerId: oid,
          diasSinActividad: ts ? Math.floor((ahora - ts) / 86400000) : null,
        };
      })
      .sort((a, b) => (b.diasSinActividad ?? 999) - (a.diasSinActividad ?? 999));

    // Tiempo promedio en etapa actual (por cada deal abierto, cuántos días lleva en su etapa)
    const tiempoAcum = {};
    openDeals.forEach(d => {
      const stageId = d.properties?.dealstage;
      if (!stageId || closedIds.has(stageId)) return;
      // Fecha en que entró a la etapa actual
      const enteredVal = d.properties?.[`hs_date_entered_${stageId}`];
      const entered    = parseTs(enteredVal) || parseTs(d.properties?.createdate);
      if (!entered) return;
      const dias = Math.floor((ahora - entered) / 86400000);
      if (!tiempoAcum[stageId]) tiempoAcum[stageId] = { total: 0, count: 0 };
      tiempoAcum[stageId].total += dias;
      tiempoAcum[stageId].count += 1;
    });

    const tiempoPorEtapa = Object.entries(tiempoAcum)
      .map(([id, { total, count }]) => ({
        etapa:        stageLabels[id] || id,
        promedioDias: Math.round(total / count),
        deals:        count,
      }))
      .filter(e => e.promedioDias > 0)
      .sort((a, b) => b.promedioDias - a.promedioDias);

    res.json({ dealsInactivos, tiempoPorEtapa, umbralDias });
  } catch (err) {
    console.error('[hubspot] pipeline-stats error:', err.message);
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
