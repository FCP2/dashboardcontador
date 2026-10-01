const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada en Netlify.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }

  return pool;
}

exports.handler = async () => {
  try {
    const db = getPool();
    const eventResult = await db.query(`
      SELECT id, nombre, capacidad, folios_reservados, registros_abiertos
      FROM eventos
      ORDER BY id DESC
      LIMIT 1
    `);
    const event = eventResult.rows[0];

    if (!event) {
      return json(404, { error: 'No hay un evento disponible.' });
    }

    const [summary, categories, profile, sizes, municipalities, recent] = await Promise.all([
      db.query(`
        SELECT
          COUNT(r.id)::INTEGER AS total,
          COUNT(r.id) FILTER (WHERE r.estatus = 'confirmado')::INTEGER AS confirmados,
          COUNT(r.id) FILTER (WHERE r.estatus = 'pendiente_confirmacion')::INTEGER AS pendientes,
          COUNT(r.id) FILTER (WHERE p.es_menor_edad IS TRUE)::INTEGER AS menores,
          COUNT(r.id) FILTER (WHERE p.identidad_lgbtiq = 'si')::INTEGER AS lgbtiq_si
        FROM registros r
        INNER JOIN participantes p ON p.id = r.participante_id
        WHERE r.evento_id = $1
      `, [event.id]),
      db.query(`
        SELECT p.categoria_competencia AS categoria,
               COUNT(r.id)::INTEGER AS total,
               COUNT(r.id) FILTER (WHERE r.estatus = 'confirmado')::INTEGER AS confirmados,
               COUNT(r.id) FILTER (WHERE r.estatus = 'pendiente_confirmacion')::INTEGER AS pendientes,
               COALESCE(MAX(ce.capacidad), 0)::INTEGER AS meta
        FROM registros r
        INNER JOIN participantes p ON p.id = r.participante_id
        LEFT JOIN cupos_evento ce
          ON ce.evento_id = r.evento_id
         AND ce.categoria = p.categoria_competencia
         AND ce.activo = TRUE
        WHERE r.evento_id = $1
        GROUP BY p.categoria_competencia
        ORDER BY p.categoria_competencia
      `, [event.id]),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE p.identidad_lgbtiq IS NULL)::INTEGER AS lgbtiq_sin_respuesta
        FROM registros r
        INNER JOIN participantes p ON p.id = r.participante_id
        WHERE r.evento_id = $1
      `, [event.id]),
      db.query(`
        SELECT r.talla, COUNT(*)::INTEGER AS total
        FROM registros r
        WHERE r.evento_id = $1
        GROUP BY r.talla
        ORDER BY CASE r.talla WHEN 'CH' THEN 1 WHEN 'M' THEN 2 WHEN 'G' THEN 3 WHEN 'XG' THEN 4 ELSE 5 END
      `, [event.id]),
      db.query(`
        SELECT COALESCE(m.nombre, p.ciudad_foranea, 'Sin procedencia') AS nombre,
               COUNT(*)::INTEGER AS total
        FROM registros r
        INNER JOIN participantes p ON p.id = r.participante_id
        LEFT JOIN municipios m ON m.id = p.municipio_id
        WHERE r.evento_id = $1
        GROUP BY COALESCE(m.nombre, p.ciudad_foranea, 'Sin procedencia')
        ORDER BY total DESC, nombre
        LIMIT 8
      `, [event.id]),
      db.query(`
        SELECT r.folio, r.estatus,
               p.nombres, p.apellido_paterno, p.apellido_materno,
               p.categoria_competencia
        FROM registros r
        INNER JOIN participantes p ON p.id = r.participante_id
        WHERE r.evento_id = $1
        ORDER BY r.created_at DESC
        LIMIT 8
      `, [event.id])
    ]);

    return json(200, {
      event,
      summary: summary.rows[0],
      categories: categories.rows,
      profile: profile.rows[0],
      sizes: sizes.rows,
      municipalities: municipalities.rows,
      recent: recent.rows,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard query failed:', error);
    return json(500, { error: 'No fue posible consultar el dashboard.' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}
