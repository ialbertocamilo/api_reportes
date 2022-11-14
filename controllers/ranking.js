'use strict'
require('../error')
process.on('message', (requestData) => {
  ranking(requestData)
})

const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { createHeaders, worksheet, workbook, createAt } = require('../exceljs')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const {
  loadUsersCriteriaValues, addActiveUsersCondition,
  getUserCriterionValues
} = require('../helper/Usuarios')
const moment = require('moment/moment')
const { con } = require('../db')
const { response } = require('../response')

const headers = [
  'Puntaje (P)',
  'Cantidad de Completados (CC)',
  'Nota Promedio (NP)',
  'Intentos (I)',
  'Ultima evaluación'
]

async function ranking({
  workspaceId, modulos, UsuariosActivos, UsuariosInactivos, areas, sedes
}) {
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

  const users = await loadUsersRanking(
    workspaceId, modulos, UsuariosActivos, UsuariosInactivos, areas, sedes
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Add users to Excel rows

  for (const user of users) {

    const cellRow = []

    // Add default values

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add additional report values

    cellRow.push(user.score ? user.score : '-')
    cellRow.push(user.courses_completed ? user.courses_completed : 0)
    cellRow.push(user.grade_average ? user.grade_average : 0)
    cellRow.push(user.attempts ? user.attempts : 0)
    cellRow.push(
      user.last_ev ? moment(user.last_ev).format('L') + ' ' + moment(user.last_ev).format('LT')
        : '-'
    )

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Ranking' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users ranking from database
 * @returns {Promise<*>}
 */
async function loadUsersRanking(
  workspaceId, modulesIds, activeUsers, inactiveUsers, areas, sedes
) {
  let query = `
    select
      COUNT(cvu.user_id) as temp,
      u.*,
      su.score,
      su.courses_completed,
      su.attempts,
      su.grade_average,
      su.last_time_evaluated_at last_ev
    from 
        users u 
            inner join summary_users su on u.id = su.user_id
            `

  const workspaceCondition = ` where u.subworkspace_id in (${modulesIds.join()})`
  if (areas.length > 0) {
    query += `inner join criterion_value_user cvu on cvu.user_id = u.id
              inner join criterion_values cv on cvu.criterion_value_id = cv.id`
    query += workspaceCondition

    // query += ' and cv.value_text = :jobPosition'
    query += ` and 
                  ( cvu.criterion_value_id in ( `;
    areas.forEach(cv => query += `${cv},`);
    query = query.slice(0, -1);

    query += `) `;

    if (sedes.length > 0) {
      query += `OR  cvu.criterion_value_id in (`;

      sedes.forEach(cv2 => query += `${cv2},`);
      query = query.slice(0, -1);

      query += `)`;
    }

    query += `)`;


  } else {
    query += workspaceCondition
  }

  // Add user conditions and group sentence
  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += `
    GROUP BY cvu.user_id`;
  if (areas.length > 0) {

    let having_count = sedes.length > 0 ? 2 : 1;

    query += ` HAVING temp = ${having_count}`;

  }

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
