'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getCriteriosPorUsuario, getHeadersEstaticos } = require('../helper/Criterios')
const { getUsers } = require('../helper/Usuarios')
const moment = require('moment')
moment.locale('es')

let Headers = [
  'ULTIMA SESION',
  'ESCUELA',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TEMA',
  'RESULTADO TEMA',
  'ESTADO TEMA',
  'NOTA TEMA',
  'PUNTAJE TEMA',
  'REINICOS TEMA',
  'INTENTOS PRUEBA',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'SISTEMA DE CALIFICACION',
  'ULTIMA EVALUACION',
]
createHeaders(Headers, getHeadersEstaticos)

async function exportarUsuariosDW({ modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, temas, completados, desaprobados, pendientes, temasActivos, temasInactivos, end, start, validador }) {

  if (validador) {
    Headers = Headers.concat([
      'VALIDADOR DE INTENTOS REINICIOS',
      'VALIDADOR PUNTAJE'
    ])
  }

  let WhereResumen = '1'
  start && end ? WhereResumen += ` AND (updated_at BETWEEN "${start}" AND "${end}")` : ''
  start && !end ? WhereResumen += ` AND updated_at >= '${start}'` : ''
  !start && end ? WhereResumen += ` AND updated_at <= '${end}'` : ''

  const Modulos = await con('ab_config')
  const Usuarios = await getUsers(modulos, UsuariosActivos, UsuariosInactivos)
  const UsuarioCursos = cursos
    ? await con('usuario_cursos').where('estado', 1).whereIn('curso_id', cursos)
    : await con('usuario_cursos').where('estado', 1)
  const Temas = temas
    ? await con('posteos').where('estado', 1).whereIn('id', temas)
    : await con('posteos').where('estado', 1)
  const Visitas = await con('visitas')
  const Escuelas = await con('categorias')
  const Cursos = await con('cursos')
  const ResumenCurso = await con('resumen_x_curso').whereRaw(WhereResumen)
  if (!ResumenCurso[0]) process.send({ alert: 'No se encontraron resultados' })
  const Pruebas = await con('pruebas').where('calificada',1)
  const Reinicios = await con('reinicios')

  for (const usuario of Usuarios) {
    const modulo = Modulos.find((obj) => obj.id === usuario.config_id)
    const CursosAsignados = UsuarioCursos.filter(obj => obj.usuario_id === usuario.id)
    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss'); 

    for (const cursoAsignado of _.uniq(CursosAsignados, 'curso_id')) {
      const curso = Cursos.find(obj => obj.id == cursoAsignado.curso_id)
      const _escuela = Escuelas.find(obj => obj.id == curso.categoria_id) || ''
      const temas = Temas.filter(obj => obj.curso_id == curso.id)
      const resumen_curso = ResumenCurso.find(obj => obj.curso_id == curso.id && obj.usuario_id == usuario.id) || ''
      const resultadoCurso = verificarEstadoCurso(resumen_curso.estado)
      const reinicioCurso = Reinicios.find(obj => obj.usuario_id == usuario.id && obj.curso_id == curso.id) || '-'
      const filterEscuela = (escuelas && escuelas.includes(_escuela.id))

      for (const _tema of temas) {
        const prueba = Pruebas.find(obj => obj.posteo_id == _tema.id && obj.usuario_id == usuario.id) || ''
        const temaVisita = Visitas.find(obj => obj.curso_id == curso.id && obj.usuario_id == usuario.id && obj.post_id == _tema.id) || '-'
        const resultadoTema = verificarResultadoTema(temaVisita.estado_tema)
        let NotasAprobatorias = curso.mod_evaluaciones || modulo.mod_evaluaciones
        // console.log(JSON.parse(curso.mod_evaluaciones));
        // console.log(JSON.parse(modulo.mod_evaluaciones));
        NotasAprobatorias = JSON.parse(NotasAprobatorias)
        // console.log('NA ',NotasAprobatorias.nota_aprobatoria);
        // console.log(_tema.tipo_cal);
        const NotaMinima = NotasAprobatorias && _tema.tipo_cal ? NotasAprobatorias.nota_aprobatoria.find(obj => obj.nombre == _tema.tipo_cal) : ''
        const reinicioTema = Reinicios.find(obj => obj.usuario_id == usuario.id && obj.posteo_id == _tema.id) || '-'
        // console.log(NotaMinima);
        if (filterEscuela) {
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
          CellRow.push(_escuela.nombre)
          CellRow.push(curso.nombre)
          CellRow.push(resultadoCurso)
          CellRow.push(reinicioCurso.acumulado || '-')
          CellRow.push(_tema.nombre)
          CellRow.push(resultadoTema)
          CellRow.push(_tema.estado == 1 ? 'ACTIVO' : 'INACTIVO')
          CellRow.push(prueba.nota || '-')
          CellRow.push(prueba.puntaje || '-')
          CellRow.push(reinicioTema.acumulado || '-')
          CellRow.push(prueba.intentos || '-')
          CellRow.push(_tema.evaluable)
          CellRow.push(_tema.tipo_ev || '-')
          CellRow.push(temaVisita ? temaVisita.sumatoria : '-')
          CellRow.push(NotaMinima.value || '-')
          CellRow.push(_tema.tipo_cal || '-')
          CellRow.push((prueba.last_ev) ? moment(prueba.last_ev).format('L') : '-')
          if (validador) {
            // validarVisitasNota(visitasCurso.sumatoria, resumen_curso.nota_prom)
            CellRow.push(validarNotasTemas(prueba.intentos, prueba.nota, reinicioTema.acumulado, prueba.resultado) ? 'VERDADERO' : 'FALSO')
            CellRow.push(validadorNotaMinimaAprobatoria(prueba.puntaje, NotaMinima.value, prueba.resultado, prueba.nota) ? 'VERDADERO' : 'FALSO')
          }
          worksheet.addRow(CellRow).commit(prueba.puntaje, )
        }
      }
    }
  }

  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoTemas' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

function validarNotasTemas(intentos, nota, reinicios) {
  if (parseInt(nota)) {
    if (parseInt(intentos)) {
      return true
    } else {
      return !!parseInt(reinicios)
    }
  } else {
    return true
  }
}
function validadorNotaMinimaAprobatoria(puntaje, puntaje_minimo, prueba_resultado, nota){
  if (!parseInt(puntaje) > 0) {
    return true
  }else{
    if (parseInt(puntaje) >= parseInt(puntaje_minimo)) {
      return !!prueba_resultado
    }else{
      return !prueba_resultado
    }
  }
}
function verificarEstadoCurso(cursoEstado) {
  switch (cursoEstado) {
    case 'aprobado':
      return 'COMPLETADO'
    case 'desaprobado':
      return 'DESAPROBADO'
    case 'desarrollo':
      return 'DESARROLLO'
    case 'enc_pend':
      return 'ENCUESTA PENDIENTE'
    case 'pendiente':
      return 'PENDIENTE'
    default:
      return 'PENDIENTE'
  }
}
function verificarResultadoTema(estado) {
  const EstadoTema = (!estado || estado == '' || estado == null) ? 'pendiente' : estado
  switch (EstadoTema) {
    case 'aprobado':
    case 'revisado':
    case 'realizado':
      return 'COMPLETADO'
      break
    case 'desaprobado':
      return 'DESAPROBADO'
      break
    case 'pendiente':
      return 'PENDIENTE'
      break
  }
}
