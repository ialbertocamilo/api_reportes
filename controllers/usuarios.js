'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getUsersCareersAreas, loadUsersCriteriaValues, getUserCriterionValues } = require('../helper/Usuarios')
const { getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck, logtime } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

const defaultHeaders = [
  'NOMBRE COMPLETO',
  'NOMBRE',
  'APELLIDO PATERNO',
  'APELLIDO MATERNO',
  'DOCUMENTO',
  'NÚMERO DE TELÉFONO',
  'NÚMERO DE PERSONA COLABORADOR',
  'ESTADO(USUARIO)',
  'EMAIL',
  'ULTIMA SESIÓN',
  'FECHA DE CREACIÓN'
]

async function exportarUsuariosDW ({ workspaceId, modulos,
                                     UsuariosActivos, UsuariosInactivos,
                                     careers, areas }) {
  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load records from database

  const users = await getUsersCareersAreas(modulos, UsuariosActivos, UsuariosInactivos, careers, areas)
  const usersIds = pluck(users, 'id')
  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')
  const usersCriteriaValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Generate headers adding workspace criteria to default header columns

  workspaceCriteria.forEach(el => defaultHeaders.push(el.name))
  await createHeaders(defaultHeaders)

  // Generate rows for Excel file
  logtime('Start file generation')
  let i = 0;
  for (const user of users) {
    i = i+1;
    
    console.log(`number user: ${i}`);
    const cellRow = []
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')
    const createAt = moment(user.created_at).format('DD/MM/YYYY H:mm:ss')
    const fullname = [user.name,user.lastname, user.surname]
    .filter(e => Boolean(e))
    .join(' ');
    cellRow.push(fullname)
    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.phone_number)
    cellRow.push(user.person_number)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
    cellRow.push(user.email)
    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(createAt !== 'Invalid date' ? createAt : '-')

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
