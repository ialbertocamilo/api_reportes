process.on('message', (requestData) => {
  Reinicios(requestData)
})
const moment = require('moment')
require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getCriteriosPorUsuario, getHeadersEstaticos } = require('../helper/Criterios')

const Headers = [
  'ULTIMA SESION',
  'ESCUELA',
  'CURSO',
  'TEMA',
  'TIPO REINICIO',
  'REINICIOS',
  'ADMIN RESPONSABLE',
  'FECHA',
]
createHeaders(Headers, getHeadersEstaticos)

async function Reinicios({ admin, tipo, start, end }) {
  let WhereReinicios = '1'

  admin && admin !== 'ALL' ? WhereReinicios += ` AND admin_id = ${admin}` : ''
  tipo && tipo !== 'ALL' ? WhereReinicios += ` AND tipo = '${tipo}'` : ''

  start && end ? WhereReinicios += ` AND (created_at BETWEEN "${start}" AND "${end}")` : ''
  start && !end ? WhereReinicios += ` AND created_at >= '${start}'` : ''
  !start && end ? WhereReinicios += ` AND created_at <= '${end}'` : ''

  const Reinicios = await con('reinicios').whereRaw(WhereReinicios)
  const Cursos = await con('cursos')
  const Temas = await con('posteos')
  const Users = await con('users')
  const Modulos = await con('ab_config')
  const Usuarios = await con('usuarios')
  const Escuelas = await con('categorias')

  for (const reinicio of Reinicios) {
    const CellRow = []
    const admin = Users.find(obj => obj.id === reinicio.admin_id)
    const curso = Cursos.find(obj => obj.id === reinicio.curso_id) || ''
    const tema = Temas.find(obj => obj.id === reinicio.posteo_id) || ''
    const usuario = Usuarios.find(obj => obj.id === reinicio.usuario_id)
    const modulo = Modulos.find(obj => obj.id === usuario.config_id)
    const escuela = Escuelas.find(obj => obj.id === curso.categoria_id) || ''

    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY HH:mm:ss'); 

    CellRow.push(modulo.etapa)
    CellRow.push(usuario.nombre)
    CellRow.push(usuario.apellido_paterno)
    CellRow.push(usuario.apellido_materno)
    CellRow.push(usuario.dni)
    CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
    CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
    CriteriosUsuario.forEach(obj => CellRow.push(obj.nombre || '-'))
    CellRow.push( (m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
    CellRow.push(escuela.nombre || '-')
    CellRow.push(curso.nombre || '-')
    CellRow.push(tema.nombre || '-')
    CellRow.push(reinicio.tipo)
    CellRow.push(reinicio.acumulado)
    CellRow.push(admin.name)
    CellRow.push(reinicio.created_at)
    worksheet.addRow(CellRow).commit()
  }

  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Reinicios' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
