'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getUsuarios } = require('../helper/Usuarios')
const moment = require('moment')

const Headers = [
  'MODULO',
  'NOMBRE',
  'APELLIDO PATERNO',
  'APELLIDO MATERNO',
  'DNI',
  'EMAIL',
  'ESTADO(USUARIO)',
  'ULTIMA SESION',
]

async function exportarUsuariosDW({ modulos, UsuariosActivos, UsuariosInactivos }) {
  // const Usuarios = modulos
  //   ? await con('usuarios').whereIn('config_id', modulos).andWhere('rol', 'default')
  //   : await con('usuarios').andWhere('rol', 'default')
  const Usuarios = await getUsuarios(modulos, UsuariosActivos, UsuariosInactivos)
  const Modulos = await con('ab_config')
  const TipoCriterios = await con('tipo_criterios')
  const CriteriosUsuarios = await con.raw(`SELECT uc.usuario_id, c.nombre, tc.id as tipo_criterio_id
      from criterios as c
      INNER JOIN usuario_criterios as uc on c.id=uc.criterio_id
      INNER JOIN tipo_criterios as tc on c.tipo_criterio_id=tc.id Order by tc.id ASC`).then(([rows]) => rows)
  TipoCriterios.forEach(el => Headers.push(el.nombre))
  createHeaders(Headers)

  for (const usuario of Usuarios) {
    const CellRow = []
    let m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss'); 

    const modulo = Modulos.find((obj) => obj.id === usuario.config_id) || ''
    const criteriosUsuario = CriteriosUsuarios.filter(obj => obj.usuario_id === usuario.id)
    CellRow.push(modulo.etapa)
    CellRow.push(usuario.nombre)
    CellRow.push(usuario.apellido_paterno)
    CellRow.push(usuario.apellido_materno)
    CellRow.push(usuario.dni)
    CellRow.push(usuario.email ? usuario.email : 'Email no registrado')
    CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
    CellRow.push( (m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
    for (const tipoCriterio of TipoCriterios) {
      let UsuarioTipoCriterio = criteriosUsuario.find(obj => obj.tipo_criterio_id == tipoCriterio.id)
      CellRow.push(UsuarioTipoCriterio ? UsuarioTipoCriterio.nombre : '-')
    }

    worksheet.addRow(CellRow).commit()
  }

  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Usuarios' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
