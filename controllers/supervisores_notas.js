'use strict'
process.on('message', (requestData) => {
  supervisoresNotas(requestData)
})
const _ = require('lodash')
require('../error')
require('../sequelize.js')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const moment = require('moment')

const { loadCoursesStatuses, getCourseStatusName, getCourseStatusId } = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { pluck } = require('../helper/Helper')
const {
  loadUsersCriteriaValues,
  getUserCriterionValues, loadUsersIdsWithCriterionValues
} = require('../helper/Usuarios')
const { loadSupervisorSegmentCriterionValues, loadSupervisorSegmentUsersIds } = require('../helper/Segment')

// Headers for Excel file

const headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'VISITAS',
  'NOTA PROMEDIO',
  'RESULTADO CURSO',
  'ESTADO CURSO',
  'REINICIOS CURSOS',
  'TEMAS ASIGNADOS',
  'TEMAS COMPLETADOS',
  'AVANCE (%)'
]

async function supervisoresNotas ({
  workspaceId, supervisorId, escuelas, cursos,
  aprobados,
  desaprobados,
  desarrollo,
  encuestaPendiente
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  // Load user ids which matches supervisor segmentation
  const modulos = await getSuboworkspacesIds(workspaceId)
  const usersIds = await loadSupervisorSegmentUsersIds(modulos, supervisorId)

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // Load user course statuses

  const userCourseStatuses = await loadCoursesStatuses()

  // Load users from database and generate ids array

  const users = await loadUsersWithCourses(
    workspaceId, usersIds, userCourseStatuses,
    escuelas, cursos,
    aprobados,
    desaprobados,
    desarrollo,
    encuestaPendiente
  )

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

    // Calculate completed courses

    const completed = (user.advanced_percentage * user.assigned) / 100

    // Add additional report values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)
    cellRow.push(user.course_views || '-')
    cellRow.push(user.course_passed > 0 ? user.grade_average : '-')
    cellRow.push(getCourseStatusName(userCourseStatuses, user.course_status_id))
    cellRow.push(user.course_active === 1 ? 'Activo' : 'Inactivo')
    cellRow.push(user.course_restarts || '-')
    cellRow.push(user.assigned || 0)
    cellRow.push(Math.round(completed) || 0)
    cellRow.push(user.advanced_percentage ? user.advanced_percentage + '%' : '0%')

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
 * @param usersIds
 * @param schoolsIds
 * @param coursesIds
 * @param userCourseStatuses
 * @param aprobados
 * @param desaprobados
 * @param desarrollo
 * @param encuestaPendiente
 * @returns {Promise<*>}
 */
async function loadUsersWithCourses (
  workspaceId, usersIds, userCourseStatuses,
  schoolsIds, coursesIds, aprobados, desaprobados, desarrollo, encuestaPendiente
) {
  if (usersIds.length === 0) return []

  // Base query

  let query = `
    select 
        u.*, 
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
        sc.advanced_percentage
    from users u
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on sc.course_id = c.id
        inner join course_school cs on c.id = cs.course_id
        inner join schools s on cs.school_id = s.id 
        inner join school_workspace sw on s.id = sw.school_id
    where 
      u.id in (${usersIds.join()}) and
      sw.workspace_id = ${workspaceId}
  `

  // Add condition for schools ids

  if (schoolsIds.length > 0) {
    query += ` and s.id in (${schoolsIds.join()})`
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

  if (aprobados || desaprobados || desarrollo || encuestaPendiente) {
    const statusConditions = []

    if (aprobados) { statusConditions.push(`sc.status_id = ${aprobadoId}`) }
    if (desaprobados) { statusConditions.push(`sc.status_id = ${desaprobadoId}`) }
    if (desarrollo) { statusConditions.push(`sc.status_id = ${desarrolloId}`) }
    if (encuestaPendiente) { statusConditions.push(`sc.status_id = ${encuestaPendienteId}`) }

    query += ' and (' + statusConditions.join(' or ') + ')'
  }

  // Add user conditions and group sentence

  query += ' group by u.id, c.id, sc.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
