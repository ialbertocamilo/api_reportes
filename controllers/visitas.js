'use strict'
require('../error')
process.on('message', (requestData) => {
  visitas(requestData)
})

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
  'VISITAS',
]
createHeaders(Headers, getHeadersEstaticos)

async function visitas({ modulos, UsuariosActivos, UsuariosInactivos, start, end }) {
  let WhereVisitas = 'cursos.estado = 1 AND posteos.estado = 1'
  // let WhereVisitas = '1'
  start && end ? WhereVisitas += ` AND (visitas.created_at BETWEEN "${start}" AND "${end}")` : ''
  start && !end ? WhereVisitas += ` AND visitas.created_at >= '${start}'` : ''
  !start && end ? WhereVisitas += ` AND visitas.created_at <= '${end}'` : ''
  const Usuarios = await getUsers(modulos, UsuariosActivos, UsuariosInactivos)
  const Modulos = await con('ab_config')
  const Escuelas = await con('categorias')
  const Cursos = await con('cursos')
  const Temas = await con('posteos')
  const Tags = await con('tags')
  const TagsRelations = await con('tag_relationships')
  // const Visitas = await con('visitas').whereRaw(WhereVisitas)

  const Visitas = await con('visitas').select('post_id', 'usuario_id', 'sumatoria', 'visitas.curso_id', 'cursos.id').whereRaw(WhereVisitas).innerJoin('cursos', 'visitas.curso_id', 'cursos.id').innerJoin('posteos', 'visitas.post_id', 'posteos.id')

  for (const usuario of Usuarios) {
    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    const visitas = Visitas.filter(obj => obj.usuario_id == usuario.id)
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss'); 
    for (const visita of visitas) {
      const CellRow = []
      const modulo = Modulos.find(obj => obj.id == usuario.config_id)
      const tema = Temas.find(obj => obj.id === visita.post_id) || ''
      const escuela = Escuelas.find(obj => obj.id == tema.categoria_id) || ''
      const curso = Cursos.find(obj => obj.id == visita.curso_id) || ''
      const subTag = TagsRelations.find(obj => obj.element_id == tema.id) || ''
      const tag = Tags.find(obj => (obj.id = subTag.tag_id)) || ''

      const newEscuela = escuela ? escuela.nombre : '-'
      const newCurso = curso ? curso.nombre : '-'
      const newTema = tema ? tema.nombre : '-'
      const newTag = tag ? tag.nombre : '-'

      CellRow.push(modulo.etapa)
      CellRow.push(usuario.nombre)
      CellRow.push(usuario.apellido_paterno)
      CellRow.push(usuario.apellido_materno)
      CellRow.push(usuario.dni)
      CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
      CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
      CriteriosUsuario.forEach(obj => CellRow.push(obj.nombre || '-'))
      CellRow.push( (m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
      CellRow.push(newEscuela)
      CellRow.push(newCurso)
      CellRow.push(newTema)
      CellRow.push(newTag)
      CellRow.push(visita.sumatoria)
      worksheet.addRow(CellRow).commit()
    }
  }

  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Visitas' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
