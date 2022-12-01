process.on('message', (requestData) => {
  Reinicios(requestData)
})
const moment = require('moment')
require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { getUserCriterionValues, loadUsersCriteriaValues } = require('../helper/Usuarios')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

const headers = [
  'Última sesión',
  'Escuela',
  'Curso',
  'Tema',
  'Reinicios',
  'Admin. reponsable',
  'Fecha'
]

async function Reinicios ({ workspaceId, admin, tipo, start, end }) {
  // Generate Excel file header

  console.log({ workspaceId, admin, tipo, start, end })
  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // Get modules ids

  const modulos = await getSuboworkspacesIds(workspaceId)

  // Load users from database and generate ids array

  const users = await loadUsersWithRestarts(
    workspaceId, modulos, admin, tipo, start, end
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria
  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

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

    // Add course values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)
    cellRow.push(user.topic_name)
    cellRow.push(user.topic_restarts || 0)
    cellRow.push(user.admin_name)
    cellRow.push(moment(user.summary_topic_updated).format('DD/MM/YYYY'))

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Reinicios' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param workspaceId
 * @param modulesIds
 * @param adminId
 * @param start
 * @param end
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithRestarts (
  workspaceId, modulesIds, tipo, adminId, start, end
) {
  // Base query

  let query = `
    select 
        u.*,
        group_concat(distinct(s.name) separator ', ') school_name,
        c.name course_name,
        t.name topic_name,
        st.restarts topic_restarts,
        admins.name admin_name,
        st.updated_at summary_topic_updated
    from users u
       inner join workspaces w on u.subworkspace_id = w.id
       inner join summary_topics st on u.id = st.user_id
       inner join topics t on t.id = st.topic_id
       inner join summary_courses sc on u.id = sc.user_id
       inner join courses c on t.course_id = c.id
       inner join course_school cs on c.id = cs.course_id
       inner join schools s on cs.school_id = s.id
       inner join school_workspace sw on s.id = sw.school_id
       left join users admins on st.restarter_id = admins.id
    where  
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId} 
  `

  if (adminId) {
    query += ` and st.restarter_id = ${adminId}`
  }

  if (start && end) {
    query += ` and (
      st.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }

  // Group results

  query += '  group by u.id, t.id, st.id'

  // Execute query
  // logtime(query);

  const [rows] = await con.raw(query)

  return rows
}
