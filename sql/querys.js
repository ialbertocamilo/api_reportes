const { query } = require('./index')

exports.getUsuariosMatricula = async (queryUsuariosMatricula) => {
  const nquery = `SELECT u.id, u.config_id, u.dni,u.email, u.nombre, DATE_FORMAT(u.ultima_sesion,'%d/%m/%Y') as ultima_sesion, u.cargo,
	m.carrera_id, m.ciclo_id, u.rol, m.presente
	FROM usuarios AS u
	INNER JOIN matricula AS m ON u.id = m.usuario_id
	${queryUsuariosMatricula}`
  // console.log(nquery);
  return await query(nquery)
}

exports.getUsuarios = async (queryUsuarios) => {
  return await query(`SELECT id, config_id, dni, nombre, email,DATE_FORMAT(created_at,'%d/%m/%Y') AS created_at, DATE_FORMAT(ultima_sesion,'%d/%m/%Y') as ultima_sesion
  FROM usuarios
   ${queryUsuarios}
   ORDER BY nombre ASC`)
  // return rows;
}

exports.getUsuariosOrderById = async (queryUsuarios) => {
  return await query(`SELECT id, config_id, area, dni, nombre, sexo, DATE_FORMAT(created_at,'%d/%m/%Y') AS created_at, DATE_FORMAT(ultima_sesion,'%d/%m/%Y') as ultima_sesion
  FROM usuarios
   ${queryUsuarios}
   ORDER BY id`)
}
exports.getModulos = async (queryModulos) => {
  return await query('SELECT id, etapa, mod_evaluaciones FROM ab_config ' + queryModulos)
}

exports.getPerfiles = async () => {
  return await query('SELECT id, nombre FROM perfiles')
}
exports.getCarreras = async (queryCarreras) => {
  return await query('SELECT id, nombre FROM carreras ' + queryCarreras)
}
exports.getCiclos = async (queryCiclos) => {
  return await query('SELECT id, nombre FROM ciclos ' + queryCiclos)
}
exports.getTemas = async (addQuery) => {
  return await query('SELECT id, nombre, curso_id, estado, categoria_id, evaluable, tipo_ev FROM posteos ' + addQuery)
}

exports.getVisitas = async (nquery) => {
  return await query(`SELECT curso_id, usuario_id, post_id, sumatoria, estado_tema, tipo_tema FROM visitas ${nquery}`)
}
exports.getEscuelas = async () => {
  return await query('SELECT id, nombre FROM categorias')
}
exports.getCursos = async () => {
  return await query('SELECT id, nombre, estado FROM cursos')
}
exports.getPruebasTema = async (nquery) => {
  const newQuery = `SELECT p.curso_id, u.id, p.categoria_id, p.posteo_id, p.intentos, p.nota, p.resultado, DATE_FORMAT(p.updated_at, '%d/%m/%Y') AS updated_at, m.ciclo_id, m.carrera_id,
  u.config_id, u.area, u.dni, u.nombre, u.sexo, DATE_FORMAT(u.ultima_sesion,'%d/%m/%Y'), u.cargo
  FROM pruebas AS p
  INNER JOIN usuarios AS u ON u.id = p.usuario_id
  INNER JOIN matricula AS m ON u.id = m.usuario_id
  ${nquery}`
  return await query(newQuery)
}
exports.getPruebasUsuarioMatricula = async (nquery) => {
  // Checkear nombre...
  const newQuery = `SELECT p.curso_id, u.id, p.categoria_id, p.posteo_id, p.intentos, p.nota, p.resultado, DATE_FORMAT(p.updated_at, '%d/%m/%Y') AS updated_at, m.ciclo_id, m.carrera_id,
  u.config_id, u.area, u.dni, u.nombre, u.sexo, u.ultima_sesion, u.cargo
  FROM pruebas AS p
  INNER JOIN usuarios AS u ON u.id = p.usuario_id
  INNER JOIN matricula AS m ON u.id = m.usuario_id
  ${nquery}
  GROUP BY u.id,p.curso_id`
  // console.log(newQuery);
  return await query(newQuery)
}
exports.getPruebasNotasCurso = async (queryPruebasNotasCurso) => {
  const newQuery = `SELECT curso_id, usuario_id, COUNT(posteo_id) as temas_evaluados, AVG(nota) as 'nota_promedio', DATE_FORMAT(MAX(updated_at), '%d/%m/%Y') as ultima_evaluacion, updated_at, categoria_id, posteo_id, intentos, nota
  FROM pruebas
  ${queryPruebasNotasCurso}
  GROUP BY usuario_id, curso_id`
  // console.log(newQuery);
  return await query(newQuery)
}
// Obtener el resultado del usuario vs curso
exports.getCursoResultado = async (usuario_id, curso_id) => {
  const nquery = `SELECT curso_id, usuario_id, COUNT(posteo_id) as temas_evaluados, AVG(nota) as nota_promedio, DATE_FORMAT(MAX(updated_at), '%d/%m/%Y') as ultima_evaluacion, updated_at, categoria_id, posteo_id, intentos, nota
  FROM pruebas
  WHERE usuario_id = ${usuario_id} AND curso_id = ${curso_id}
  GROUP BY usuario_id, curso_id`
  // console.log(nquery);
  const rows = await query(nquery)
  return rows[0]
}
exports.getCursoResultadoAbierta = async (usuario_id, curso_id) => {
  const newQuery = `SELECT curso_id, usuario_id, COUNT(posteo_id) as temas_evaluados, DATE_FORMAT(MAX(updated_at), '%d/%m/%Y') as ultima_evaluacion, updated_at, posteo_id
  FROM ev_abiertas
  WHERE usuario_id = ${usuario_id} AND curso_id = ${curso_id}
  GROUP BY usuario_id, curso_id`
  const rows = await query(newQuery)
  return rows[0]
}
exports.getPruebas = async (queryPruebas) => {
  return await query(
        `SELECT curso_id, usuario_id, categoria_id, posteo_id, intentos, nota, resultado, DATE_FORMAT(updated_at,'%d/%m/%Y') as updated_at
  FROM pruebas ` + queryPruebas
  )
  // 	console.log(
  // 		`SELECT curso_id, usuario_id, categoria_id, posteo_id, intentos, nota, resultado, DATE_FORMAT(updated_at,'%d/%m/%Y') as updated_at
  //   FROM pruebas ` + queryPruebas
  // 	);
}

exports.getTemasPorCurso = async (temasID) => {
  // Temas por curso = Temas asignados
  return await query(`SELECT c.id,COUNT(p.id) AS temas_por_curso
  FROM cursos AS c
  INNER JOIN posteos AS p ON c.id = p.curso_id
  AND p.estado = 1
  GROUP BY p.curso_id
  ORDER BY p.curso_id`)
  // AND p.evaluable = 'si'
}
exports.getVisitasTotal = async (queryVisitasCurso) => {
  const nquery = `SELECT v.curso_id, v.usuario_id, SUM(v.sumatoria) visitas_x_curso, c.c_evaluable, c.categoria_id, c.config_id, c.estado
  FROM visitas v
  INNER JOIN cursos c ON c.id = v.curso_id
  ${queryVisitasCurso}
  GROUP BY curso_id, usuario_id`
  // console.log(nquery);
  return await query(nquery)
}
exports.getCursosAsignados = async (queryCursosAsignados) => {
  const nquery = `SELECT u.curso_id, c.c_evaluable, c.categoria_id, c.config_id, c.estado, c.nombre
	FROM matricula m
	INNER JOIN curricula u ON m.ciclo_id = u.ciclo_id
	INNER JOIN cursos c ON u.curso_id = c.id
	${queryCursosAsignados}
	GROUP BY curso_id`
  // console.log(nquery);
  return await query(nquery)
}
exports.getVisitasPorCurso = async () => {
  // Respuesta : 2 seg
  return await query('SELECT curso_id, usuario_id, SUM(sumatoria) visitas_x_curso FROM visitas GROUP BY curso_id, usuario_id')
}
exports.getTemasRevisados = async () => {
  return await query(
    "SELECT curso_id, usuario_id, COUNT(estado_tema) as cantidad_revisados FROM visitas WHERE estado_tema = 'revisado' GROUP BY curso_id, usuario_id"
  )
}
exports.getEvaAbiertasOrderByUsuario = async (queryEvaAbiertas) => {
  const newQuery = `SELECT id, categoria_id, curso_id, posteo_id, usuario_id, usu_rptas
  from ev_abiertas
  ${queryEvaAbiertas}
  ORDER BY usuario_id`
  return await query(newQuery)
}
exports.getEvaAbiertas = async () => {
  return await query(`SELECT id, categoria_id, curso_id, posteo_id, usuario_id, usu_rptas
	from ev_abiertas`)
}
exports.getPreguntas = async () => {
  return await query(`SELECT id, pregunta
  from preguntas`)
}
exports.getReinicios = async (queryReinicios) => {
  const newQuery = `SELECT u.dni, u.nombre, r.id, r.usuario_id, r.curso_id, r.posteo_id, r.admin_id, r.tipo, r.acumulado, DATE_FORMAT(r.created_at,'%d/%m/%Y') as created_at, m.carrera_id, m.ciclo_id, u.config_id
  from reinicios as r
  inner join usuarios as u on r.usuario_id=u.id
  inner join matricula as m on u.id=m.usuario_id
  ${queryReinicios}
  ORDER BY u.id`
  return await query(newQuery)
}
exports.getUsers = async () => {
  return await query('SELECT id, name from users')
}
exports.getUsuarioVersiones = async () => {
  return await query(`SELECT usuario_id, v_android, v_ios, DATE_FORMAT(updated_at,'%d/%m/%Y') as updated_at
                        from usuario_versiones
                        ORDER BY updated_at DESC`)
}
exports.getCustomQuery = async (customQuery) => {
  return await query(customQuery)
}
exports.getTags = async (params) => {
  return await query('SELECT id, nombre FROM tags')
}
exports.getTagsRelationShips = async (params) => {
  return await query('SELECT id, tag_id, element_type, element_id FROM tag_relationships')
}
exports.getCurricula = async () => {
  return await query('SELECT id, carrera_id, ciclo_id, curso_id FROM curricula')
}
exports.getCursoResumenXUsuario = async (usuario, curso) => {
  const rows = await query(
        `SELECT usuario_id, curso_id, estado FROM resumen_x_curso WHERE usuario_id = ${usuario} AND curso_id = ${curso}`
  )
  return rows[0]
}
exports.getCursosXUsuario = async (usuario, nquery) => {
  return await query(
        `SELECT m.carrera_id, m.ciclo_id, c.curso_id, u.categoria_id, u.modalidad, u.c_evaluable, u.nombre, u.estado FROM matricula m
		INNER JOIN curricula c ON m.ciclo_id = c.ciclo_id
		INNER JOIN cursos u ON c.curso_id = u.id
		WHERE m.usuario_id = ${usuario}
		AND m.estado = 1
		AND u.estado = 1 ${nquery}`
  )
}

exports.getResultadoCurso = async (usuario, curso) => {
  const nquery = `SELECT asignados, aprobados, realizados, revisados, desaprobados, nota_prom, visitas, estado, porcentaje
	FROM resumen_x_curso
	WHERE usuario_id = ${usuario}
	AND curso_id = ${curso}`

  const rows = await query(nquery)
  return rows[0]
}

exports.getTemaCurso = async (curso, nquery) => {
  const newQuery = `SELECT id,nombre, evaluable, tipo_ev, estado, categoria_id
	FROM posteos
	WHERE curso_id = ${curso}
	AND estado = 1
	${nquery}`
  return await query(newQuery)
}
exports.getResumenCurso = async (addQuery) => {
  const newQuery =
        `SELECT rc.usuario_id, curso_id, categoria_id, rc.intentos, rc.nota_prom, rc.updated_at, rc.estado, rc.asignados, rc.aprobados, rc.realizados, rc.revisados, u.area, rc.visitas
	FROM resumen_x_curso as rc
	INNER JOIN usuarios as u on rc.usuario_id = u.id ` + addQuery
    // console.log(newQuery);
  return await query(newQuery)
}
exports.getDiplomas = async () => {
  const newQuery = 'SELECT usuario_id, curso_id, posteo_id, check_apb from diplomas'
  return await query(newQuery)
}
exports.getTabla = async (tabla) => {
  return query(`SELECT * FROM ${tabla}`)
}

exports.getCurriculaDetalles = async () => {
  return query(`SELECT * FROM curriculas as c
    INNER JOIN curricula_detalles as cd on c.id=cd.curricula_id`)
}
exports.getUsuarioCriterios = async () => {
  return query('SELECT * FROM usuario_criterios WHERE segmentar = 1')
}
