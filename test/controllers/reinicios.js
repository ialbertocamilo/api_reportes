process.on('message', (requestData) => {
  Reinicios(requestData)
})
const moment = require('moment')
require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getCriteriosPorUsuario, getHeadersEstaticos } = require('../helper/Criterios')
const _ = require('lodash')

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
let CursosIDS;
let TemasIDS;
async function Reinicios({ admin, tipo, start, end }) {
  let WhereReinicios = 'usuarios.estado = 1'

  admin && admin !== 'ALL' ? WhereReinicios += ` AND admin_id = ${admin}` : ''
  tipo && tipo !== 'ALL' ? WhereReinicios += ` AND tipo = '${tipo}'` : ''

  start && end ? WhereReinicios += ` AND (created_at BETWEEN "${start}" AND "${end}")` : ''
  start && !end ? WhereReinicios += ` AND created_at >= '${start}'` : ''
  !start && end ? WhereReinicios += ` AND created_at <= '${end}'` : ''
  // Inner join para vincular con Usuarios que existan o esten activos
  const Reinicios = await con('reinicios').select('admin_id', 'curso_id', 'posteo_id', 'reinicios.usuario_id', 'tipo', 'acumulado', 'reinicios.created_at').whereRaw(WhereReinicios).innerJoin('usuarios', 'reinicios.usuario_id', 'usuarios.id')

  const Cursos = await con('cursos').where('estado', 1)
  const Temas = await con('posteos').where('estado', 1)
  const Users = await con('users')
  const Modulos = await con('ab_config')
  const Usuarios = await con('usuarios')
  const Escuelas = await con('categorias')
  // ! Verificar si existe el curso y el tema por codigo
  // ! Asignar los cursos cuando esta en tipo = tema
  CursosIDS = _.map(Cursos, 'id')
  // console.log(CursosIDS.length);
  TemasIDS = _.map(Temas, 'id')
  // console.log(TemasIDS.length);

  for (const reinicio of Reinicios) {
    const CellRow = []
    const admin = Users.find(obj => obj.id === reinicio.admin_id)
    const curso = Cursos.find(obj => obj.id === reinicio.curso_id) || ''
    const tema = Temas.find(obj => obj.id === reinicio.posteo_id) || ''
    const usuario = Usuarios.find(obj => obj.id === reinicio.usuario_id)
    const modulo = Modulos.find(obj => obj.id === usuario.config_id)
    const escuela = Escuelas.find(obj => obj.id === curso.categoria_id) || ''
    const mostrar = await verificarMostrar(reinicio.tipo, curso.id, tema.id)
    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY HH:mm:ss'); 
    if (mostrar) {
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
  }

  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Reinicios' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

function verificarMostrar(tipo, curso_id, tema_id) {
  switch (tipo) {
    case 'por_tema':
      return TemasIDS.includes(tema_id) ? true : false;
      break;
    case 'por_curso':
      return CursosIDS.includes(curso_id) ? true : false;
      break;
    default:
      return true
      break;
  }
}