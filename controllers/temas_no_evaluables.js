'use strict'
process.on('message', req => {
  exportTemasNoEvaluables(req)
})

const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { createHeaders, worksheet, workbook, createAt } = require('../exceljs')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { getUserCriterionValues, loadUsersCriteriaValues, addActiveUsersCondition } = require('../helper/Usuarios')
const { response } = require('../response')
const { loadTopicsStatuses, getTopicStatusName } = require('../helper/CoursesTopicsHelper')
const { con } = require('../db')

const headers = [
  'Tipo de curso',
  'Escuela',
  'Curso',
  'Tema',
  'Resultado',
  'Estado(Tema)',
  'Cantidad de visitas por tema'
]

async function exportTemasNoEvaluables ({
  workspaceId, modulos, UsuariosActivos, UsuariosInactivos,
  escuelas, cursos, temas, activeTopics, inactiveTopics, start, end, tipocurso, areas
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

  const users = await loadUsersWithTopics(
    workspaceId, modulos, UsuariosActivos, UsuariosInactivos,
    escuelas, cursos, temas, activeTopics, inactiveTopics, start, end, tipocurso, areas
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Load user topic statuses

  const userTopicsStatuses = await loadTopicsStatuses()

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

    cellRow.push(user.course_type_name)
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)
    cellRow.push(user.topic_name)

    cellRow.push(getTopicStatusName(userTopicsStatuses, user.topic_status_id))
    cellRow.push(user.topic_status ? 'Activo' : 'Inactivo')
    cellRow.push(user.topic_views)

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }
  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Temas no evaluables' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with topics
 * @returns {Promise<*|[]|undefined>}
 */
async function loadUsersWithTopics (
  workspaceId, modulesIds, activeUsers, inactiveUsers,
  schoolsIds, coursesIds, topicsIds, activeTopics, inactiveTopics,
  start, end, tipocurso, areas
) {
  let query = `
    select
      u.*,
      group_concat(distinct(s.name) separator ', ') school_name,
      c.name course_name,
      t.name topic_name,
      tax.name course_type_name,
      t.active topic_status,
      st.views topic_views,
      st.status_id topic_status_id
    from
        users u 
        inner join workspaces w on u.subworkspace_id = w.id
        inner join summary_topics st on u.id = st.user_id
        inner join topics t on t.id = st.topic_id
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on t.course_id = c.id
        inner join course_school cs on c.id = cs.course_id
        inner join taxonomies tax on  tax.id = c.type_id
        inner join schools s on cs.school_id = s.id
        inner join school_workspace sw on s.id = sw.school_id
  `
 const workspaceCondition = ` where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId} and 
      t.assessable = 0 `

  if(areas.length > 0) {
    query += ` inner join criterion_value_user cvu on cvu.user_id = u.id
               inner join criterion_values cv on cvu.criterion_value_id = cv.id`
    query += workspaceCondition

    // query += ' and cv.value_text = :jobPosition'
    query += ` and 
                  ( cvu.criterion_value_id in ( `;
    areas.forEach(cv => query += `${cv},`);
    query = query.slice(0, -1);

    query += `) `;
  } else {
    query += workspaceCondition;
  } 

  // Add type_course and dates at ('created_at')
  if(tipocurso) query +=  ` and tax.code = 'free'` 
  if(start) query += ` and date(st.created_at) >= '${start}'`
  if(end) query += ` and date(st.created_at) <= '${end}'`

  // Add condition for schools ids

  if (schoolsIds.length > 0) {
    query += ` and s.id in (${schoolsIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }

  // Add condition for topics ids

  if (topicsIds.length > 0) {
    query += ` and t.id in (${topicsIds.join()})`
  }

    // Add condition to allow active topics only

  if (activeTopics && !inactiveTopics) {
    query += ' and t.active = 1'
  }

  // Add condition to allow inactive topics only

  if (!activeTopics && inactiveTopics) {
    query += ' and t.active = 0'
  }

  /*if (start && end) {
    query += ` and (
      st.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }*/

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += ' group by u.id, t.id, st.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
