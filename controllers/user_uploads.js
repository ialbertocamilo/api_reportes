'use strict'
require('../error')
const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const { response } = require('../response')
const { pluck } = require('../helper/Helper')
const { loadUsersCriteriaValues, getUserCriterionValues,
  addActiveUsersCondition
} = require('../helper/Usuarios')
const { getWorkspaceCriteria, getGenericHeaders } = require('../helper/Criterios')
const { con } = require('../db')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const moment = require('moment/moment')
process.on('message', (requestData) => {
  userUploads(requestData)
})

const headers = [
  'Link',
  'Archivo',
  'Descripción',
  'Fecha de carga'
]

async function userUploads ({
  workspaceId, UsuariosActivos, UsuariosInactivos, baseUrl
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // Load subworkspaces id from active workspace

  const modulesIds = await getSuboworkspacesIds(workspaceId)

  // Load users from database and generate ids array

  const users = await loadUsersUploads(
    workspaceId, modulesIds, UsuariosActivos, UsuariosInactivos
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulesIds, usersIds)

  // Add users to Excel rows

  for (const user of users) {

    const cellRow = []

    // Add default values

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
    if (process.env.MARCA === 'claro') { cellRow.push(user.phone_number) }
    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add additional report values

    cellRow.push(user.link)
    cellRow.push(generateFileUrl(baseUrl, user.file))
    cellRow.push(user.description)
    cellRow.push(moment(user.created_at).format('DD/MM/YYYY H:mm:ss'))

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Usuario Uploads' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load user with its uploaded files
 * @returns {Promise<void>}
 */
async function loadUsersUploads (
  workspaceId, modulesIds, activeUsers, inactiveUsers
) {
  let query = `
    select
        u.*,
        upl.link,
        upl.file,
        upl.description,
        upl.created_at
    from
        users u inner join
            usuario_uploads upl on u.id = upl.usuario_id
    where
        u.subworkspace_id in (${modulesIds.join()})
  `

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)

  // Execute query and result results

  const [rows] = await con.raw(query)
  return rows
}

/**
 * Generate file's absolute path
 *
 * @param baseUrl
 * @param fileUrl
 * @returns {string}
 */
function generateFileUrl (baseUrl, fileUrl) {
  // Remove trailing slash

  baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : ''

  // Remove slash from the begining and the end

  fileUrl = fileUrl ? fileUrl.replace(/^\/|\/$/g, '') : ''

  return `${baseUrl}/${fileUrl}`
}
