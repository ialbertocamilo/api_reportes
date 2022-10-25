'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getUsers, loadUsersCriteriaValues, getUserCriterionValues } = require('../helper/Usuarios')
const { getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck, logtime } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

const defaultHeaders = [
  'NOMBRE',
  'APELLIDO PATERNO',
  'APELLIDO MATERNO',
  'DOCUMENTO',
  'ESTADO(USUARIO)',
  'ULTIMA SESIÓN'
]

async function exportarUsuariosDW ({ workspaceId, modulos, UsuariosActivos, UsuariosInactivos }) {
  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load records from database

  const users = await getUsers(modulos, UsuariosActivos, UsuariosInactivos)
  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')
  const usersCriteriaValues = await loadUsersCriteriaValues(modulos)

  // Generate headers adding workspace criteria to default header columns

  workspaceCriteria.forEach(el => defaultHeaders.push(el.name))
  await createHeaders(defaultHeaders)

  // Generate rows for Excel file
  logtime('Start file generation')
  for (const user of users) {
    const cellRow = []
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')

    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriteriaValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }
  logtime('End file generation')

  // Generate Excel file

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Usuarios' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
