'use strict'
require('../error')
process.on('message', (requestData) => {
  visitas(requestData)
})

const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { getUserCriterionValues, loadUsersCriteriaValues, addActiveUsersCondition,
        innerCriterionValueUser, havingProccessValueUser } = require('../helper/Usuarios')
const moment = require('moment')
const { pluck,logtime } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { con } = require('../db')

let headers = [
  'Última sesión',
  'Escuela',
  'Curso',
  'TIpo curso',
  'Tema',
  'Visitas'
]

async function visitas ({ workspaceId, modulos, UsuariosActivos, UsuariosInactivos, 
  careers, areas, tipocurso, start, end }) {
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

  const users = await loadUsersWithVisits(
    workspaceId, modulos, UsuariosActivos, UsuariosInactivos, careers, areas, tipocurso, 
    start, end
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Add users to Excel rows

  for (const user of users) {
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')

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

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)
    cellRow.push(user.course_type)
    cellRow.push(user.topic_name)
    cellRow.push(user.views)

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Visitas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param workspaceId
 * @param {array} modulesIds
 * @param {boolean} activeUsers include active users
 * @param {boolean} inactiveUsers include inactive users
 * @param start
 * @param end
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithVisits (
  workspaceId, modulesIds, activeUsers, inactiveUsers,
  careers, areas, tipocurso, start, end
) {
  // Base query

  let query = `
    select 
        u.*,
        tx.name as course_type,
        group_concat(distinct(s.name) separator ', ') school_name,
        c.name course_name,
        t.name topic_name,
        st.views `
    
  const userCondition = ` 
      inner join workspaces w on u.subworkspace_id = w.id
      inner join summary_topics st on u.id = st.user_id
      inner join topics t on t.id = st.topic_id
      inner join summary_courses sc on u.id = sc.user_id
      inner join courses c on t.course_id = c.id
      inner join taxonomies tx on tx.id = c.type_id
      inner join course_school cs on c.id = cs.course_id
      inner join schools s on cs.school_id = s.id
      inner join school_workspace sw on s.id = sw.school_id

      where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId} `;

  const stateCareerArea = (careers.length > 0 || areas.length > 0); 
  if(stateCareerArea) query += innerCriterionValueUser(careers, areas, userCondition);
  else query += ` from users u ${userCondition}`;

  // Add type_course 
  if(tipocurso) query +=  ` and tx.code = 'free'` 

  /*if (start && end) {
    query += ` and (
      st.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }*/

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += '  group by  u.id, t.id, st.id ';

  if(stateCareerArea) query += havingProccessValueUser(careers, areas);
  // Execute query

  logtime(query);
  const [rows] = await con.raw(query)
  return rows
}
