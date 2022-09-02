'use strict'
process.on('message', (requestData) => {
  ConsolidadoCursos(requestData)
})
const _ = require('lodash')
require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getCriteriosPorUsuario, getHeadersEstaticos } = require('../helper/Criterios')
const { getUsuarios } = require('../helper/Usuarios')
const moment = require('moment')

async function ConsolidadoCursos({ modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, completados, desarollo, pendientes, encuesta_pendiente, start, end, validador }) {

  let Headers = [
    'ULTIMA SESION',
    'ESCUELA',
    'CURSO',
    'VISITAS',
    'NOTA PROMEDIO CAL20', // 4
    'NOTA PROMEDIO CAL100', // 4
    'RESULTADO CURSO',
    'ESTADO CURSO',
    'REINICIOS CURSOS',
    'TEMAS ASIGNADOS',
    'TEMAS COMPLETADOS',
    'AVANCE (%)'
  ]
  const ConfigGeneral = await con('config_general')
  ConfigGeneral[0].reporte_promedio_base_100 ? Headers.splice(5, 0, 'NOTA PROMEDIO (B100)') : ''
  if (validador) {
    Headers = Headers.concat([
      'VALIDADOR DE NOTAS Y VISITAS'
    ])
  }
  createHeaders(Headers, getHeadersEstaticos)

  let WhereResumen = '1'
  start && end ? WhereResumen += ` AND (updated_at BETWEEN "${start}" AND "${end}")` : ''
  start && !end ? WhereResumen += ` AND updated_at >= '${start}'` : ''
  !start && end ? WhereResumen += ` AND updated_at <= '${end}'` : ''

  const Usuarios = await getUsuarios(modulos, UsuariosActivos, UsuariosInactivos)
  const UsuarioCursos = cursos
    ? await con('usuario_cursos').where('estado', 1).whereIn('curso_id', cursos)
    : await con('usuario_cursos').where('estado', 1)
  const VisitasByCurso = await con.raw(
    'SELECT SUM(sumatoria) as sumatoria, curso_id, usuario_id FROM visitas GROUP BY curso_id,usuario_id'
  ).then(([rows]) => rows)
  const Modulos = await con('ab_config')
  const Escuelas = await con('categorias')
  const Cursos = await con('cursos')
  // const Temas = await con('posteos')
  const ResumenCurso = await con('resumen_x_curso').whereRaw(WhereResumen)
  if (!ResumenCurso[0]) process.send({ alert: 'No se encontraron resultados' })
  const Reinicios = await con('reinicios').where('tipo', 'por_curso')
  for (const usuario of Usuarios) {
    const modulo = Modulos.find((obj) => obj.id === usuario.config_id)
    const CursosAsignados = UsuarioCursos.filter(obj => obj.usuario_id === usuario.id)
    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss'); 
    
    for (const cursoAsignado of _.uniq(CursosAsignados, 'curso_id')) {
      const curso = Cursos.find(obj => obj.id == cursoAsignado.curso_id)
      // const temas = Temas.filter(obj => obj.curso_id == curso.id)
      const _escuela = Escuelas.find(obj => obj.id == curso.categoria_id) || ''
      const visitasCurso = VisitasByCurso.find(obj => obj.curso_id == curso.id && obj.usuario_id == usuario.id) || ''
      const resumen_curso = ResumenCurso.find(obj => obj.curso_id == curso.id && obj.usuario_id == usuario.id) || ''
      const resultadoCurso = verificarEstadoCurso(resumen_curso.estado, completados, desarollo, pendientes, encuesta_pendiente)
      const reinicio = Reinicios.find(obj => obj.usuario_id === usuario.id && obj.curso_id === curso.id) || '-'
      const filterEscuela = (escuelas && escuelas.includes(_escuela.id))
      if (filterEscuela && resumen_curso) {
        const CellRow = []
        CellRow.push(modulo.etapa)
        CellRow.push(usuario.nombre)
        CellRow.push(usuario.apellido_paterno)
        CellRow.push(usuario.apellido_materno)
        CellRow.push(usuario.dni)
        CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
        CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
        CriteriosUsuario.forEach(obj => CellRow.push(obj.nombre || '-'))
        CellRow.push( (m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
        CellRow.push(_escuela ? _escuela.nombre : 'No se encontro la Escuela')
        CellRow.push(curso ? curso.nombre : 'No se encontro el Curso')
        CellRow.push(visitasCurso.sumatoria || '-')
        CellRow.push(resumen_curso.aprobados > 0 ? resumen_curso.nota_prom : '-')
        CellRow.push(resumen_curso.aprobados > 0 && resumen_curso.nota_prom ? resumen_curso.nota_prom*5 : '-')
        if (ConfigGeneral[0].reporte_promedio_base_100) {
          let NotaB100 = ConfigGeneral[0].reporte_promedio_base_100 && resumen_curso.aprobados > 0 ? resumen_curso.nota_prom * 5 : '-' //B100
          CellRow.push(NotaB100)
        }
        CellRow.push(resultadoCurso)
        CellRow.push(curso.estado == 1 ? 'Activo' : 'Inactivo')
        CellRow.push(reinicio.acumulado || '-')
        let temas = [];
        if(!resumen_curso){
            temas = Temas.filter(obj => obj.curso_id == curso.id)
        }
        // const asignados = (resumen_curso) ? resumen_curso.asignados : temas.length ;
        // const temas_completados =  (resumen_curso) ? resumen_curso.aprobados + resumen_curso.realizados + resumen_curso.revisados : 0;
        // const porcentaje = (resumen_curso) ? resumen_curso.porcentaje+'%' : '0%';
        CellRow.push((resumen_curso) ? resumen_curso.asignados : temas.length )
        CellRow.push((resumen_curso) ? resumen_curso.aprobados + resumen_curso.realizados + resumen_curso.revisados : 0)
        CellRow.push((resumen_curso) ? resumen_curso.porcentaje+'%' : '0%')
        if (validador) {
          CellRow.push(ValidarNotasVisitas(visitasCurso.sumatoria, resumen_curso.nota_prom) ? 'VERDADERO' : 'FALSO')
        }
        worksheet.addRow(CellRow).commit()
      }
    }
  }
  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCursos' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
function verificarEstadoCurso(cursoEstado, completados, desarollo, pendientes, encuesta_pendiente) {
  // console.log(cursoEstado);
  switch (cursoEstado) {
    case 'aprobado':
      // if (completados)
      return 'COMPLETADO'
      break
    case 'desaprobado':
      // if (desarollo)
      return 'DESAPROBADO'
      break
    case 'desarrollo':
      // if (desarollo)
      return 'DESARROLLO'
      break
    case 'enc_pend':
      // if (encuesta_pendiente)
      return 'ENCUESTA PENDIENTE'
      break
    default:
      // if (pendientes)
      return 'PENDIENTE'
      break
    // Pendientes
  }
}

function ValidarNotasVisitas(visitas, nota) {
  if (parseInt(nota)) {
    if (parseInt(visitas)) {
      return true
    } else {
      return false
    }
  } else {
    return true
  }
}