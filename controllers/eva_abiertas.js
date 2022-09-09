'use strict'
process.on('message', req => {
  exportarEvaluacionesAbiertas(req)
})

require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getCriteriosPorUsuario, getHeadersEstaticos } = require('../helper/Criterios')
const { getUsers } = require('../helper/Usuarios')
const moment = require('moment')

const Headers = [
  'ULTIMA SESION',
  'ESCUELA',
  'CURSO',
  'TEMA',
  'TAG',
  'PREGUNTA',
  'RESPUESTA'
]
createHeaders(Headers, getHeadersEstaticos)

async function exportarEvaluacionesAbiertas({ modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, temas, start, end }) {
  let WhereEvaAbierta = '1'
  escuelas[0] ? WhereEvaAbierta += ` AND categoria_id in (${escuelas})` : ''
  cursos[0] ? WhereEvaAbierta += ` AND curso_id in (${cursos}) ` : ''

  start && end ? WhereEvaAbierta += ` AND (created_at BETWEEN "${start}" AND "${end}")` : ''
  start && !end ? WhereEvaAbierta += ` AND created_at >= '${start}'` : ''
  !start && end ? WhereEvaAbierta += ` AND created_at <= '${end}'` : ''

  const Usuarios = await getUsers(modulos, UsuariosActivos, UsuariosInactivos)
  const Escuelas = await con('categorias')
  const Modulos = await con('ab_config')
  const Cursos = await con('cursos')
  const Temas = temas ? await con('posteos').whereIn('id', temas) : await con('posteos')
  const Preguntas = await con('preguntas')
  const Tags = await con('tags')
  const TagsRelations = await con('tag_relationships')
  const EvaAbiertas = await con('ev_abiertas').whereRaw(WhereEvaAbierta)

  for (const eva of EvaAbiertas) {
    const CellRow = []
    const usuario = Usuarios.find(obj => obj.id === eva.usuario_id) || ''
    const modulo = Modulos.find(obj => obj.id === usuario.config_id)
    const escuela = Escuelas.find(obj => obj.id === eva.categoria_id) || ''
    const curso = Cursos.find(obj => obj.id === eva.curso_id) || ''
    const tema = Temas.find(obj => obj.id === eva.posteo_id) || ''
    const subTag = TagsRelations.find(obj => obj.element_id === tema.id) || ''
    const tag = Tags.find(obj => (obj.id = subTag.tag_id)) || ''
    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss'); 

    if (tema && usuario) {
      CellRow.push(modulo.etapa)
      CellRow.push(usuario.nombre)
      CellRow.push(usuario.apellido_paterno)
      CellRow.push(usuario.apellido_materno)
      CellRow.push(usuario.dni)
      CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
      CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
      CriteriosUsuario.forEach(obj => CellRow.push(obj.nombre || '-'))
      CellRow.push( (m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
      CellRow.push(escuela ? escuela.nombre : '-')
      CellRow.push(curso ? curso.nombre : '-')
      CellRow.push(tema ? tema.nombre : '-')
      CellRow.push(tag ? tag.nombre : '-')

      const rptas = JSON.parse(eva.usu_rptas)
      rptas.forEach((rpta, index) => {
        if (rpta) {
          const pgtas = Preguntas.find(obj => obj.id === rpta.id)
          // NewJSON[`Pregunta ${index + 1}`] = pgtas.pregunta;
          // NewJSON[`Respuesta ${index + 1}`] = rpta.respuesta;
          CellRow.push(pgtas ? strippedString(pgtas.pregunta) : '-')
          CellRow.push(rpta ? strippedString(rpta.respuesta) : '-')
        }
      })
      worksheet.addRow(CellRow).commit()
    }
  }
  // }

  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'EvaluacionAbierta' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

const strippedString = (value) => {
  return value.replace(/(<([^>]+)>)/gi, '')
}
