'use strict'
process.on('message', (requestData) => {
  generateConsolidatedCoursesReport(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeadersNotasXCurso, getWorkspaceCriteria } = require('../helper/Criterios')
const { loadUsersCriteriaValues, getUserCriterionValues, addActiveUsersCondition } = require('../helper/Usuarios')
const { getCourseStatusName, getCourseStatusId, loadCoursesStatuses } = require('../helper/CoursesTopicsHelper')
const { pluck, logtime } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { con } = require('../db')

// Headers for Excel file

const headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'VISITAS',
  'NOTA PROMEDIO',
  'RESULTADO CURSO',
  'ESTADO CURSO',
  'TIPO CURSO',
  'REINICIOS CURSOS',
  'TEMAS ASIGNADOS',
  'TEMAS COMPLETADOS',
  'AVANCE (%)',
  'ULTIMA EVALUACIÓN'
]

async function generateConsolidatedCoursesReport ({
  workspaceId, modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos,
  aprobados,
  desaprobados,
  desarrollo,
  encuestaPendiente, 
  start, end,
  tipocurso, areas
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeadersNotasXCurso(workspaceId,[1,5,13,4,40,41])
  await createHeaders(headersEstaticos.concat(headers))

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId,[1,5,13,4,40,41])
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // Load user course statuses

  const userCourseStatuses = await loadCoursesStatuses()

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load users from database and generate ids array

  const users = await loadUsersWithCourses(
    workspaceId, userCourseStatuses,
    modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos,
    aprobados, desaprobados, desarrollo, encuestaPendiente, start, end,
    tipocurso, areas
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
    cellRow.push(user.email)
    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Calculate completed courses

    // const completed = (user.advanced_percentage * user.assigned) / 100
    const passed = user.course_passed || 0;
    const taken = user.taken || 0;
    const reviewed = user.reviewed || 0;
    const completed = passed + taken + reviewed;

    // Add additional report values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)
    cellRow.push(user.course_views || '-')
    cellRow.push(user.course_passed > 0 ? user.grade_average : '-')
    cellRow.push(getCourseStatusName(userCourseStatuses, user.course_status_id))
    cellRow.push(user.course_active === 1 ? 'Activo' : 'Inactivo')
    cellRow.push(user.course_type || '-')
    cellRow.push(user.course_restarts || '-')
    cellRow.push(user.assigned || 0)
    cellRow.push(Math.round(completed) || 0)
    cellRow.push(user.advanced_percentage ? user.advanced_percentage + '%' : '0%')
    cellRow.push(user.last_time_evaluated_at ? moment(user.last_time_evaluated_at).format('DD/MM/YYYY H:mm:ss') : '-')

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCursos' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param workspaceId
 * @param userCourseStatuses
 * @param {array} modulesIds
 * @param {boolean} activeUsers include active users
 * @param {boolean} inactiveUsers include inactive users
 * @param {array} schooldIds
 * @param {array} coursesIds
 * @param {boolean} aprobados include aprobados
 * @param {boolean} desaprobados include desaprobados
 * @param {boolean} desarrollo include desarrollo
 * @param {boolean} encuestasPendientes include encuestas pendientes
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithCourses (
  workspaceId, userCourseStatuses,
  modulesIds, activeUsers, inactiveUsers, schooldIds, coursesIds,
  aprobados, desaprobados, desarrollo, encuestasPendientes, start, end,
  tipocurso, areas
) {
  // Base query

  let query = `
    select 
        u.*, 
        tx.name as course_type,
        group_concat(distinct(s.name) separator ', ') school_name,
        c.name course_name,
        c.active course_active,
        sc.views course_views,
        sc.passed course_passed,
        sc.grade_average, 
        sc.status_id course_status_id,
        sc.restarts course_restarts,
        sc.assigned,
        sc.completed,
        sc.reviewed,
        sc.taken,
        sc.advanced_percentage,
        sc.last_time_evaluated_at,
        sc.taken,
        sc.advanced_percentage
    from users u
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on sc.course_id = c.id
        inner join course_school cs on c.id = cs.course_id
        inner join taxonomies tx on tx.id = c.type_id
        inner join schools s on cs.school_id = s.id 
        inner join school_workspace sw on s.id = sw.school_id
   
  `
  const workspaceCondition = ` where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId} `

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
    query += `) `;
  } else {
    query += workspaceCondition;
  } 

  // Add type_course and dates at ('created_at')
  if(tipocurso) query +=  ` and tx.code = 'free'` 
  if(start) query += ` and date(sc.updated_at) >= '${start}'`
  if(end) query += ` and date(sc.updated_at) <= '${end}'`

  // Add condition for schools ids

  if (schooldIds.length > 0) {
    query += ` and s.id in (${schooldIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }

  // Get statuses ids

  const aprobadoId = getCourseStatusId(userCourseStatuses, 'aprobado')
  const desaprobadoId = getCourseStatusId(userCourseStatuses, 'desaprobado')
  const desarrolloId = getCourseStatusId(userCourseStatuses, 'desarrollo')
  const encuestaPendienteId = getCourseStatusId(userCourseStatuses, 'enc_pend')

  // Add condition for statuses

  if (aprobados || desaprobados || desarrollo || encuestasPendientes) {
    const statusConditions = []

    if (aprobados) { statusConditions.push(`sc.status_id = ${aprobadoId}`) }
    if (desaprobados) { statusConditions.push(`sc.status_id = ${desaprobadoId}`) }
    if (desarrollo) { statusConditions.push(`sc.status_id = ${desarrolloId}`) }
    if (encuestasPendientes) { statusConditions.push(`sc.status_id = ${encuestaPendienteId}`) }

    query += ' and (' + statusConditions.join(' or ') + ')'
  }

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += ' group by u.id, c.id, sc.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
