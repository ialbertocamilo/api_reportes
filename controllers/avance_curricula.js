process.on('message', requestData => {
  AvanceCurricula(requestData)
})
require('../error')
const { con } = require('../db')
const { response } = require('../response')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { getUserCriterionValues, loadUsersCriteriaValues, addActiveUsersCondition } = require('../helper/Usuarios')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

// Headers for Excel file

const headers = [
  'Cursos asignados',
  'Cursos completados',
  'Avance'
]

async function AvanceCurricula ({ workspaceId, modulos, UsuariosActivos, UsuariosInactivos, validacion }) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load users from database and generate ids array

  const users = await loadUsersWithProgress(modulos, UsuariosActivos, UsuariosInactivos)
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Add data to Excel rows

  for (const user of users) {

    const cellRow = []

    // Add default values

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

    // Add user's criterion values

    // const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    // userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add additional values

    cellRow.push(user.courses_assigned || '-')
    cellRow.push(user.courses_completed || '-')
    cellRow.push(user.advanced_percentage ? user.advanced_percentage + '%' : 0 + '%')

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'avance_curricula' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param {array} modulesIds
 * @param activeUsers
 * @param inactiveUsers
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithProgress (
  modulesIds, activeUsers, inactiveUsers
) {
  // Base query

  let query = `
    select 
        u.*, 
        su.courses_assigned,
        su.courses_completed,
        su.advanced_percentage
    from users u
        inner join summary_users su on u.id = su.user_id
    where
        u.subworkspace_id in (${modulesIds.join()})
  `

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += ' group by u.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
